---
tags:
  - Network
  - Windows
  - Reference
---

# :material-clipboard-list: Internal / AD Checklist

<span class="pill pill-info">methodology</span>

The internal engagement flow: from a network drop with **no creds** to **Domain
Admin**. Work top to bottom; loop back to BloodHound after every new credential.

!!! abstract "TL;DR"
    No creds → poison & sniff, spray, roast pre-auth. First cred → BloodHound the
    domain → walk the shortest path (Kerberoast / ACLs / delegation / ADCS) → DCSync
    → persist. Enumerate relentlessly; the path is almost always already in the graph.

## :material-lan-connect: Foothold — no credentials yet

- [ ] Identify the domain, DCs, and your IP/segment (`nxc smb <range>`)
- [ ] [Port/service sweep](../network/ports.md); note 88/389/445/5985/1433
- [ ] [SMB null / guest session](../network/smb.md): shares, users, password policy
- [ ] [LDAP anonymous bind](../network/ports.md) dump
- [ ] Poison & relay: `Responder` + [NTLM relay](../network/ntlm-relay.md) (LLMNR/NBT-NS/mDNS)
- [ ] [AS-REP roast](../network/kerberos.md) users without pre-auth (no creds needed)
- [ ] [Password spray](../network/password-spraying.md) (respect lockout) with `Season+Year`, `Company123`
- [ ] Check for anonymous [MSSQL](../network/mssql.md) / shares with creds inside

## :material-account-key: First credential — orient

- [ ] Validate the cred everywhere (`nxc smb/winrm/mssql <range> -u -p`)
- [ ] Collect [BloodHound](../network/bloodhound.md) data (`bloodhound-python` / SharpHound)
- [ ] Ask BloodHound: **shortest path to Domain Admins** from what you own
- [ ] Mark owned principals; look for sessions of privileged users
- [ ] Enumerate: [Kerberoastable](../network/kerberos.md) SPNs, AS-REP-able users, ADCS templates

## :material-arrow-up-bold: Escalate within the domain

- [ ] [Kerberoast](../network/kerberos.md) → crack service-account passwords offline
- [ ] ACL abuse: `GenericAll`/`GenericWrite`/`WriteDACL` → reset pw / targeted roast
- [ ] Delegation: [unconstrained / constrained / RBCD](../network/kerberos.md)
- [ ] [AD CS (ESC1-ESC8)](../network/adcs.md) certificate abuse
- [ ] [Coerce + relay](../network/ntlm-relay.md) (PetitPotam/PrinterBug) to a DC or ADCS
- [ ] Reuse cracked/dumped creds across hosts (password reuse is everywhere)

## :material-server-security: Host-level (each machine you land on)

- [ ] [Windows privesc](../privesc/windows.md): `whoami /priv`, services, potatoes
- [ ] Dump [LSASS/SAM](../privesc/windows.md) → hashes, tickets, cleartext
- [ ] [Credential hunting](../privesc/credential-hunting.md): files, shares, registry, browsers
- [ ] [Pass-the-hash / ticket](../network/kerberos.md) to move laterally

## :material-crown: Domain dominance & persistence

- [ ] DCSync with the right rights → dump `krbtgt` + all hashes
- [ ] [Golden / Silver ticket](../network/kerberos.md) (prefer AES; realistic lifetime)
- [ ] [Persistence](../privesc/persistence.md): DCShadow, AdminSDHolder, ACL backdoors
- [ ] Document the full path for the report → [MITRE mapping](../reference/attacks.md)

!!! opsec "Internal is heavily monitored"
    Roasting (4769), DCSync (4662), and forged tickets light up modern SIEM/EDR.
    Prefer targeted requests, AES over RC4, and realistic ticket lifetimes — note
    the noisy steps in your report.

## :material-link-variant: Related

- Web/external engagement → [Web Pentest Checklist](web.md).
- Core notes: [Recon](../network/recon.md) · [SMB](../network/smb.md) · [Kerberos](../network/kerberos.md) · [AD Attack Paths](../network/active-directory.md) · [BloodHound](../network/bloodhound.md).
