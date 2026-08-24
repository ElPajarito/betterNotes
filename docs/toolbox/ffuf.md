---
tags:
  - Reference
---

# :material-magnify-expand: FFUF — Web Fuzzing

<span class="pill pill-info">tooling</span> <span class="pill pill-info">cheatsheet</span>

`ffuf` is the Go fuzzer that replaced dirb/gobuster for most people: one binary, the
`FUZZ` keyword goes anywhere in the request (path, query, body, header, Host), and the
filters are good enough to make a 400k-word list readable.

*Command set from "FFUF Mastery: The Ultimate Web Fuzzing Guide" by [coffinxp](https://medium.com/@coffinxp).*

!!! abstract "TL;DR"
    `FUZZ` is a placeholder — put it wherever you want words substituted. Point `-w` at a
    list, then spend your time on the **filters** (`-fc`/`-fs`/`-fw`/`-fl`) until the noise
    is gone. Everything else — recursion, vhosts, params, clusterbomb — is the same command
    with `FUZZ` moved somewhere else.

## :material-download: Install

```bash
apt install ffuf
```

Debian-based systems. Otherwise grab the binary from
[ffuf/ffuf](https://github.com/ffuf/ffuf) or `go install`.

## :material-folder-search: Content discovery

### Directory and file brute force

The bread-and-butter run: `-u` sets the target URL, `-w` the wordlist, and `FUZZ` marks the
spot each word gets substituted into.

```bash
ffuf -u https://$TARGET/FUZZ -w wordlist.txt
```

### POST request with wordlist

Same path fuzzing, but every request is a `POST` — useful when the app routes differently
by method, or when `GET` on a hidden endpoint returns 405.

```bash
ffuf -w wordlist.txt -u https://$TARGET/FUZZ -X POST
```

### Case-insensitive matching

`-ic` ignores case (handy against IIS or anything you suspect of case-insensitive routing);
`-c` colourises the output.

```bash
ffuf -u https://$TARGET/FUZZ -w wordlist.txt -ic -c
```

### File-extension fuzzing

`-e` appends each extension to every word. Note the `FUZZ` position here — it is glued to
`index`, so this fuzzes *around* a known filename as well as extending it.

```bash
ffuf -u https://$TARGET/indexFUZZ -w wordlist.txt -e .php,.asp,.bak,.db
```

`.bak` / `.db` / `.old` are where the source and the credentials live — always include them.

### Recursive fuzzing

`-recursion` queues every discovered directory as a new fuzz root; `-recursion-depth`
caps how far it will chase.

```bash
ffuf -u https://$TARGET/FUZZ -w wordlist.txt -recursion -recursion-depth 3
```

!!! tip "Recursion multiplies request count"
    Depth 3 on a medium list is millions of requests. Pair it with a small list, or with
    `-rate` (below), unless you want to be the reason the target falls over.

### Filtering responses

Filters drop matches, matchers keep them. Start by filtering the status codes the app
returns for "nothing here".

```bash
ffuf -w wordlist.txt -u https://$TARGET/FUZZ -fc 404,500
```

### Multi-wordlist fuzzing

Name your keywords with `wordlist.txt:KEYWORD` and you can drive several positions at once —
here `W1` and `W2` are two independent path segments fed by two different lists.

```bash
ffuf -u https://$TARGET/W2/W1/ -w dict.txt:W1 -w dns_dict.txt:W2
```

## :material-dns: Subdomain and virtual-host fuzzing

### Subdomain fuzzing

`FUZZ` in the hostname resolves and requests each candidate — this only finds subdomains
that actually have DNS records.

```bash
ffuf -w subdomains.txt -u https://FUZZ.$TARGET/
```

### Virtual host (vhost) fuzzing

Fuzzing the `Host` header instead hits the *same* IP every time, so it finds vhosts with no
public DNS at all — internal panels, staging, `admin.`/`test.` leftovers.

```bash
ffuf -w vhosts.txt -u https://$TARGET/ -H "Host: FUZZ.$TARGET"
```

!!! loot "Vhosts are where the unauthenticated admin panels hide"
    A vhost with no DNS record was never meant to be reachable from outside, so it is often
    missing the auth layer the public site has. Filter on response size (`-fs`) against the
    default vhost's baseline, otherwise every word "matches".

## :material-code-braces: Fuzzing HTTP parameters

### GET parameters

`FUZZ` as the parameter *name* mines for hidden query params — debug flags, `admin=1`,
unlinked features.

```bash
ffuf -w wordlist.txt -u https://$TARGET/page.php?FUZZ=value
```

### POST parameters

Same idea in the body with `-d`. This is the fastest way to map an undocumented API or
find the extra field a login form accepts.

```bash
ffuf -w wordlist.txt -u https://$TARGET/api -X POST -d 'FUZZ=value'
```

### POST request fuzzing (login bypass)

Move `FUZZ` to the *value* side and it becomes a password brute-forcer against the login
endpoint.

```bash
ffuf -w passwordlist.txt -X POST -d "username=admin&password=FUZZ" -u https://$TARGET/login
```

### PUT request fuzzing

Fuzzing with `PUT` and an authenticated session cookie (`-b`) tests for write primitives —
unauthorised file upload or modification on paths that only reject `GET`.

```bash
ffuf -w /path/to/wordlist.txt -X PUT -u https://$TARGET/FUZZ -b 'session=abcdef'
```

## :material-tune: Advanced modes

### Clusterbomb mode

Every word from list A against every word from list B — the credential-stuffing shape.
`-request` replays a saved raw request (straight out of Burp), `-request-proto` sets the
scheme for it.

```bash
ffuf -request req.txt -request-proto http -mode clusterbomb -w usernames.txt:HFUZZ -w passwords.txt:WFUZZ
```

The same thing driven from a URL instead of a saved request file:

```bash
ffuf -w users.txt:USER -w passwords.txt:PASS -u https://$TARGET/login?username=USER&password=PASS -mode clusterbomb
```

### Pitchfork mode

Pitchfork walks both lists **in lockstep** — line 1 with line 1, line 2 with line 2. Use it
when you already have paired data (a leaked user:pass dump) rather than a cross-product.

```bash
ffuf -w users.txt:USER -w passwords.txt:PASS -u https://$TARGET/login?username=USER&password=PASS -mode pitchfork
```

### Setting cookies

`-b` attaches cookies, so you fuzz as an authenticated user and see everything behind the
login.

```bash
ffuf -b "SESSIONID=abcd1234; USER=admin" -w wordlist.txt -u https://$TARGET/FUZZ
```

### Using proxies

`-x` routes everything through an upstream proxy — point it at Burp and every hit lands in
your history, ready for Repeater.

```bash
ffuf -x http://127.0.0.1:8080 -w wordlist.txt -u https://$TARGET/FUZZ
```

!!! tip "Proxying kills throughput"
    Burp is the bottleneck, not ffuf. Proxy a short confirmation run, not the 200k-word
    discovery sweep.

### Custom header fuzzing

`FUZZ` inside a header value fuzzes the header itself — good for hunting header-driven
access control and debug toggles.

```bash
ffuf -w headers.txt -u https://$TARGET/ -H "X-Custom-Header: FUZZ"
```

Related trick: header games are also the core of [403 bypasses](../web/403-bypass.md)
(`X-Forwarded-For`, `X-Original-URL`, …).

### Custom User-Agent

A real browser UA slips past naive WAF/bot rules and stops you showing up in logs as
`Fuzz Faster U Fool`.

```bash
ffuf -u "https://$TARGET/FUZZ" -w wordlist.txt -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
```

### Rate limiting

`-rate` caps requests per second, `-t` caps concurrent threads. Turn both down when the
target starts 429-ing or the results go uniformly weird.

```bash
ffuf -w wordlist.txt -u https://$TARGET/FUZZ -rate 50 -t 50
```

!!! opsec "Default threads are loud"
    ffuf defaults to 40 threads and no rate cap — enough to trip WAFs, exhaust connection
    pools, and get your IP banned mid-engagement. On bug bounty scope, throttle first.

### Output options

HTML, JSON, CSV, and more via `-of`.

```bash
ffuf -w wordlist.txt -u https://$TARGET/FUZZ -o results.html -of html
```

`-of -all` writes every supported output format at once.

## :material-keyboard: Flags worth memorising

| Flag | Does |
| --- | --- |
| `-u` / `-w` | Target URL / wordlist (`-w list.txt:KEYWORD` to name it) |
| `-X` / `-d` | HTTP method / request body |
| `-H` / `-b` | Add header / add cookies |
| `-e` | Append extensions to each word |
| `-recursion` / `-recursion-depth` | Follow discovered dirs, capped at N levels |
| `-mc` | **Match** status codes (keep only these) |
| `-fc` | **Filter** status codes (drop these) |
| `-fs` | Filter by response size — the vhost/param workhorse |
| `-fw` | Filter by word count |
| `-fl` | Filter by line count |
| `-ic` / `-c` | Ignore case / colourise output |
| `-t` / `-rate` | Threads / requests per second |
| `-x` | Upstream proxy (Burp) |
| `-mode` | `clusterbomb` / `pitchfork` for multi-list attacks |
| `-request` / `-request-proto` | Replay a raw saved request, set its scheme |
| `-o` / `-of` | Output file / format (`html`, `json`, `csv`, `-all`) |

!!! bug "Everything returns 200"
    SPA and catch-all routers answer 200 with the same soft-404 body for every path. Status
    filtering is useless there — grab one known-bad response, note its size/words/lines, and
    filter that instead: `-fs <baseline>` or `-fw <baseline>`.

## :material-format-list-bulleted: Wordlists

The list matters more than the flags. [SecLists](https://github.com/danielmiessler/SecLists)
is the default answer; coffinxp's [payloads](https://github.com/coffinxp/payloads) repo
collects bug-bounty-oriented lists. Picking the right one per job →
[Wordlist Reference](../reference/wordlists.md).

## :material-link-variant: Related

- Which list for which job → [Wordlist Reference](../reference/wordlists.md).
- Fitting fuzzing into the wider sweep → [Recon](../network/recon.md).
- When discovery finds a 403 → [403 Bypass](../web/403-bypass.md).
- Templated scanning of what you find → [Nuclei](nuclei.md).
- Reference: [ffuf/ffuf](https://github.com/ffuf/ffuf).
