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

## :material-account-clock: Session management flaws

*From "A Practical Guide to Authentication and Session Management Vulnerabilities" by [coffinxp](https://medium.com/@coffinxp).*

Session handling is pure logic, so scanners walk straight past it. Tooling for the whole checklist below: two browsers (or one + incognito), a cookie editor such as **EditThisCookie**, and Burp Repeater.

### Old session survives a password change

Log in to `$TARGET` on two browsers, change the password from browser A, then refresh browser B. Still authenticated → a hijacked session outlives the victim's attempt to lock the attacker out.

### Session not invalidated on logout

The server never destroys the token; the browser just drops the cookie locally.

- Log in, dump **all** session cookies with the cookie editor.
- Click **Logout**.
- Paste the saved cookies back and refresh.
- Back in without credentials → the token is still valid server-side.

Stolen cookies (XSS, sniffing) then work forever regardless of how often the victim logs out.

### Browser cache / back-button weakness

Authenticated pages must ship `no-store, no-cache` in `Cache-Control`.

- Log in, browse the sensitive pages (Profile, Settings, Payments).
- Log out.
- Hit the browser's **Back** button (`Alt + ←`).
- Private data renders (or the cached page still looks authenticated) → reportable, and nasty on shared machines.

### Email verification bypass (logic flaw)

The app flips the "verified" flag on the wrong trigger — the current address inherits a confirmation it never earned.

- Register with **Email A**, leave its verification link unclicked.
- Log in, change the address to **Email B**; verify the link that arrives at B.
- Change the address back to **Email A**.
- Email A now shows as verified without its own link ever being clicked.

That is enough to "own" an address you don't control, e.g. `admin@company.com`, and slip past domain-gated features.

### Email verification swap

A link minted for one address validates a different one.

- Register with **Email A** (yours), don't click the link.
- Change the account's address to **Email B** (the victim's).
- Open the inbox for A and click the original link.
- Email B comes back verified → you just confirmed an address you don't own.

Feeds pre-account-takeover and lets you push "confirmed account" mail at a victim.

### Password-reset token persists across requests

Requesting a fresh link should kill the previous one.

- Request reset **Link 1**, don't use it.
- Request reset **Link 2**.
- Go back and use **Link 1**.
- Still works → old links stay live in mailboxes, backups and history as permanent backdoors.

### Password-reset token re-use

- Request a link and actually complete the reset with it.
- Log in, then load the exact same link again.
- If it lets you set a password a second time, the token was never burned — anyone with access to that URL later owns the account.

### Missing session validation on sensitive endpoints

The endpoint checks that a session cookie *exists*, never that it is still active.

- Log in, edit a profile field but don't save.
- Proxy on, click **Save**, capture the request → **Repeater**, then **drop** it in Proxy.
- Log out in the browser.
- Tamper with the parameters in Repeater and send.
- `200 OK` plus a real data change → the session was never validated, so email/password changes still land after logout.

### Session fixation

- Note the pre-auth session cookie on the login page, e.g. `PHPSESSID=XYZ123`.
- Log in with valid credentials.
- Read the cookie again — unchanged `XYZ123` means no rotation on authentication.

Plant the ID on a victim first (link, subdomain cookie injection) and you're inside their account the moment they log in.

### Concurrent session limit bypass

- Log in on browser A, then browser B; check whether A gets kicked.
- No cap? Fire ~50 logins through Burp Intruder and count how many live sessions you end up with.

Usually low severity on its own, but it defeats impossible-travel/fraud detection and lets an attacker sit in the account beside the real user.

### No session rotation after a privilege change

- Log in as a low-privilege user, note the session ID.
- Trigger a privilege gain: plan upgrade, joining an org, enabling 2FA, accepting an admin invite.
- Compare the session ID.

Unchanged → a session stolen *before* the upgrade silently inherits the new privileges with no re-auth.

### Unrestricted session duration

- Capture a session cookie, then leave it idle for hours or days.
- Replay it byte-for-byte in Burp or paste it back into the browser.
- Still valid → the backend never expires it regardless of the cookie's own `Expires`, so a leaked cookie is a long-term key.

### Weak "Remember me" token

- Log in with **Stay logged in** enabled and note the remember-me cookie.
- Log out, paste the cookie back, refresh.
- Logged in again → the token is static, survives logout, and often survives password changes too.

### JWT not revoked on logout

!!! bug "Stateless sessions rot silently"
    Capture your JWT, log out, then replay the same token in Repeater/Postman. A `200` means the server keeps no denylist — the token is a permanent credential until it expires on its own. See [JWT](jwt.md) for forging on top of that.

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

## :material-link-variant: Related

- Combine with [XSS](xss.md) to steal tokens for full account takeover.
- Dumped/forged creds feed into [SQL Injection](sqli.md) targets and beyond.
- Reference: [OWASP Broken Access Control](https://owasp.org/Top10/A01_2021-Broken_Access_Control/).
