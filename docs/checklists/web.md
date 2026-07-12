---
tags:
  - Web
  - Reference
---

# :material-clipboard-check: Web Pentest Checklist

<span class="pill pill-info">methodology</span>

A "don't miss anything" pass for a web engagement. Scale it to scope — a bug
bounty on `*.company.com` starts at **Large**; a single app starts at **Small**.
Every item links to the how-to.

!!! abstract "TL;DR"
    Map the whole surface before you attack any single input. Recon → fingerprint →
    per-input attack matrix → business logic. The bugs hide in the paths you didn't
    enumerate.

## :material-map: Scope sizing

- **Large** — a company with many domains → start with ASN/acquisition recon.
- **Medium** — one domain → subdomain enumeration first.
- **Small** — one app → content discovery + the attack matrix.

## :material-radar: Recon

- [ ] ASN → IP ranges; review acquisitions & related registrants (large scope)
- [ ] [Subdomain enumeration](../network/recon.md) (passive + brute + permute)
- [ ] [Subdomain takeover](../network/recon.md) check on dangling CNAMEs
- [ ] Alive-host probing + screenshots (`httpx`, `gowitness`)
- [ ] [Cloud asset](../cloud/index.md) discovery (buckets, blobs, functions)
- [ ] Google/GitHub dorking for leaks, keys, endpoints
- [ ] Historical URLs (`gau`, `waybackurls`) → hidden params & endpoints

## :material-fingerprint: Fingerprint & map

- [ ] Identify server, framework, and [technology](../webtech/index.md) + versions
- [ ] `robots.txt`, `sitemap.xml`, `/.well-known/`, `crossdomain.xml`
- [ ] [Content discovery](../network/ports.md) (dirs, files, backups, `.git`, `.env`)
- [ ] [VHost](../network/ports.md) fuzzing (different site, same IP)
- [ ] Identify the WAF (`wafw00f`) and note bypass angles
- [ ] Enumerate every parameter (`burp-parameter-names`, JS review)
- [ ] Map auth: roles, session mechanism, [JWT](../web/jwt.md)/[OAuth](../web/oauth-saml.md)

## :material-target: Per-input attack matrix

For **every** parameter (URL, body, headers, cookies, JSON):

- [ ] [SQLi](../web/sqli.md) / [NoSQL](../web/nosql-injection.md) injection
- [ ] [XSS](../web/xss.md) (reflected / stored / DOM) in each context
- [ ] [SSRF](../web/ssrf.md) on any URL-fetching feature
- [ ] [Command injection](../web/command-injection.md) / [SSTI](../web/ssti.md) on rendered/executed input
- [ ] [XXE](../web/xxe.md) on any XML/SVG/DOCX input
- [ ] [LDAP](../web/ldap-injection.md) injection on directory-backed search/login
- [ ] [File upload](../web/file-upload.md) bypasses (type, extension, content)
- [ ] [Open redirect](../web/open-redirect.md) on `next=`/`url=`/`return=`
- [ ] Path traversal / LFI on file/template/`page=` params

## :material-account-lock: Auth, sessions & access control

- [ ] [Auth bypass](../web/auth-bypass.md): default creds, logic flaws, response tampering
- [ ] Broken access control / **IDOR** (swap IDs, roles, tenants)
- [ ] [JWT](../web/jwt.md): `alg=none`, weak secret, `kid` injection, confusion
- [ ] [OAuth/SAML](../web/oauth-saml.md): redirect_uri, state, token leakage
- [ ] Session: fixation, predictable IDs, missing invalidation on logout
- [ ] [CSRF](../web/csrf.md) on state-changing actions; [CORS](../web/cors.md) misconfig
- [ ] Password reset logic (token reuse, host-header poisoning)

## :material-cog-sync: Server-side & logic

- [ ] [Deserialization](../web/deserialization.md) on serialized cookies/params
- [ ] [Request smuggling](../web/request-smuggling.md) (CL.TE/TE.CL)
- [ ] [Web cache poisoning](../web/web-cache-poisoning.md) via unkeyed inputs
- [ ] [Race conditions](../web/race-conditions.md) on limits/coupons/balances
- [ ] Business logic: negative quantities, price/step tampering, workflow skips
- [ ] Mass assignment / [prototype pollution](../web/prototype-pollution.md)

## :material-file-document-check: Wrap-up

- [ ] Rate limiting / anti-automation on sensitive endpoints
- [ ] Security headers (CSP, HSTS, `X-Frame-Options`) — note gaps
- [ ] Map every finding to [MITRE](../reference/attacks.md); write [remediation](../web/index.md)

## :material-link-variant: Related

- Internal/AD engagement → [Internal / AD Checklist](internal-ad.md).
- Wordlists for the fuzzing steps → [Wordlist Reference](../reference/wordlists.md).
