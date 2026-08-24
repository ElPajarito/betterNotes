---
tags:
  - Web
  - Reference
---

# :material-lock-reset: Password Reset & Recovery Checklist

<span class="pill pill-hard">→ ATO</span> <span class="pill pill-info">auth</span>

The reset flow is a second, weaker authentication path bolted onto every app.
It has to work for someone who has lost their credentials, which is exactly the
position an attacker is in.

!!! abstract "TL;DR"
    Attack the token (entropy, reuse, expiry), the delivery (host header,
    Referer, response body), and the flow (skip steps, swap the account between
    steps, replay the final call).

## :material-key-variant: The token itself

- [ ] **Entropy** — collect 20 tokens; sequential, timestamp-based or short means guessable
- [ ] **Reuse** — does an old token still work after a new one is issued?
- [ ] **Reuse after use** — does the token die when consumed?
- [ ] **Expiry** — is there one, and is it enforced server-side?
- [ ] **Scope** — does a token issued for user A reset user B when the ID is swapped?
- [ ] **Token in the response body** of the "send reset email" request
- [ ] **Token leaked to a third party** via `Referer` on the reset page (analytics, CDN, fonts)
- [ ] Token accepted **without** the account identifier, or vice versa

## :material-email-alert: Delivery & poisoning

- [ ] **Host header injection** — `Host`, `X-Forwarded-Host`, `X-Host` rewrite the link → [host header](../web/host-header.md)
- [ ] Dangling markup / secondary parameter in the reset URL
- [ ] **Multiple recipients** — `email=victim@x.com&email=you@x.com`, or `email=victim@x.com,you@x.com`
- [ ] **Unicode / IDN** confusables in the address to route the mail elsewhere → [account takeover](../web/account-takeover.md)
- [ ] Reset mail sent to an **unverified** newly-added address
- [ ] Is the link **https** and does it survive an [open redirect](../web/open-redirect.md) on the same host?

## :material-transit-connection-variant: Flow logic

- [ ] **Skip a step** — call the "set new password" endpoint directly, without a token
- [ ] **Swap the account** between step 1 and step 3 (request for you, complete for them)
- [ ] Does the flow ask for the **old password**? Try omitting the field entirely
- [ ] **2FA on the recovery path** — is it enforced, or does a reset log you straight in?
- [ ] Reset **does not invalidate existing sessions** → stolen session survives the fix
- [ ] Reset does not invalidate **other pending tokens**
- [ ] **Security question** answers guessable, enumerable, or returned in a response

## :material-account-search: Enumeration & throttling

- [ ] Different message for a known vs unknown address
- [ ] Different **response time** for known vs unknown
- [ ] No [rate limit](../web/rate-limiting.md) on token submission → brute force a short token
- [ ] Rate limit keyed on something you control (`X-Forwarded-For`, session, casing of the email)

## :material-link-variant: Related

- Parent list → [Web Pentest Checklist](web.md).
- Attack pages: [Account Takeover](../web/account-takeover.md) · [Host Header Injection](../web/host-header.md) · [Auth Bypass](../web/auth-bypass.md) · [Rate Limit Bypass](../web/rate-limiting.md).
