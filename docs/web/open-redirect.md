---
tags:
  - Web
---

# :material-directions-fork: Open Redirect

<span class="pill pill-easy">low sev</span> <span class="pill pill-info">web</span>

A redirect that sends users wherever a parameter says. Low severity alone, but a reliable building block for phishing, OAuth token theft, and SSRF filter bypass.

!!! abstract "TL;DR"
    Find `?next=`, `?url=`, `?return=`, `?redirect=` and point it off-site. If the app naively prepends its own domain, use tricks to break out.

## :material-magnify: Payloads

```text
?next=https://evil.tld
?next=//evil.tld                 # protocol-relative
?next=https:evil.tld             # missing slashes
?next=https://target.tld@evil.tld   # userinfo trick
?next=/%2f%2fevil.tld
?next=https://evil.tld%23.target.tld  # fragment confusion
```

## :material-target: Why it matters

- **Phishing** — link shows the trusted domain, lands on yours.
- **OAuth theft** — a redirect chained into a loose `redirect_uri` leaks the `code`/token → see [OAuth & SAML](oauth-saml.md).
- **SSRF allowlist bypass** — server follows the redirect to an internal host → see [SSRF](ssrf.md).

## :material-shield-check: Remediation

- Redirect only to a server-side allowlist or relative paths; never trust the raw parameter.
- If external redirects are needed, show an interstitial "you are leaving" page.

## :material-link-variant: Related

- Amplifies [OAuth & SAML](oauth-saml.md) and [SSRF](ssrf.md).
- Reference: [PayloadsAllTheThings — Open Redirect](https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/Open%20Redirect).
