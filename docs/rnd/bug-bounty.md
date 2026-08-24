---
tags:
  - Reference
---

# :material-bug: Bug Bounty Writeups

<span class="pill pill-info">curated</span> <span class="pill pill-medium">real-world</span>

Disclosed, real-world bugs — distilled. Each entry is **source · technique ·
takeaway · tags**, so you learn the transferable idea, not just the story. Skim by
tag; deep-dive via the link.

!!! abstract "Format"
    ```
    ### Title — target
    Source: <link>
    Technique: <the primitive(s) used>
    Takeaway: <the one idea that generalizes>
    Tags: tag, tag, tag
    ```
    Add your own the same way — one entry, one lesson.

## :material-server-network: SSRF & cloud

### Capital One — SSRF → AWS metadata → S3 dump
- **Source:** [krebsonsecurity.com writeup](https://krebsonsecurity.com/2019/08/what-we-can-learn-from-the-capital-one-hack/)
- **Technique:** SSRF on a WAF host → `169.254.169.254` IAM creds → S3.
- **Takeaway:** every SSRF is a cloud-metadata attempt. Always try `169.254.169.254` and `metadata.google.internal`.
- **Tags:** `ssrf` `aws` `cloud` `metadata`

### Shopify — SSRF via Google Docs image import
- **Source:** [HackerOne #341876](https://hackerone.com/reports/341876)
- **Technique:** image-fetch feature → internal service access.
- **Takeaway:** any "import from URL" is an SSRF candidate — screenshots, avatars, webhooks, PDF renderers.
- **Tags:** `ssrf` `image-fetch`

## :material-account-key: Auth, IDOR & logic

### Shopify — partner account takeover via IDOR
- **Source:** [HackerOne #270981](https://hackerone.com/reports/270981)
- **Technique:** predictable object IDs on an admin endpoint.
- **Takeaway:** test every numeric/UUID param for horizontal + vertical IDOR, even on "internal" panels.
- **Tags:** `idor` `access-control` `ato`

### Zoom / others — OAuth `redirect_uri` account takeover
- **Source:** [PortSwigger OAuth research](https://portswigger.net/research/hidden-oauth-attack-vectors)
- **Technique:** loose `redirect_uri` validation leaks the auth code.
- **Takeaway:** always test OAuth `redirect_uri` for path/subdomain/`%2f` bypasses → [OAuth & SAML](../web/oauth-saml.md).
- **Tags:** `oauth` `ato` `redirect`

### Checkout / payment tampering — e-commerce

My own notes, verbatim:

> **Esta merda parte**
>
> Cancelar pagamento com preço legítimo ?
> Trucar ids de produtos ?
> Mudar valor do desconto ?

- **Endpoint:** `/checkout/api/payment?clientId=`
- **Source:** [Payment bypass guide — 69 case studies](https://medium.com/@illoyscizceneghposter/payment-bypass-guide-for-bug-bounty-69-case-studies-15379b4f76fa)
- **Takeaway:** never trust price, quantity, or payment-status fields that round-trip
  through the browser; re-verify every monetary value server-side. Probe the
  cancel/confirm race and state-transition ordering.
- **Tags:** `logic` `payment` `price-tampering` `business-logic`

??? example "Checkout response shape — the fields worth tampering"
    Redacted skeleton of a real checkout response. Every value below is a
    placeholder; the point is *which* fields the client gets to influence.

    ```json
    {
      "success": true,
      "checkout": {
        "state": "PENDING_SEND_ORDER",
        "order": {
          "currency": "EUR",
          "items": [
            {
              "skuId": "<SKU_UUID>",
              "optionId": "<OPTION_ID>",
              "sellerId": "<SELLER_UUID>",
              "sellerType": "FIRST_PARTY",
              "price": {
                "amount": 2.9,
                "sale": false,
                "totalPrice": 2.9,
                "unitPrice": 2.9,
                "saleAndAdjustmentAmount": 0,
                "taxes": [{ "code": "VAT", "rate": 23, "value": 0.54 }]
              },
              "quantity": 1
            }
          ],
          "discountAndPromotion": { "discountAmount": 0, "promotionAmount": 0, "amount": 0 },
          "promotions": [],
          "coupons": [],
          "payment": {
            "success": true,
            "status": "PAID",
            "transactions": [
              { "method": "mbway", "partner": "<PSP>", "amount": 2.9 }
            ]
          },
          "itemsQuantity": 1,
          "price": {
            "subtotal": { "amount": 2.9, "adjustmentAmount": 0 },
            "total":    { "amount": 2.9, "adjustmentAmount": 0 }
          }
        }
      },
      "redirect": "/checkout/confirmation?paymentStatus=PAID&checkoutId=<UUID>"
    }
    ```

    Tamper targets: `amount` / `unitPrice` / `totalPrice` / `subtotal` / `total`,
    `discountAmount` + `promotionAmount`, `quantity`, `taxes[].rate`, and
    `skuId`/`optionId` (swap for a cheaper item after pricing). Then the state
    machine: replay `"status": "PAID"` / `paymentStatus=PAID` on the redirect, or
    cancel the payment after the order reaches `PENDING_SEND_ORDER`.

## :material-code-tags: Injection & RCE

### GitLab — SSRF → Redis → RCE chain
- **Source:** [HackerOne #1132202](https://hackerone.com/reports/1132202)
- **Technique:** SSRF pivot into internal Redis, gadget to command execution.
- **Takeaway:** SSRF + an internal unauth service (Redis/Memcached) is a classic RCE chain.
- **Tags:** `ssrf` `redis` `rce` `chain`

### Uber — SSTI in a templated response
- **Source:** [Uber bug bounty writeups collection](https://github.com/ngalongc/bug-bounty-reference)
- **Technique:** user input hits a template engine → RCE.
- **Takeaway:** reflectivity + math (`{{7*7}}`→`49`) = probe for [SSTI](../web/ssti.md) everywhere text is templated.
- **Tags:** `ssti` `rce` `injection`

## :material-robot: AI / LLM

### Indirect prompt injection via a shared document
- **Source:** [Embrace the Red — prompt injection blog](https://embracethered.com/blog/)
- **Technique:** hidden instructions in a doc/email an AI assistant ingests → data exfil.
- **Takeaway:** treat any content an AI reads as an injection vector → [AI Prompt Injection](../ai/prompt-injection.md).
- **Tags:** `ai` `prompt-injection` `exfil`

## :material-book-open-page-variant: Where to find more

- [HackerOne Hacktivity](https://hackerone.com/hacktivity) — disclosed reports feed.
- [Pentester Land writeups list](https://pentester.land/writeups/) — huge curated archive.
- [bug-bounty-reference](https://github.com/ngalongc/bug-bounty-reference) — by vuln type.
- [PortSwigger Research](https://portswigger.net/research) — the source of many new classes.
- [Intigriti / YesWeHack blogs](https://blog.intigriti.com/) — platform-side writeups.

## :material-link-variant: Related

- HTB machine writeups → [HTB](htb.md); the papers behind new classes → [Research Papers](papers.md).
- Techniques live in [Exploitation](../web/index.md) and [AI Hacking](../ai/index.md).
