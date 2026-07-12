---
tags:
  - Web
  - Recon
---

# :material-graphql: GraphQL (Enumeration)

<span class="pill pill-easy">discovery</span> <span class="pill pill-info">web</span>

Finding and mapping the GraphQL surface before you attack it: locate the endpoint,
fingerprint the engine, and dump the schema. Once you have the map, the attacks
(field-level IDOR, batching, DoS) live in [GraphQL Attacks](../web/graphql.md).

!!! abstract "TL;DR"
    Find the endpoint (`/graphql`, `/api/graphql`, …) → confirm it's GraphQL →
    fingerprint the engine (`graphw00f`) → pull the schema via introspection, or
    recover it with `clairvoyance` / field-suggestions when introspection is off.

## :material-magnify: Find the endpoint

```bash
# Common paths — fuzz them
for p in graphql graphql/console graphql/v1 graphql/v2 api/graphql v1/graphql \
         graphiql playground query index.php?graphql gql; do
  curl -s -o /dev/null -w "%{http_code}  /$p\n" "http://$TARGET/$p"
done
# A GraphQL endpoint answers a bad query with a structured error
curl -s http://$TARGET/graphql -H 'Content-Type: application/json' -d '{"query":"{__typename}"}'
#   {"data":{"__typename":"Query"}}   <- confirmed GraphQL
```

Also check the JS bundle for hardcoded endpoints and query strings
(`grep -oE '/[a-z/]*graphql'`), and look for `GraphiQL`/`Playground` IDE pages.

## :material-fingerprint: Fingerprint the engine

Knowing the implementation tells you which quirks/CVEs apply (Apollo, Hasura,
graphql-ruby, Graphene, etc.):

```bash
graphw00f -d -f -t http://$TARGET/graphql       # detect + fingerprint engine
nuclei -u http://$TARGET -tags graphql
```

## :material-file-tree: Introspection — dump the schema

```bash
# Full introspection query (the whole schema in one request)
curl -s http://$TARGET/graphql -H 'Content-Type: application/json' \
  -d '{"query":"query{__schema{types{name kind fields{name args{name type{name}}}}}}"}' | jq .
```

- Load the result into **InQL** (Burp), **GraphQL Voyager**, or **Altair** to
  browse types, queries, and mutations visually.
- `graphql-cop http://$TARGET/graphql` — quick audit (introspection on? batching?
  field suggestions? CSRF?).

!!! loot "Introspection = the full API map"
    Every type, query, mutation, and argument — including admin-only mutations and
    objects the UI never calls. This is your target list for
    [field-level IDOR and unauthorized mutations](../web/graphql.md).

## :material-lightbulb-off: When introspection is disabled

```bash
# Recover the schema by brute force + field suggestions
clairvoyance http://$TARGET/graphql -o schema.json -w graphql-wordlist.txt
```

!!! tip "Field suggestions leak names even with introspection off"
    Many engines reply to a typo with *"Did you mean `email`?"*. `clairvoyance`
    weaponises these suggestion errors to rebuild the schema without introspection.
    If even suggestions are disabled, grep the front-end JS for operation names.

## :material-shield-check: Remediation

- Disable introspection **and** field suggestions in production; don't ship
  GraphiQL/Playground; require auth on the endpoint.

## :material-link-variant: Related

- Now attack it → [GraphQL Attacks](../web/graphql.md) (IDOR, batching, DoS).
- Reached here from [Web Technologies](index.md) / [Ports](../network/ports.md); API context → [Web Apps](../web/index.md).
- Reference: [graphw00f](https://github.com/dolevf/graphw00f), [clairvoyance](https://github.com/nikitastupin/clairvoyance), [InQL](https://github.com/doyensec/inql).
