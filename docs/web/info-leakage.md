---
tags:
  - Web
---

# :material-information-outline: Information Leakage

<span class="pill pill-easy">recon</span> <span class="pill pill-info">web</span>

**Information leakage** is the app handing you data it shouldn't: secrets in JavaScript bundles, keys in error pages, `.env` files, debug endpoints, verbose stack traces. It rarely stands alone in a report but frequently *unlocks* the finding that does.

!!! abstract "TL;DR"
    Grep everything the client downloads (especially JS) for secret-shaped strings, and probe for exposed config/dotfiles. A leaked API key, internal hostname, or `.env` is often the whole chain.

## :material-magnify: JS & source secret hunting

- [ ] Grep responses/bundles for strings like `key`, `password`, `credential`, `rsa`, `secret`, `config`, `token`, `apikey`, `authorization`.
- [ ] Open the target in Burp, browse as a normal user, then in **Proxy history filter to JS files only**.

Search inside JS for these filename/keyword stems — they flag the files most likely to hold config and endpoints:

```text
main   app    runtime   bundle
polyfills   auth   config   settings
local  dev    data   api
session   user   core   client
server   utils   base
```

!!! tip "Automate it"
    Pull every JS file and run [`trufflehog`](https://github.com/trufflesecurity/trufflehog) / `gitleaks` / a custom regex sweep. `linkfinder` and `secretfinder` extract endpoints and keys from bundles; sourcemaps (`.js.map`) can reconstruct original source.

## :material-folder-search: Exposed config & dotfiles

A `401`/`403` on a directory doesn't mean the files under it are protected — enumerate deeper:

```text
/backend            -> 401
/backend/app        -> 401
/backend/app/.env.dev -> 200   <-- leaks
```

Probe list to fuzz:

```text
.env  .env.dev  .env.prod  .env.local
.git/config  .git/HEAD  .svn/entries
config.php  config.json  appsettings.json  web.config
docker-compose.yml  Dockerfile  .DS_Store
backup.zip  db.sql  *.bak  *.old  *.swp
/actuator/env  /actuator/heapdump   (Spring Boot)
/debug  /trace  /server-status  /phpinfo.php
```

## :material-alert: Other leak sources

- **Verbose errors / stack traces** — reveal framework versions, file paths, SQL, internal IPs.
- **HTTP response headers** — `Server`, `X-Powered-By`, `X-AspNet-Version`, internal `Via`/`X-Forwarded-*`.
- **Comments in HTML/JS** — dev notes, disabled endpoints, credentials.
- **Metadata** — EXIF in uploaded images, author/path data in generated PDFs/Office docs.
- **`.git` exposure** — dump the repo with `git-dumper` to recover full source + history secrets.

## :material-link-variant: Related

- Leaked creds feed [Account Takeover](account-takeover.md) and [Auth Bypass](auth-bypass.md).
- Path/dotfile exposure overlaps with [LFI / Path Traversal](path-traversal.md).
- Reference: [OWASP — Information exposure](https://owasp.org/www-community/Improper_Error_Handling).
