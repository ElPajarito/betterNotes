---
tags:
  - Web
---

# :material-database-refresh: Web Cache Poisoning

<span class="pill pill-hard">mass impact</span> <span class="pill pill-info">web</span>

Trick a shared cache into storing a malicious response, then serve it to every visitor. One request, thousands of victims.

!!! abstract "TL;DR"
    Find an **unkeyed input** (header/param the cache ignores but the app reflects), make it inject a payload, then ensure the poisoned response gets cached on a key others share.

## :material-key-outline: Cache keys & unkeyed inputs

The cache decides "same request?" from the **cache key** (usually method + path + a few headers). Inputs *outside* the key but reflected in the response are the attack surface:

```http
GET /en?cb=1 HTTP/1.1
Host: target.tld
X-Forwarded-Host: evil.tld      ← often unkeyed, often reflected
X-Forwarded-Scheme: nothttps
```

If `X-Forwarded-Host` ends up in an absolute URL / script `src`, you've got stored XSS for everyone hitting that cache key.

## :material-tools: Method (Param Miner)

1. Burp **Param Miner** → "Guess headers" to find unkeyed inputs.
2. Confirm reflection into a cacheable response.
3. Verify the response is cached (`X-Cache: hit`, `Age:`), then poison a real path.

## :material-vector-combine: Cache deception too

Request `/{account}/wallet.css` — the app serves the wallet page, the cache stores it as a "static" file, and you read another user's cached private page.

!!! opsec "Blast radius is huge"
    Poisoning a shared edge cache affects *all* users of that key. On engagements, poison a benign, low-traffic path to prove impact.

## :material-shield-check: Remediation

- Include every response-affecting input in the cache key, or don't reflect it.
- Cache only truly static content; strip hop-by-hop headers at the edge.

## :material-link-variant: Related

- Reflected input often comes from [XSS](xss.md); desync via [Request Smuggling](request-smuggling.md).
- Reference: [PortSwigger Web Cache Poisoning](https://portswigger.net/web-security/web-cache-poisoning).
