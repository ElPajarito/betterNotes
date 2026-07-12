---
tags:
  - Web
---

# :material-cart: Magento

<span class="pill pill-hard">e-commerce</span> <span class="pill pill-info">web</span>

Magento (Adobe Commerce) runs a lot of online stores — so it's a card-skimming
(Magecart) target with recurring **unauth RCE and SQLi** CVEs.

!!! abstract "TL;DR"
    Fingerprint version → `magescan` → match a CVE (Shoplift SQLi, the 2022
    template-injection RCE) → admin → template/import RCE. Loot admin + customer data.

## :material-magnify: Identify & enumerate

```bash
curl -s http://$TARGET/magento_version                 # 2.x version header/endpoint
curl -s http://$TARGET/js/varien/js.js | head          # Magento JS present
magescan scan:all http://$TARGET
# admin panel path (often customised): /admin /backend
```

## :material-fire: Notable CVEs

```text
# CVE-2015-1397 "Shoplift" — unauth SQLi (Magento 1.x) → admin creation
# CVE-2019-8144 — unauth RCE via page-builder
# CVE-2022-24086 / 24087 — unauth template-injection RCE (2.x) — heavily exploited
# pick by version; PoCs available
```

!!! loot "Admin → RCE + payment data"
    Admin access → edit an email/CMS **template** (Magento template syntax runs
    PHP-ish directives), or abuse the import/customisation flow for a webshell.
    Customer + order data (PII, partial card data) is the loot.

## :material-shield-check: Remediation

- Patch promptly (Magento RCEs are wormed for Magecart); strong admin creds + 2FA;
  custom admin path + IP allowlist; file-integrity monitoring for skimmers.

## :material-link-variant: Related

- Fingerprinted at [Web Technologies](index.md) / [Ports](../network/ports.md).
- SQLi → [SQLi](../web/sqli.md); template RCE → [SSTI](../web/ssti.md).
- Reference: [magescan](https://github.com/steverobbins/magescan), [HackTricks](https://book.hacktricks.wiki/en/network-services-pentesting/pentesting-web/index.html).
