---
tags:
  - Web
---

# :material-account-lock-open: Authentication & Access Control Bypass

<span class="pill pill-medium">everywhere</span> <span class="pill pill-info">web</span>

Broken authentication and broken access control top the OWASP list for a reason — they're logic bugs, so scanners miss them and they're often trivial to exploit once spotted.

!!! abstract "TL;DR"
    Test what happens when you change *whose* data you ask for (IDOR), *what role* you claim (privilege escalation), and *how* the token is validated (JWT flaws). Think like a user who says "what if I just… don't authenticate?"

## :material-account-switch: IDOR / BOLA

**Insecure Direct Object Reference** — the app trusts an ID from the client without checking ownership.

```http
GET /api/orders/1001      -> your order
GET /api/orders/1002      -> someone else's order  ← IDOR
```

Testing checklist:

- [ ] Increment/decrement numeric IDs.
- [ ] Swap UUIDs/IDs between two accounts you control.
- [ ] Change IDs in **every** location: path, query, body, JSON, headers.
- [ ] Try methods the UI doesn't use (`PUT`, `DELETE`, `PATCH`).
- [ ] Downgrade content-type or add `?admin=true`, `role=admin` params.

!!! tip "Burp's Autorize / Auth Analyzer"
    Configure a low-priv session, then replay high-priv requests through it. These extensions flag every request that *should* have been denied but wasn't.

## :material-key-variant: JWT attacks

<span class="pill pill-hard">high value</span>

JSON Web Tokens are `header.payload.signature`, base64url-encoded. Common flaws:

=== "alg: none"

    Server accepts an unsigned token. Strip the signature and set `alg` to `none`:
    ```json
    {"alg":"none","typ":"JWT"}
    ```
    ```bash
    # base64url(header).base64url(payload). with an empty signature
    ```

=== "Weak HMAC secret"

    Crack the signing key offline, then forge any claims:
    ```bash
    hashcat -m 16500 jwt.txt /usr/share/wordlists/rockyou.txt
    # or
    john jwt.txt --wordlist=rockyou.txt --format=HMAC-SHA256
    ```
    Cracked? Re-sign a token with `admin: true` / a different `sub`.

=== "alg confusion (RS256→HS256)"

    Server verifies RS256 with a public key. Trick it into HS256, using the *public key* as the HMAC secret (which you know):
    ```bash
    # Grab the public key (often at /jwks.json or from the cert),
    # then sign HS256 with that key material.
    ```

=== "kid injection"

    The `kid` header points at a key file — try path traversal or SQLi in it:
    ```json
    {"alg":"HS256","kid":"../../../../dev/null"}
    ```
    A `kid` resolving to a predictable/empty file lets you forge the signature.

!!! tip "jwt_tool"
    ```bash
    python3 jwt_tool.py <token> -M at          # run all attacks
    python3 jwt_tool.py <token> -X a           # alg:none
    python3 jwt_tool.py <token> -C -d rockyou.txt  # crack secret
    ```

## :material-lock-reset: Broken password reset

- **Host header poisoning** — set `Host: attacker.com` so the reset link points at you:
  ```http
  POST /reset HTTP/1.1
  Host: attacker.com
  ```
- **Token leakage** in the `Referer` header to third-party resources.
- **Predictable tokens** (timestamps, sequential, weak PRNG).
- **Password reset via parameter pollution**: `email=victim@x.com&email=attacker@x.com`.
- **Race conditions** on single-use tokens.

## :material-account-multiple-check: Logic & MFA bypasses

- Response manipulation: change `{"mfa":true}` → `{"mfa":false}` in the response.
- Skip a step: go straight to the post-MFA endpoint with the pre-MFA session.
- Brute-force OTP if there's no rate limit (Burp Intruder over 000000–999999).
- **2FA over-permissive**: is the pre-2FA cookie already authenticated?

!!! loot "Registration / mass-assignment"
    Sign-up endpoints often blindly bind JSON to a model. Add fields the UI never sends:
    ```json
    {"user":"me","pass":"x","role":"admin","isVerified":true}
    ```

## :material-shield-check: Remediation

- Enforce object-level authorization on **every** request, server-side.
- Sign JWTs with strong asymmetric keys; pin the `alg`; reject `none`.
- Reset tokens: high-entropy, single-use, short-lived, and never trust the Host header.
- Rate-limit auth endpoints and OTP verification.

## :material-link-variant: Related

- Combine with [XSS](xss.md) to steal tokens for full account takeover.
- Dumped/forged creds feed into [SQL Injection](sqli.md) targets and beyond.
- Reference: [OWASP Broken Access Control](https://owasp.org/Top10/A01_2021-Broken_Access_Control/).
