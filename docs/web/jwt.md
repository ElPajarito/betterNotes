---
tags:
  - Web
---

# :material-key-chain-variant: JWT Attacks

<span class="pill pill-hard">token forgery</span> <span class="pill pill-info">web</span>

JSON Web Tokens are self-contained auth. If signature verification is weak or optional, you forge claims (`admin: true`, another `sub`) and become anyone.

!!! abstract "TL;DR"
    Decode `header.payload.signature`. Attack the *verification*: unsigned acceptance, crackable secrets, algorithm confusion, and header-injection tricks.

## :material-format-list-bulleted: Core attacks

=== "alg: none"

    ```json
    {"alg":"none","typ":"JWT"}
    ```
    Strip the signature; some libs accept an unsigned token.

=== "Weak HMAC secret"

    ```bash
    hashcat -m 16500 jwt.txt rockyou.txt
    ```
    Crack it, then re-sign forged claims.

=== "RS256 → HS256 confusion"

    Server verifies RS256 with a public key. Force `alg:HS256` and sign with the **public key** as the HMAC secret — you already know it.

## :material-file-search: Header injection tricks

- **`jku` / `x5u`** — point at your own JWKS/cert URL if the host isn't validated.
- **`jwk`** — embed your own public key in the header (self-signed).
- **`kid`** — path traversal (`kid: ../../dev/null`) or SQLi to control the key.

## :material-tools: jwt_tool

```bash
python3 jwt_tool.py <token> -M at            # run all attacks
python3 jwt_tool.py <token> -X a             # alg:none
python3 jwt_tool.py <token> -C -d rockyou.txt  # crack HMAC
```

!!! loot "What forgery buys you"
    A forged token = instant privilege escalation and account takeover with no password. Check `role`, `isAdmin`, `sub`, `scope` claims.

## :material-shield-check: Remediation

- Pin the algorithm server-side; reject `none`. Use strong asymmetric keys.
- Validate `jku`/`kid` against an allowlist; short token lifetimes + revocation.

## :material-link-variant: Related

- A deeper dive on the JWT section of [Auth Bypass](auth-bypass.md).
- Pairs with [OAuth & SAML](oauth-saml.md) flows.
- Reference: [PortSwigger JWT](https://portswigger.net/web-security/jwt).
