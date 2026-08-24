---
tags:
  - Web
---

# :material-identifier: Insecure Direct Object Reference (IDOR)

<span class="pill pill-medium">access control</span> <span class="pill pill-info">web</span>

**IDOR** is broken object-level authorization: the app exposes a reference to a resource (an ID, filename, UUID) and fails to check that *you* are allowed that specific object. Swap the reference, get someone else's data.

!!! abstract "TL;DR"
    Find any request carrying an object reference (`?id=123`, `/user/123`, a filename). Change it to a value you shouldn't own and see if the response still comes back. If it does, that's an IDOR.

## :material-magnify: Where to hunt

Don't forget to try IDOR exploitation across these path shapes — the same object often appears under several of them:

=== "User / profile"

    ```text
    /api/user/123
    /api/users/123
    /api/v1/user?id=123
    /api/profile/123
    /api/v1/account/123
    /user?id=123
    /profile?uid=123
    /account?user=123
    /customer?id=123
    /member?id=123
    ```

=== "Documents / files"

    ```text
    /api/document/123
    /api/v1/file?id=123
    /api/files/123/download
    /api/v2/resource/123
    /api/attachments/123
    /download?file=123.pdf
    /document?id=123
    /invoice?id=123
    /receipt?id=123
    /contract?id=123
    ```

=== "Orders / transactions"

    ```text
    /api/order/123
    /api/orders?id=123
    /api/v1/transaction/123
    /api/payment/123
    /api/v2/invoice?id=123
    /order?id=123
    /cart?id=123
    /purchase?item=123
    /payment?id=123
    /transaction?id=123
    ```

=== "Tickets / support"

    ```text
    /api/tickets/123
    /api/v1/helpdesk/123
    /api/support?id=123
    /api/issues/123
    /api/v2/case/123
    /ticket?id=123
    /helpdesk?case=123
    /support?id=123
    /issue?id=123
    ```

## :material-tools: Testing method

1. Log in as **two** accounts (A and B). Capture A's request for an object A owns.
2. Replace the identifier with B's object ID (or a neighbouring value) while keeping **A's session**.
3. If A gets B's data → IDOR. Automate ID sweeps with Burp Intruder / `ffuf`.

!!! tip "Don't stop at the obvious parameter"
    The juicy IDOR is frequently on a **secondary** object reference, not the primary one in the URL — a nested `accountId` in a JSON body, a `fileId` on an export/download endpoint, a `tenantId` header. Bulk export, "download all", and report-generation endpoints are classic: they reference another tenant's resource by ID and skip the ownership check the main view enforces.

!!! bug "Won't budge? Try these"
    - **Sequential IDs replaced by UUIDs?** They still leak — collect UUIDs from other responses (listings, emails, autocomplete) and reuse them.
    - **Method swap** — a `GET` may be locked down while `PUT`/`DELETE`/`PATCH` on the same path isn't.
    - **Wrap the value** — send `id[]=123`, `id=123.json`, or a JSON array where a scalar was expected; parameter-type confusion can skip the check.
    - **Encode / add extensions** — `%2e`, trailing `/`, `.pdf`, or a duplicate parameter (`id=mine&id=theirs`).

## :material-link-variant: Related

- Overlaps with [Auth Bypass](auth-bypass.md) and [Account Takeover](account-takeover.md).
- API object refs pair with [GraphQL](graphql.md) node/global-ID abuse.
- Reference: [PortSwigger IDOR / access control](https://portswigger.net/web-security/access-control/idor).
