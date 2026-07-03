---
tags:
  - Web
---

# :material-graphql: GraphQL Attacks

<span class="pill pill-medium">modern APIs</span> <span class="pill pill-info">web</span>

GraphQL exposes one flexible endpoint. That flexibility leaks schema, invites deep queries, and often ships with weaker per-field authorization than REST.

!!! abstract "TL;DR"
    First introspect the schema, then hunt for objects you shouldn't reach (IDOR at the field level), mutations without authz, and DoS via nested queries.

## :material-file-tree: Introspection

```graphql
{ __schema { types { name fields { name } } } }
```

If introspection is disabled, try `clairvoyance` to brute the schema, or grep the JS bundle for query names. Load results into **GraphQL Voyager** or **InQL** (Burp).

## :material-account-off: Broken authorization

Query objects directly by ID — per-field authz is often missing:

```graphql
query { user(id: 2) { email passwordHash } }
```

Batch many IDs in one request (an implicit IDOR sweep):

```graphql
{ a: user(id:1){email} b: user(id:2){email} c: user(id:3){email} }
```

## :material-alert-octagon: Query DoS & batching

```graphql
query { posts { author { posts { author { posts { id } } } } } }
```

Deeply nested/circular queries can exhaust the backend. Aliased **query batching** also bypasses rate limits (e.g. brute-forcing OTPs in one HTTP request).

!!! opsec "One request, thousands of ops"
    Batched brute force looks like a single request in logs but hammers the resolver — effective and quiet, but heavy on the DB.

## :material-shield-check: Remediation

- Disable introspection in prod; enforce authorization in every resolver.
- Add query depth/complexity limits and cost analysis; cap batching.

## :material-link-variant: Related

- Field-level IDOR ties back to [Auth Bypass](auth-bypass.md).
- Injection can still hide in resolvers → [SQL Injection](sqli.md).
- Reference: [PortSwigger GraphQL](https://portswigger.net/web-security/graphql).
