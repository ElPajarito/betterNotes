---
tags:
  - Web
  - Reference
icon: material/clipboard-check
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

## :material-file-tree: Deep dives

Four areas get their own run-through, because the list below only has room for
the headline check:

<div class="grid cards" markdown>

-   :material-cart-outline:{ .lg .middle } __Payment & Checkout__

    ---
    Price, currency and quantity tampering, replay, rounding, vouchers, refunds.

    [:octicons-arrow-right-24: Run it](payments.md)

-   :material-lock-reset:{ .lg .middle } __Password Reset & Recovery__

    ---
    Token entropy and reuse, host-header poisoning, flow skipping, 2FA on recovery.

    [:octicons-arrow-right-24: Run it](password-reset.md)

-   :material-file-upload-outline:{ .lg .middle } __File Upload__

    ---
    Extension and MIME bypasses, traversal in filenames, parsers that execute.

    [:octicons-arrow-right-24: Run it](file-upload.md)

-   :material-account-key-outline:{ .lg .middle } __SSO — OAuth & SAML__

    ---
    `redirect_uri`, `state`/PKCE, token substitution, signature wrapping.

    [:octicons-arrow-right-24: Run it](sso.md)

</div>

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

## :material-server-security: Configuration & deployment

- [ ] Network infrastructure configuration — exposed admin services, management ports <small>`WSTG-CONF-01`</small>
- [ ] Application platform configuration — default installs, sample apps, verbose errors <small>`WSTG-CONF-02`</small>
- [ ] File-extension handling — request `.bak` `.old` `.inc` `.config` `.swp` `.zip` versions of known files <small>`WSTG-CONF-03`</small>
- [ ] Old backups and unreferenced files — editor saves, `~` suffixes, `.git`, `.svn`, `.DS_Store` <small>`WSTG-CONF-04`</small>
- [ ] Enumerate infrastructure and application **admin interfaces** <small>`WSTG-CONF-05`</small>
- [ ] [HTTP methods](../reference/http.md) — `OPTIONS`, then try `PUT`, `DELETE`, `TRACE`, and arbitrary verbs for [403 bypass](../web/403-bypass.md) <small>`WSTG-CONF-06`</small>
- [ ] HSTS present, `includeSubDomains`, preload <small>`WSTG-CONF-07`</small>
- [ ] RIA cross-domain policy — `crossdomain.xml`, `clientaccesspolicy.xml` wildcards <small>`WSTG-CONF-08`</small>
- [ ] File permissions on anything writable or world-readable that's served <small>`WSTG-CONF-09`</small>
- [ ] [Subdomain takeover](../network/recon.md) on dangling records <small>`WSTG-CONF-10`</small>
- [ ] [Cloud storage](../cloud/index.md) — bucket ACLs, public listing, signed-URL scope <small>`WSTG-CONF-11`</small>

## :material-account-multiple-check: Identity, auth & session

- [ ] **Role definitions** — get the list of roles and what each is supposed to reach <small>`WSTG-IDNT-01`</small>
- [ ] [Registration process](../web/registration.md) — self-registration, approval, duplicate accounts <small>`WSTG-IDNT-02`</small>
- [ ] Account **provisioning** — who can create accounts, and can a low-priv user provision a high-priv one <small>`WSTG-IDNT-03`</small>
- [ ] **Account enumeration** — login, registration, reset, and response *timing* <small>`WSTG-IDNT-04`</small>
- [ ] Weak or unenforced **username policy** — predictable format gives you the user list <small>`WSTG-IDNT-05`</small>
- [ ] Credentials transported over an **encrypted channel** — no HTTP login, no creds in a query string <small>`WSTG-ATHN-01`</small>
- [ ] [Default credentials](../web/auth-bypass.md) on the app and on every component behind it <small>`WSTG-ATHN-02`</small>
- [ ] Weak **lock-out** mechanism — and whether the lock-out is itself a DoS <small>`WSTG-ATHN-03`</small>
- [ ] Vulnerable **"remember me"** — persistent cookie that is guessable or never expires <small>`WSTG-ATHN-05`</small>
- [ ] **Browser cache** — back button after logout, `Cache-Control` on authenticated pages <small>`WSTG-ATHN-06`</small>
- [ ] Weak **password policy** — length, complexity, breached-password check <small>`WSTG-ATHN-07`</small>
- [ ] Weaker authentication in an **alternative channel** — mobile app, legacy endpoint, API, IVR <small>`WSTG-ATHN-10`</small>
- [ ] Session management schema — where the ID comes from, how it's bound <small>`WSTG-SESS-01`</small>
- [ ] **Cookie attributes** — `Secure`, `HttpOnly`, `SameSite`, `Domain` scope, `Path` <small>`WSTG-SESS-02`</small>
- [ ] **Exposed session variables** in URLs, logs, `Referer`, or the page source <small>`WSTG-SESS-04`</small>
- [ ] **Session timeout** — idle and absolute, enforced server-side <small>`WSTG-SESS-07`</small>
- [ ] **Session puzzling** — the same session variable set by two different flows <small>`WSTG-SESS-08`</small>
- [ ] **Session hijacking** — is the ID bound to anything (IP, UA, fingerprint) at all <small>`WSTG-SESS-09`</small>

## :material-file-document-check: Wrap-up

- [ ] Rate limiting / anti-automation on sensitive endpoints
- [ ] Security headers (CSP, HSTS, `X-Frame-Options`) — note gaps
- [ ] Map every finding to [MITRE](../reference/attacks.md); write [remediation](../web/index.md)

## :material-link-variant: Related

- Internal/AD engagement → [Internal / AD Checklist](internal-ad.md).
- Full formal taxonomy → [OWASP Web Security Testing Guide](https://owasp.org/www-project-web-security-testing-guide/) (the `WSTG-*` IDs above).
- Wordlists for the fuzzing steps → [Wordlist Reference](../reference/wordlists.md).
- API-shaped coverage check → [MindAPI](https://dsopas.github.io/MindAPI/play/) mind map.
