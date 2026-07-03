---
tags:
  - Network
  - Recon
---

# :material-radar: Network Recon

<span class="pill pill-easy">start here</span> <span class="pill pill-info">network</span>

You can't attack what you can't see. Recon converts an IP range into a map of hosts, ports, services, and versions — which then tells you which attacks are even possible.

!!! abstract "TL;DR"
    Discover live hosts → fast full-port sweep → targeted service scan on open ports → enumerate each service. Go from broad-and-fast to narrow-and-deep.

## :material-lan-connect: Host discovery

```bash
# Ping sweep / ARP (fastest on a local segment)
nmap -sn 10.10.10.0/24
fping -a -g 10.10.10.0/24 2>/dev/null
# ARP scan on the local link (very reliable, ignores ICMP filtering)
arp-scan -l
netdiscover -r 10.10.10.0/24
```

## :material-magnify-scan: Port scanning

=== "Fast full-port (masscan / rustscan)"

    ```bash
    # Blazing-fast full range, then hand off to nmap
    rustscan -a 10.10.10.5 --range 1-65535 -- -sV -sC
    masscan -p1-65535 10.10.10.5 --rate 10000 -oL masscan.txt
    ```

=== "nmap staged"

    ```bash
    # 1) quick top ports
    nmap -sS --top-ports 1000 -T4 10.10.10.5 -oN quick.nmap
    # 2) full TCP once you know it's alive
    nmap -p- -sS --min-rate 5000 -T4 10.10.10.5 -oA allports
    # 3) deep dive on the open ports only
    nmap -p22,80,445 -sVC -O 10.10.10.5 -oA deep
    ```

=== "UDP (slow but worth it)"

    ```bash
    nmap -sU --top-ports 50 -T4 10.10.10.5
    # SNMP (161), DNS (53), SNMP, TFTP, IKE are common UDP wins
    ```

!!! tip "Two-stage is the workflow"
    Full-port with rustscan/masscan (seconds), then `nmap -sVC` on **just the open ports**. Running `-sVC` against all 65535 ports wastes hours.

## :material-server-network: Service enumeration

| Port | Service | Enumerate with |
| --- | --- | --- |
| 21 | FTP | `nmap --script ftp-anon`, try `anonymous` |
| 22 | SSH | banner, key auth, user enum (old libs) |
| 25 | SMTP | `VRFY`/`EXPN` user enum, open relay |
| 53 | DNS | zone transfer `dig axfr @ns domain` |
| 80/443 | HTTP(S) | `whatweb`, `feroxbuster`, → [Web](../web/index.md) |
| 88 | Kerberos | it's a DC → [Kerberos](kerberos.md) |
| 111 | RPC/NFS | `showmount -e`, mount exports |
| 139/445 | SMB | → [SMB](smb.md) |
| 161 | SNMP | `snmpwalk -c public -v2c`, `onesixtyone` |
| 389/636 | LDAP | `ldapsearch -x`, → [Active Directory](active-directory.md) |
| 1433 | MSSQL | `mssqlclient.py`, weak `sa` |
| 3306 | MySQL | weak creds, `--os-shell` |
| 3389 | RDP | `xfreerdp`, NLA check |
| 5985/6 | WinRM | `evil-winrm` once you have creds |

### Handy one-liners

```bash
# SMB quick look
nxc smb 10.10.10.5                          # NetExec host info
nmap --script "smb-enum-shares,smb-os-discovery" -p445 10.10.10.5

# SNMP goldmine
snmpwalk -c public -v2c 10.10.10.5 | tee snmp.txt   # users, processes, software

# DNS zone transfer
dig axfr @10.10.10.5 corp.local
```

!!! loot "SNMP & NFS are underrated"
    `public` community strings leak running processes, installed software, ARP tables, and sometimes credentials. Open NFS exports let you mount and read files directly — check `showmount -e` on port 111.

## :material-file-tree: Vhost & content discovery (web)

```bash
# Virtual hosts
ffuf -w subdomains.txt -H "Host: FUZZ.target.com" -u http://10.10.10.5 -fs <baseline>
# Directories/files
feroxbuster -u http://10.10.10.5 -w /usr/share/seclists/Discovery/Web-Content/raft-medium-directories.txt -x php,txt,bak
```

## :material-link-variant: Related

- Web ports → [Web Apps](../web/index.md).
- SMB/LDAP/Kerberos on a host → you found a domain: [Active Directory](active-directory.md).
- Reference: [nmap NSE docs](https://nmap.org/nsedoc/), [SecLists](https://github.com/danielmiessler/SecLists).
