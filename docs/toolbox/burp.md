---
tags:
  - Web
  - Reference
---

# :material-fingerprint: Burp Suite Tips

<span class="pill pill-info">tooling</span>

The tricks that actually speed up web testing — not a manual, just the high-value
shortcuts and extensions.

!!! abstract "TL;DR"
    Learn the hotkeys, send everything to Repeater/Intruder fast, and install the
    handful of extensions below. Match/Replace + scope rules keep the noise down.

## :material-keyboard: Hotkeys worth memorizing

| Keys | Action |
| --- | --- |
| ++ctrl+r++ | Send request to **Repeater** |
| ++ctrl+i++ | Send request to **Intruder** |
| ++ctrl+shift+r++ | Switch to Repeater tab |
| ++ctrl+space++ | Send request (in Repeater) |
| ++ctrl+u++ / ++ctrl+shift+u++ | URL-encode / -decode selection |
| ++ctrl+b++ / ++ctrl+shift+b++ | Base64 encode / decode selection |
| ++ctrl+f++ | Forward intercepted request |

## :material-puzzle: Preferred extensions

```text
# From the BApp Store — the ones that pay for themselves:
Autorize            # broken access control / IDOR (auth matrix testing)
Logger++            # searchable log of ALL traffic across tools
Param Miner         # hidden params + web-cache-poisoning discovery
Turbo Intruder      # high-speed, scriptable requests (race conditions!)
Active Scan++       # extra active-scan checks
JS Miner / JS Link Finder   # secrets + endpoints in JavaScript
Collaborator Everywhere     # injects OAST payloads into every request
Hackvertor          # inline encoding/encryption tags
InQL                # GraphQL introspection + query building
```

## :material-cog: Workflow tips

- **Scope first** — set target scope, then "show only in-scope" so Proxy/Logger
  stay clean.
- **Match & Replace** (Proxy → Options) to auto-inject headers (e.g. a fixed
  `Authorization`, or `X-Forwarded-For`).
- **Intruder attack types:** Sniper (one param), Cluster bomb (cred combos),
  Pitchfork (paired lists). For speed/races use **Turbo Intruder**.
- **Autorize** — log in as low-priv, replay high-priv requests → instant access
  -control matrix → [IDOR/auth bypass](../web/auth-bypass.md).
- **Save the project file** on real engagements; export sitemap for the report.

!!! tip "Community vs Pro"
    Intruder is throttled in Community — **Turbo Intruder** (free extension) sidesteps
    that and is better for [race conditions](../web/race-conditions.md) anyway.

## :material-link-variant: Related

- The proxy behind all of [Web Apps](../web/index.md); checklist → [Web Pentest Checklist](../checklists/web.md).
- Reference: [PortSwigger docs](https://portswigger.net/burp/documentation).
