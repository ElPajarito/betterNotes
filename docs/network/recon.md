---
tags:
  - Network
  - Recon
---

# :material-radar: Network Recon

<span class="pill pill-info">network</span>



!!! abstract "TL;DR"
    Find live hosts -> Fast full-port scan (TCP all and UDP top ports) -> Targeted service scan on open ports
## :material-lan-connect: Host discovery

```bash
# Ping sweep / ARP (fastest on a local segment)
nmap -sn 10.10.10.0/24
fping -a -g 10.10.10.0/24 2>/dev/null

# ARP scan on the local link (very reliable, ignores ICMP filtering)
arp-scan -l
netdiscover -r 10.10.10.0/24
```
!!! tip ""
    Full-port with rustscan/masscan (seconds), then `nmap -sVC` on **just the open ports**. 

## :material-magnify-scan: Port scanning

=== "Fast full-port (masscan / rustscan)"

    ```bash
    # Blazing-fast full range, then hand off to nmap
    rustscan -a 10.10.10.5 --range 1-65535 -- -sV -sC
    masscan -p1-65535 10.10.10.5 --rate 10000 -oL masscan.txt
    ```

=== "Nmap basic"

    ```bash
    # 1) quick top ports
    nmap -sS --top-ports 1000 -T4 10.10.10.5 -oN quick.nmap
    # 2) full TCP once you know it's alive
    nmap -p- -sS --min-rate 5000 -T4 10.10.10.5 -oA allports
    # 3) deep dive on the open ports only
    nmap -p22,80,445 -sVC -O 10.10.10.5 -oA deep
    ```

=== "Nmap (rate-limit-aware)"

    ```bash
    # Fast scans gainst hosts that throttle RSTs
    # All TCP ports, one retry
    nmap -sS -vv -p- --defeat-rst-ratelimit --max-retries=1 --open --reason -oA allports
    
    # Top UDP ports
    sudo nmap -sU -vv --defeat-rst-ratelimit  --top-ports 1000 --max-retries=1 --open --reason
    
    #Safe script scan on the discovered open ports 
    nmap -sS -sV -vv -p <open_ports> --open --reason --script "not dos and not broadcast and not brute" --script-timeout=15m
    
    ```

=== "UDP (slow but worth it)"

    ```bash
    nmap -sU --top-ports 50 -T4 10.10.10.5
    # SNMP (161), DNS (53), SNMP, TFTP, IKE are common UDP wins
    ```

=== "Firewall / IDS evasion"

    ```bash
    nmap -f <IP>                 # fragment packets
    nmap --mtu 24 <IP>           # custom (multiple-of-8) MTU fragmentation
    nmap --data-length 30 <IP>   # pad packets with random data
    nmap --source-port 53 <IP>   # spoof a trusted source port (DNS)   
    ```




## :material-server-network: Service enumeration

| Port | Service | Enumerate with |
| --- | --- | --- |
| 21 | FTP | `nmap --script ftp-anon`, try `anonymous` |
| 22 | SSH | banner, key auth, user enum (old libs) |
| 25 | SMTP | `VRFY`/`EXPN` user enum, open relay |
| 53 | DNS | zone transfer `dig axfr @ns domain` |
| 80/443 | HTTP(S) | `whatweb`, `feroxbuster`, → [Web Recon](../web/recon.md) |
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


!!! abstract "Turn XML into a readable report"
    ```bash
    xsltproc scripts-10.1.1.1.xml > scripts-10.1.1.1.html
    ```
    Any `-oX`/`-oA` XML renders into a shareable HTML report — handy for handing
    scan results to a client without the raw terminal dump.

## :material-link-variant: Related

- Web ports → [Web Recon](../web/recon.md) (vhosts, content discovery, CT-log monitoring) → [Web Apps](../web/index.md).
- SMB/LDAP/Kerberos on a host → you found a domain: [Active Directory](active-directory.md).
