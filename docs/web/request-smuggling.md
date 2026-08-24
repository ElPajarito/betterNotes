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

## :material-ruler: How HTTP/1 delimits a request

The whole class of bugs comes from HTTP/1 offering **two** ways to mark where a request body ends, and front-end vs back-end disagreeing on which wins:

- **`Content-Length`** — declares an exact byte length for the body.
- **`Transfer-Encoding: chunked`** — body is one or more chunks: each chunk is its size in **hex**, a newline, then the chunk bytes; the message ends with a zero-size chunk.

```http
POST / HTTP/1.1
Host: $TARGET
Transfer-Encoding: chunked

b
Hello World
0

```

!!! tip "Burp quirks"
    Burp **auto-unpacks** chunked encoding when displaying, so disable that / use the raw view when hand-crafting TE payloads. Browsers rarely send chunked requests — you'll mostly see it in server responses, so these attacks are Repeater/Turbo-Intruder territory.

Reference walkthrough: [jorianwoltjer.com — HTTP Request Smuggling](https://book.jorianwoltjer.com/web/server-side/http-request-smuggling).

## :material-link-variant: Related

- Feeds [Web Cache Poisoning](web-cache-poisoning.md); can bypass [Auth Bypass](auth-bypass.md) controls.
- Reference: [PortSwigger Request Smuggling](https://portswigger.net/web-security/request-smuggling).
