---
tags:
  - Web
  - Reference
---

# :material-cart-outline: Payment & Checkout Checklist

<span class="pill pill-hard">high impact</span> <span class="pill pill-info">business logic</span>

Checkout is where business logic meets money, and where the app has to trust
*something* the client sent. Every item below is a place that trust has been
misplaced in a real application.

!!! abstract "TL;DR"
    Change the number, change the currency, change the order of the steps, and
    replay everything. If the final charge is computed from anything the client
    controls, it's a finding.

!!! tip "Before you touch anything"
    Payment flows hit real money and real third-party processors. Confirm the
    target is a **sandbox/test** processor and that checkout testing is in scope
    before you submit a single order.

## :material-clock-alert: Time-of-check / time-of-use

- [ ] Transfer money or points from two sessions **simultaneously** → [race conditions](../web/race-conditions.md)
- [ ] Buy the same limited item in parallel requests (stock going negative)
- [ ] Change the order **during** payment completion — swap the cart after the total is quoted
- [ ] Change the order **after** payment completion but before fulfilment
- [ ] Apply a single-use voucher from several requests at once

## :material-pencil: Parameter manipulation

- [ ] **Price** — send your own `price`/`amount`, including a lower one and `0`
- [ ] **Currency** — swap `USD` for a weaker currency while the numeric total stays
- [ ] **Quantity** — negative values, fractional values, huge values
- [ ] **Shipping address + POST method** — cheaper shipping tier, or a region with no tax
- [ ] **Additional costs** — tax, fees and handling sent client-side and trusted
- [ ] **Response manipulation** — flip `"status":"failed"` to `"success"` on the way back
- [ ] **Repeat an input parameter** — `amount=100&amount=1`, server may take either
- [ ] **Omit a parameter entirely** — missing often defaults to `0` or "free"
- [ ] **Mass assignment / autobinding** — inject `isPaid`, `discount`, `role` → [mass assignment](../web/mass-assignment.md)
- [ ] Watch the behaviour while changing parameters to detect the logical flaw itself

## :material-repeat: Replay attacks

- [ ] Replay the **callback** from the payment provider (is it signed? is the signature checked?)
- [ ] Replay an **encrypted or signed parameter** from a previous, cheaper order
- [ ] Reuse a capture/confirmation token across two different orders

## :material-decimal: Rounding & numeric processing

- [ ] **Currency rounding** — buy quantities that round in your favour (`0.005` × many)
- [ ] **Generic rounding** — does `1.004 + 1.004` charge `2.00`?
- [ ] Negative numbers anywhere they're accepted (refund-by-purchase)
- [ ] Decimal numbers where integers are expected
- [ ] Very large or very small numbers → overflow / underflow
- [ ] Zero, null or subnormal numbers
- [ ] Exponential notation (`1e-5`) and reserved words (`NaN`, `Infinity`)
- [ ] Numbers in other formats — hex, octal, unicode digits, thousands separators

## :material-credit-card-outline: Card-number handling

- [ ] Is a saved card number **shown** during the payment process?
- [ ] Card enumeration via **registering duplicate cards** — error messages differ
- [ ] Dynamic price/fee tolerance — how much drift does the server accept?

## :material-ticket-percent: Discounts, vouchers, points

- [ ] **Enumerate and guess** voucher codes → [rate limiting](../web/rate-limiting.md)
- [ ] **Stack** vouchers and offers that should be mutually exclusive
- [ ] Earn more points or cash back than the purchase justifies
- [ ] Use **expired, invalid, or other users'** codes → [IDOR](../web/idor.md)
- [ ] **State and basket manipulation** — apply the code, then change the basket
- [ ] **Refund abuse** — refund more than paid, refund twice, refund to another account
- [ ] **Buy-X-get-Y-free** logic with quantities that break the rule
- [ ] Order **out-of-stock or unreleased** items
- [ ] Bypass other restrictions — per-user limits, first-order-only, region locks
- [ ] **Point transfer** between accounts (race it, and check for negative balances)

## :material-lock-question: The rest of the surface

- [ ] **Cryptography issues** — predictable order IDs, weak signature over the amount
- [ ] **Downloadable and virtual goods** — is fulfilment gated on payment *confirmation*?
- [ ] **Hidden and insecure backend APIs** — the mobile app's checkout API often skips checks the web one enforces
- [ ] **Test data in production** — test cards, `?test=true`, sandbox endpoints still live
- [ ] **Currency arbitrage** — deposit in one currency, withdraw in another, profit on the conversion

*Taxonomy adapted from "Common Vulnerability Classes in Financially-Oriented Web Applications".*

## :material-link-variant: Related

- Parent list → [Web Pentest Checklist](web.md).
- The attacks themselves: [Race Conditions](../web/race-conditions.md) · [Mass Assignment](../web/mass-assignment.md) · [IDOR](../web/idor.md) · [Rate Limit Bypass](../web/rate-limiting.md).
