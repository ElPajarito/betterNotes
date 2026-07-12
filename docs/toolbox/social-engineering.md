---
tags:
  - Reference
---

# :material-account-alert: Social Engineering

<span class="pill pill-info">tooling</span> <span class="pill pill-medium">human layer</span>

The human attack surface — phishing, pretexting, and payload delivery. Only ever
in-scope with **explicit written authorization**; SE has real ethical and legal
weight.

!!! warning "Authorization is non-negotiable"
    Phishing real people, cloning login portals, and pretext calls require named,
    written approval and clear rules of engagement. Confirm scope, targets, and a
    safe-word/abort process before sending anything.

!!! abstract "TL;DR"
    OSINT to build a target list → craft a pretext → deliver via a cloned portal
    (Evilginx for MFA-phishing) or a maldoc/link → capture creds/sessions → report
    click/report rates, not just successes.

## :material-magnify: Recon (OSINT)

```bash
# Harvest names, emails, roles, tech stack
theHarvester -d company.com -b all
# email format + validity
# hunter.io, linkedin2username -> firstname.lastname@company.com
# breach data for reused creds (respect legal scope)
```

## :material-hook: Phishing infrastructure

| Tool | Job |
| --- | --- |
| **GoPhish** | Campaign mgmt, landing pages, click/submit tracking + metrics |
| **Evilginx2** | Reverse-proxy phishing that **captures the session cookie → beats MFA** |
| **Modlishka** | Similar transparent-proxy phishing |
| **King Phisher / Zphisher** | Campaign / quick portal cloning |

```text
# Evilginx (MFA-bypass phishing) — high level:
#   1) register a look-alike domain + valid TLS (Let's Encrypt)
#   2) load a phishlet for the target SSO (o365, google, okta)
#   3) send the lure link; victim authenticates through your proxy
#   4) you capture username + password + the authenticated session token
```

!!! opsec "Look-alike domains + sending reputation"
    Use aged look-alike domains, warmed sending IPs/SPF/DKIM/DMARC aligned, and a
    redirector. Sandbox-evade lures (password-protected archives, benign preview).
    Log everything for the report.

## :material-file-document: Payloads & pretexts

- **Maldocs** — macro/HTML-smuggling droppers → a [C2](c2.md) implant. (Modern
  Office blocks macros from the internet — HTML smuggling / ISO/LNK are current.)
- **Pretexts** — IT support, HR/payroll, DocuSign, package delivery, MFA-fatigue.
- **Vishing / smishing** — phone/SMS to reset MFA or push an approval.

## :material-chart-box: Reporting

Report **rates**, not names: sent, opened, clicked, credential-submitted, reported.
Give the blue team detection gaps (did the phishing email/domain get flagged?).

## :material-link-variant: Related

- Delivery leads to [C2 Frameworks](c2.md); harvested creds → [Password Spraying](../network/password-spraying.md).
- Cloned-portal cookie theft parallels [OAuth/SAML](../web/oauth-saml.md) session abuse.
- Reference: [GoPhish](https://getgophish.com/), [Evilginx2](https://github.com/kgretzky/evilginx2).
