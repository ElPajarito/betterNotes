---
tags:
  - Web
---

# :material-call-split: HTTP Request Smuggling

<span class="pill pill-hard">front-end bypass</span> <span class="pill pill-info">web</span>

When a front-end proxy and back-end server disagree on where one request ends, you can smuggle a second request that the back-end attributes to the *next* user.

!!! abstract "TL;DR"
    Desync by sending both `Content-Length` and `Transfer-Encoding`, obfuscating one so the two servers parse boundaries differently (CL.TE / TE.CL).

## :material-vector-difference: The classic variants

=== "CL.TE"

    Front-end uses `Content-Length`, back-end uses `Transfer-Encoding`.
    ```http
    POST / HTTP/1.1
    Content-Length: 6
    Transfer-Encoding: chunked

    0

    G
    ```

=== "TE.CL"

    Front-end uses `Transfer-Encoding`, back-end uses `Content-Length`. Obfuscate the TE header so the front-end ignores it:
    ```http
    Transfer-Encoding: chunked
    Transfer-Encoding : x
    ```

## :material-flask: Detect

Use Burp's **HTTP Request Smuggler** (timing technique) — it sends a crafted request and measures a back-end delay that only a desync explains.

## :material-target: Impact

- Bypass front-end access controls to reach internal paths.
- Poison the response queue → capture another user's request/credentials.
- Chain into [web cache poisoning](web-cache-poisoning.md) for stored, mass impact.

!!! opsec "You can hit real users"
    Smuggling can serve *other people's* traffic to you and vice-versa — be careful on production; you can break sessions.

## :material-shield-check: Remediation

- Normalize/reject ambiguous requests at the edge; use HTTP/2 end-to-end.
- Reject messages with both `CL` and `TE`; disable connection reuse to the back-end.

## :material-link-variant: Related

- Feeds [Web Cache Poisoning](web-cache-poisoning.md); can bypass [Auth Bypass](auth-bypass.md) controls.
- Reference: [PortSwigger Request Smuggling](https://portswigger.net/web-security/request-smuggling).
