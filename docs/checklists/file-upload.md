---
tags:
  - Web
  - Reference
---

# :material-file-upload-outline: File Upload Checklist

<span class="pill pill-hard">→ RCE</span> <span class="pill pill-info">web</span>

Run this against every upload the app has — avatars, documents, imports, support
attachments, profile backgrounds. The interesting ones are rarely the obvious ones.

!!! abstract "TL;DR"
    Beat the validation (extension, MIME, magic bytes, size), control where it
    lands (path traversal in the filename), and make the server or a downstream
    consumer *execute* or *parse* what you sent.

## :material-shield-off: Beat the validation

- [ ] Blocked extension → `.phtml` `.php5` `.phar` `.pht` `.asa` `.cer` `.jspx` `.aspx.`
- [ ] **Double extension** — `shell.php.jpg`, `shell.jpg.php`
- [ ] **Null byte / trailing chars** — `shell.php%00.jpg`, `shell.php.`, `shell.php `
- [ ] **Case** — `.pHp`, `.PhP`
- [ ] **`Content-Type` only** — keep the malicious extension, send `image/jpeg`
- [ ] **Magic bytes only** — prepend `GIF89a;` or a real JPEG header to a script
- [ ] Both at once — a **polyglot** that is a valid image *and* a valid script
- [ ] Client-side-only validation — intercept and change after the JS check passes
- [ ] Size limits enforced client-side only

## :material-folder-move: Control the destination

- [ ] **Path traversal in the filename** — `../../../var/www/html/shell.php`
- [ ] Traversal in a **separate path/folder parameter**
- [ ] **Overwrite** an existing file — `.htaccess`, `web.config`, a config or a key
- [ ] Upload a **`.htaccess`** that maps a benign extension to the PHP handler
- [ ] Upload **`web.config`** on IIS for the same effect
- [ ] Archive traversal — a **zip slip** entry named `../../shell.php`
- [ ] Symlink inside an archive pointing at `/etc/passwd`

## :material-file-code: Make something parse it

- [ ] **SVG** → [XXE](../web/xxe.md) and stored [XSS](../web/xss.md)
- [ ] **XML / DOCX / XLSX** → XXE via the embedded XML
- [ ] **CSV / XLSX** → [formula injection](../web/spreadsheet-injection.md), client- *and* server-side
- [ ] **HTML / SVG served same-origin** → stored XSS
- [ ] **Image resize / convert** → ImageMagick and Ghostscript command execution
- [ ] **PDF/HTML renderer** → [SSRF and local file read](../web/ssrf.md)
- [ ] **Filename itself** reflected into a page → XSS in the filename
- [ ] **Zip bomb / decompression bomb** where an archive is expanded

## :material-eye: Where does it go, and who can reach it

- [ ] Find the stored URL — is it guessable, or [IDOR](../web/idor.md)-able?
- [ ] Is it served from the **same origin** (XSS matters) or a sandbox domain?
- [ ] Is it served with `Content-Disposition: attachment` or inline?
- [ ] Does it land in a **cloud bucket** — check ACLs and for a public listing → [cloud](../cloud/index.md)
- [ ] Is the file **scanned** or processed by another service you can reach?
- [ ] Does the response leak an internal path or storage key?

## :material-link-variant: Related

- Parent list → [Web Pentest Checklist](web.md).
- Attack pages: [File Upload](../web/file-upload.md) · [XXE](../web/xxe.md) · [Path Traversal](../web/path-traversal.md) · [Spreadsheet Injection](../web/spreadsheet-injection.md).
