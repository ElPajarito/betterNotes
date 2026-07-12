---
tags:
  - Web
---

# :material-drupal: Drupal

<span class="pill pill-medium">CMS</span> <span class="pill pill-info">web</span>

Drupal powers a lot of government/enterprise sites. The famous wins are the
**Drupalgeddon** RCE chain and abusing admin → PHP module/template execution.

!!! abstract "TL;DR"
    Fingerprint version via `CHANGELOG.txt`/headers → `droopescan` → match a
    Drupalgeddon CVE, or get admin and enable the PHP filter / upload a module.

## :material-magnify: Identify & enumerate

```bash
curl -s http://$TARGET/CHANGELOG.txt | head            # exact version (older sites)
curl -sI http://$TARGET | grep -i x-drupal             # X-Drupal-Cache / -Dynamic-Cache
curl -s http://$TARGET/core/misc/drupal.js             # 8+ present
droopescan scan drupal -u http://$TARGET
# nodes: /node/1 /node/2 ... enumerate content & hidden pages
```

## :material-fire: Known RCE chains

```bash
# Drupalgeddon2 — CVE-2018-7600 (unauth RCE, Drupal 7/8)
# Drupalgeddon3 — CVE-2018-7602    SA-CORE-2019-003 — CVE-2019-6340 (REST RCE)
msf> use unix/webapp/drupal_drupalgeddon2
# metasploit or public PoCs; confirm version first to pick the right one
```

!!! loot "Admin → RCE built in"
    Drupal 7: enable the core **PHP filter** module, create a page with PHP body.
    Drupal 8+: upload a malicious **module** (tarball) or abuse Twig SSTI in
    templates. Admin creds → shell.

## :material-shield-check: Remediation

- Keep core + modules patched (Drupalgeddon is old but still found); remove
  `CHANGELOG.txt`; least-privilege admin; disable PHP filter.

## :material-link-variant: Related

- Fingerprinted at [Web Technologies](index.md) / [Ports](../network/ports.md).
- Twig template abuse → [SSTI](../web/ssti.md); shell → [Linux Privesc](../privesc/linux.md).
- Reference: [droopescan](https://github.com/SamJoan/droopescan), [HackTricks Drupal](https://book.hacktricks.wiki/en/network-services-pentesting/pentesting-web/drupal/index.html).
