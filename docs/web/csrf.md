---
tags:
  - Web
---

# :material-swap-horizontal-bold: Cross-Site Request Forgery (CSRF)

<span class="pill pill-medium">state-changing</span> <span class="pill pill-info">web</span>

CSRF abuses the browser auto-sending cookies: a victim who visits your page unknowingly fires an authenticated request to the target.

!!! abstract "TL;DR"
    Find a state-changing request that relies only on cookies (no unpredictable token). Recreate it as an auto-submitting form on a page you control.

## :material-file-code: Basic PoC

```html
<form action="https://bank.tld/email/change" method="POST">
  <input type="hidden" name="email" value="attacker@evil.tld">
</form>
<script>document.forms[0].submit()</script>
```

## :material-key-remove: Defeating weak tokens

- **Token not tied to session** — steal any valid token and reuse it.
- **Token only validated if present** — delete the parameter entirely.
- **Method flip** — endpoint accepts `GET` as well as `POST`.
- **Predictable / reflected token** — read it via a leak, then include it.

## :material-cookie: SameSite considerations

Modern browsers default cookies to `SameSite=Lax`, which kills most cross-site `POST` CSRF. Look for:

- `SameSite=None` cookies (fully cross-site).
- Top-level `GET` navigations (Lax still sends cookies).
- Sibling-domain / on-site gadgets (Lax doesn't help intra-site).

!!! tip "Chain with XSS"
    A single [XSS](xss.md) makes CSRF tokens irrelevant — you read the token from the DOM and submit same-origin.

## :material-shield-check: Remediation

- Per-session, unpredictable CSRF tokens validated server-side on every state change.
- `SameSite=Lax` (or `Strict`) cookies; verify `Origin`/`Referer`.

## :material-link-variant: Related

- Trivially chained from [XSS](xss.md); pairs with [CORS Misconfig](cors.md).
- Reference: [PortSwigger CSRF](https://portswigger.net/web-security/csrf).
