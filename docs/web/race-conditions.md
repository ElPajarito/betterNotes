---
tags:
  - Web
---

# :material-timer-sand: Race Conditions

<span class="pill pill-medium">logic</span> <span class="pill pill-info">web</span>

A time-of-check-to-time-of-use gap lets two requests both pass a check before either updates state — redeem a coupon twice, over-withdraw, bypass a one-time limit.

!!! abstract "TL;DR"
    Fire many identical requests in the same instant. If a "single-use" or "limit N" action succeeds more than it should, you've won the race.

## :material-target: Where to look

- One-time codes: coupons, gift cards, referral bonuses, MFA/OTP verification.
- Balance / inventory: withdraw, transfer, purchase, "last item in stock."
- Uniqueness checks: register the same username/email in parallel.
- Antifuzz limits: "3 login attempts", "reset once per hour."

## :material-rocket-launch: Landing the hits together

Use HTTP/2 **single-packet attack** (Burp Repeater → send group in parallel) to remove network jitter:

```
Burp Repeater → add tab to group → "Send group in parallel"
Turbo Intruder → race-single-packet-attack.py
```

Send 20–50 copies; success = the guarded action fired multiple times.

!!! loot "Common wins"
    Double-spend store credit, apply one coupon N times, or bypass rate limits on OTP verification for a brute force.

## :material-shield-check: Remediation

- Enforce atomicity: DB unique constraints, `SELECT ... FOR UPDATE`, idempotency keys.
- Server-side locks around check-then-act; don't rely on app-layer counters.

## :material-link-variant: Related

- Batching amplifies OTP brute force → [Auth Bypass](auth-bypass.md); also see [GraphQL](graphql.md) batching.
- Reference: [PortSwigger Race Conditions](https://portswigger.net/web-security/race-conditions).
