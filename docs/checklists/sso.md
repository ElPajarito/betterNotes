---
tags:
  - Web
  - Reference
---

# :material-account-key-outline: SSO — OAuth & SAML Checklist

<span class="pill pill-hard">→ ATO</span> <span class="pill pill-info">auth</span>

Single sign-on moves the authentication decision to another party, and every
step of getting that decision back to the application is attackable.

!!! abstract "TL;DR"
    Attack the redirect (where the code goes), the binding (whose code it is),
    and the assertion (whether it was really signed, and by whom).

## :material-link-variant-off: `redirect_uri` handling

- [ ] Fully open — any URL accepted
- [ ] **Prefix matching** — `https://target.com.evil.com`, `https://target.com@evil.com`
- [ ] **Suffix/subdomain** — `https://evil.target.com` if any subdomain is takeover-able
- [ ] **Path traversal** in an allowed path — `https://target.com/callback/../redirect?url=`
- [ ] Chained with an [open redirect](../web/open-redirect.md) on an allowed host
- [ ] Second `redirect_uri` parameter, or different casing/encoding
- [ ] `localhost` / private IPs left in the allowlist from development

## :material-shuffle-variant: State, PKCE & CSRF

- [ ] **`state` missing** → login CSRF: force the victim into *your* account
- [ ] `state` present but **not validated** on return
- [ ] `state` reusable across sessions
- [ ] **PKCE** absent on a public client, or `code_challenge_method=plain` accepted
- [ ] Authorization **code reuse** — replay the same code twice
- [ ] Code issued for client A accepted by client B

## :material-swap-horizontal-bold: Token & identity binding

- [ ] **Token substitution** — swap in an access token from a different app with the same IdP
- [ ] `id_token` accepted **without signature verification** → [JWT attacks](../web/jwt.md)
- [ ] `alg=none`, `HS256`-vs-`RS256` confusion on the `id_token`
- [ ] `aud` / `iss` not checked
- [ ] **`email` trusted without `email_verified`** → register the victim's address at a weak IdP
- [ ] Account linking by email alone → sign in with a matching address and inherit the account
- [ ] Unlink/relink flow reachable without re-authentication

## :material-file-certificate: SAML specifics

- [ ] Signature **not verified at all** — strip `<ds:Signature>` and see what happens
- [ ] **XML signature wrapping** — a signed assertion plus an unsigned one you control
- [ ] Signature covers the assertion but **not** the response, or vice versa
- [ ] [XXE](../web/xxe.md) in the assertion parser
- [ ] `NotBefore` / `NotOnOrAfter` not enforced → replay an old assertion
- [ ] `Destination` / `Recipient` / `Audience` not checked
- [ ] XML comment truncation — `admin<!---->@evil.com` parsed as `admin`
- [ ] IdP-initiated flow enabled when it shouldn't be

## :material-logout: Session & logout

- [ ] Single logout doesn't actually kill the app session
- [ ] IdP session ends but the app's cookie survives
- [ ] Session not rotated after the SSO login completes

## :material-link-variant: Related

- Parent list → [Web Pentest Checklist](web.md).
- Attack pages: [OAuth & SAML](../web/oauth-saml.md) · [JWT Attacks](../web/jwt.md) · [Account Takeover](../web/account-takeover.md) · [Open Redirect](../web/open-redirect.md).
