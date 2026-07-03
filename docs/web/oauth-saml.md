---
tags:
  - Web
---

# :material-account-key: OAuth & SAML Abuse

<span class="pill pill-hard">account takeover</span> <span class="pill pill-info">web</span>

Federated login (OAuth 2.0, OIDC, SAML SSO) moves trust to a third party. Sloppy redirect/assertion validation turns "log in with Google" into "log in as anyone."

!!! abstract "TL;DR"
    In OAuth, attack the `redirect_uri` and `state`. In SAML, attack signature validation of the assertion.

## :material-swap-vertical: OAuth flaws

- **`redirect_uri` hijack** — if validation is loose (prefix match, open path), redirect the `code`/token to your host:
  ```
  redirect_uri=https://target.tld.evil.tld/cb
  redirect_uri=https://target.tld/legit/../../evil
  ```
- **Missing `state`** = CSRF on the callback → login/account linking as the attacker.
- **Implicit-flow token leak** via `Referer` or open redirect on the client.
- **`code` reuse / no PKCE** — replay an intercepted authorization code.

## :material-file-certificate: SAML flaws

- **No signature check** — strip the `<Signature>`; some SPs accept unsigned assertions.
- **XML Signature Wrapping (XSW)** — keep the signed assertion but add a second, unsigned assertion the app actually reads.
- **XXE** in the SAML XML parser → see [XXE](xxe.md).
- Change `<NameID>` to `admin@target.tld` after breaking the signature.

!!! tip "Tools"
    Burp **SAML Raider** for XSW/signature stripping; **EsPReSSO** to spot SSO flows.

## :material-shield-check: Remediation

- Exact-match `redirect_uri`; require `state` and PKCE.
- Enforce signature validation on the whole SAML response; disable DTDs.

## :material-link-variant: Related

- Tokens often ride as [JWT](jwt.md); assertions parse XML → [XXE](xxe.md).
- Reference: [PortSwigger OAuth](https://portswigger.net/web-security/oauth).
