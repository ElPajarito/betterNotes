---
tags:
  - Web
---

# :material-map-marker-radius: ArcGIS

<span class="pill pill-medium">GIS platform</span> <span class="pill pill-info">web</span> <span class="pill pill-info">esri</span>

Esri **ArcGIS Enterprise** (Portal for ArcGIS + ArcGIS Server) exposes a large,
lightly-authenticated REST surface. Many admin, sharing, and community endpoints
leak data — internal IPs, user directories, DB connection info — and older builds
carry XSS and broken-access-control bugs. Fingerprint the version first: the useful
endpoints differ by release.

!!! abstract "TL;DR"
    Confirm the version → hit the unauthenticated REST/sharing endpoints for user
    enum, internal IPs and DB leaks → test admin panels and known XSS on the build
    you found.

## :material-magnify: Fingerprint & version

```text
/arcgis/help/en/
/arcgis/rest/services
/arcgis/rest/info
/portal/sharing/
/arcgis/manager/authorization.html
```

## :material-view-dashboard: Admin panels

```text
/portal/portaladmin/
/arcgis/admin/login
```

## :material-database-eye: Data & credential leaks

Admin data endpoints can enumerate managed databases and their connection strings
when a token is in scope:

```text
/arcgis/admin/data/findItems?managed=true&f=json&token=<TOKEN>
/arcgis/admin/system/webadaptors?f=json&token=<TOKEN>
```

## :material-ip-network: Internal IP disclosure

```text
/portal/sharing/geoip.jsp
/arcgis/admin/system/webadaptors?f=json&token=<TOKEN>
```

## :material-account-off: Broken access control

Several sharing/admin routes return sensitive org data without proper authz:

```text
/arcgis/services?wsdl
/portal/sharing/rest/portals
/portal/sharing/rest/portals/self
/portal/sharing/rest/community/groups
/portal/sharing/rest/content/listings
/portal/home/troubleshoot.html
```

!!! loot "portals/self leaks org + session context"
    `/arcgis/sharing/rest/portals/self?culture=pt-pt&f=json&token=<TOKEN>` can
    disclose the session identifier and full org configuration on older builds
    (seen on Portal for ArcGIS 10.3.1).

## :material-account-search: Active Directory / user enumeration

The community users endpoint supports wildcard search — a single `a*` returns
**every** user whose name starts with `a`:

```text
/arcgis/sharing/rest/community/users/?q=a*&sortField=&sortOrder=&f=json&num=100
```

Other per-user leaks:

```text
/portal/sharing/rest/community/users/<user>/forgotPassword
/portal/sharing/community/users/<user>
/portal/home/user.html?user=<user>
/portal/home/troubleshoot.html
```

## :material-bug: Known client-side bugs

<span class="pill pill-medium">version-dependent</span>

- **Reflected XSS via `X-Forwarded-Host`** (API 7.1, `/portal/sharing/*`) — the
  header is reflected unescaped into responses.
- **Stored XSS** (Portal for ArcGIS 10.8) — item `url`, `title`, and `tags` fields.
  The `tags` sink needs a non-standard encoder such as
  [JSFuck](http://www.jsfuck.com/) to survive filtering.

## :material-link-variant: Related

- Fingerprinted at [Web Technologies](index.md) / [Ports](../network/ports.md).
- Header-reflected XSS mechanics → [XSS](../web/xss.md); data leaks feed
  [Password Spraying](../network/password-spraying.md).
- Reference: [Esri ArcGIS Enterprise security](https://enterprise.arcgis.com/en/portal/latest/administer/windows/best-practices-for-configuring-a-secure-environment.htm).
