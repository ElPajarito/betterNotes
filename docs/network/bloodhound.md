---
tags:
  - Network
  - Windows
---

# :material-dog: BloodHound & AD Pathing

<span class="pill pill-medium">map the domain</span> <span class="pill pill-info">network</span>

BloodHound turns AD's tangle of ACLs, group memberships, and sessions into a graph — so you can ask "what's the shortest path from *me* to Domain Admin?"

!!! abstract "TL;DR"
    Collect the domain graph with any valid creds, import to BloodHound, and run the built-in queries for shortest paths and juicy misconfigurations.

## :material-download: Collect

```bash
# Python collector (no Windows box needed)
bloodhound-python -u user -p pass -d corp.local -ns 10.10.10.5 -c All

# or the C# collector on a domain host
SharpHound.exe -c All --zipfilename loot.zip
```

## :material-graph: Analyze

Import the zip, then use pre-built queries:

- *Shortest Paths to Domain Admins*
- *Find Principals with DCSync Rights*
- *Kerberoastable users* / *AS-REP roastable users*
- *Dangerous ACLs* (`GenericAll`, `WriteDacl`, `ForceChangePassword`)

## :material-arrow-decision: Abuse the edges

| Edge | Abuse |
| --- | --- |
| `GenericAll` on user | Reset their password / targeted Kerberoast |
| `WriteDacl` on group | Add yourself, inherit its rights |
| `AddMember` | Join a privileged group |
| `DCSync` | Dump all domain hashes |

!!! opsec "Collection touches everything"
    `-c All` queries every host for sessions — noisy. Scope collectors (`-c DCOnly`) when stealth matters.

## :material-shield-check: Remediation

- Prune excessive ACLs and nested group membership; tier admin accounts.
- Monitor for mass LDAP enumeration and SharpHound signatures.

## :material-link-variant: Related

- Consumes creds from [Password Spraying](password-spraying.md); paths lead to [Active Directory](active-directory.md) / [Kerberos](kerberos.md) / [AD CS](adcs.md).
- Reference: [BloodHound docs](https://bloodhound.specterops.io/).
