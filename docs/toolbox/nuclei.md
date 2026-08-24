---
tags:
  - Reference
---

# :material-radar: Nuclei — templates & DAST

<span class="pill pill-info">tooling</span> <span class="pill pill-info">cheatsheet</span>

Nuclei is a YAML-driven scanner: each template describes a request, a set of matchers, and
what a hit means. The public template set catches the obvious CVEs — the money is in
targeted custom templates and in feeding it a good URL list.

*Command set from "Ultimate Nuclei Templates: Private Collection for Quick Bounties" and "LostFuzzer: Passive URL Fuzzing & Nuclei DAST for Bug Hunters" by [coffinxp](https://medium.com/@coffinxp).*

!!! abstract "TL;DR"
    `cat domains.txt | nuclei -t <template>.yaml` is the whole interface. Point it at a
    curated template ([coffinxp/nuclei-templates](https://github.com/coffinxp/nuclei-templates))
    instead of running everything, tune `-c` / `-rl` so you do not melt the target, and add
    `-dast` for the templates that fuzz parameters rather than probe fixed paths.

## :material-console: Basics

```bash
nuclei -u https://$TARGET                    # single target, default templates
nuclei -l targets.txt                        # list of hosts
cat domains.txt | nuclei -t template.yaml    # stdin — how every recipe below works
nuclei -update-templates                     # refresh the public template set
```

| Flag | Does |
| --- | --- |
| `-t` | Run a specific template (or directory of templates) |
| `-u` / `-l` | Single target / file of targets |
| `-c` | Concurrency — templates run in parallel |
| `-rl` | Rate limit, requests per second |
| `-retries` | Re-send on failure; cuts false negatives on flaky hosts |
| `-dast` | Fuzz the parameters in the supplied URLs (needs URLs *with* query strings) |
| `-severity` | Filter by severity (`critical,high`) |
| `-o` | Write results to a file |
| `-silent` | Findings only, no banner/progress |

!!! tip "`-dast` needs real URLs, not hostnames"
    DAST templates substitute into existing query parameters. Feed them
    `https://$TARGET/x.php?id=1`-shaped URLs — a bare hostname produces nothing. That is
    exactly the gap [LostFuzzer](#lostfuzzer-passive-urls-nuclei-dast) fills.

## :material-file-tree: The template collection

Grouped the way the source article groups them. Everything below lives in
[coffinxp/nuclei-templates](https://github.com/coffinxp/nuclei-templates), which mixes
private templates with organised copies of the default ones.

### Open Redirect

Injects a domain URL across a spread of common redirect parameters and flags the ones that
actually issue the redirect. `--retries 2` matters here — redirect endpoints are frequently
rate-limited or flaky, and a single dropped request is a missed finding.

```bash
cat domains.txt | nuclei -t openRedirect.yaml --retries 2
```

### WP-Setup Disclosure

Looks for a reachable `wp-admin/setup-config.php` — a half-finished WordPress install that
will happily accept database credentials, or leak the ones already configured. Programs
routinely pay P1 for this.

```bash
cat domains.txt | nuclei -t wp-setup-config.yaml
```

### Microsoft IIS Scanner

Detects the IIS short-name (8.3 tilde) condition, which leaks the existence of files and
directories that no wordlist would ever guess — configs, backups, maintenance scripts.

```bash
cat domains.txt | nuclei -t iis.yaml -c 30
```

Once a host flags, enumerate the actual names with
[shortscan](https://github.com/bitquark/shortscan):

```bash
shortscan https://$TARGET -F
```

!!! loot "Short names are a shortcut to the backups"
    8.3 enumeration recovers the first six characters of names you could never brute-force.
    `BACKUP~1.ZIP`, `WEB~1.CONFIG` — then you only have to guess the tail.

### Git Exposure

A `.git` directory left in the webroot hands over source, history, and whatever credentials
were committed and later "removed".

```bash
cat domains.txt | nuclei -t gitExposed.yaml  
```

Then reconstruct the repository with a Git dumper
([GitDump](https://github.com/Ebryx/GitDump) / [git-dumper](https://github.com/arthaud/git-dumper))
— deleted commits included, which is usually where the secrets are.

### CORS Misconfiguration

Flags `Access-Control-Allow-Origin` policies that reflect arbitrary origins, especially in
combination with `Access-Control-Allow-Credentials: true`.

```bash
cat domains.txt | nuclei -t cors.yaml
```

Confirm by hand in Repeater, or with curl — send an attacker origin and read back the CORS
headers:

```bash
curl -H 'Origin: http://example.com' -I https://$TARGET/wp-json/ | grep -i -e 'access-control-allow-origin' -e 'access-control-allow-methods' -e 'access-control-allow-credentials'
curl -H 'Origin: http://example.com' -I https://$TARGET/wp-json/
```

Reflection alone is low impact; reflection **plus credentials** on an authenticated endpoint
is the real bug → [CORS](../web/cors.md).

### Credential Disclosure

A bundle of matchers for exposed secrets — API keys, tokens, passwords in responses and
config files.

```bash
cat domains.txt | nuclei -t  credentials-disclosure-all.yaml -c 30
```

### Blind SSRF

Fires OAST payloads into parameters and waits for the interaction callback, so it catches
the SSRF cases where you never see the response body.

```bash
cat domains.txt | nuclei -t blind-ssrf.yaml -c 30 -dast
```

When one lands, pivot to the response-based SSRF template to pull `/etc/passwd` and other
internal files, and verify with curl before reporting → [SSRF](../web/ssrf.md).

### SQL injection

Error-based SQLi detection: injects into parameters and matches DBMS error strings in the
response. Needs `-dast` because it fuzzes existing query parameters.

```bash
cat domains.txt | nuclei -t errorsqli.yaml -dast
```

Anything it flags goes straight to sqlmap/ghauri for confirmation → [SQL Injection](../web/sqli.md).

### Swagger-UI XSS

Old Swagger UI builds render a remote spec supplied via `?configUrl=`, which is a
DOM XSS primitive. Open the flagged URLs — a popup means vulnerable, no popup means the
version is patched.

When XSS itself is blocked, the same `?configUrl=` sink still loads an attacker-controlled
spec, which is enough for a convincing fake-login phishing page:

```text
https://gist.githubusercontent.com/zenelite123/af28f9b61759b800cb65f93ae7227fb5/raw/04003a9372ac6a5077ad76aa3d20f2e76635765b/test.json
```

Finding Swagger endpoints at scale without nuclei at all:

```bash
subfinder -d domain.txt -all -slent | httpx-toolkit -path /swagger-api/ -sc -content-length -mc 200
```

!!! bug "`-slent` is a typo in the original"
    Current subfinder spells it `-silent`. Fix it if the command errors out — the rest of
    the pipeline is unchanged.

### CRLF injection

Injects encoded carriage-return/line-feed sequences into paths and parameters, looking for
header splitting. `-rl 50` keeps it polite while `-c 30` keeps it fast.

```bash
cat domains.txt | nuclei -t cRlf.yaml -rl 50 -c 30
```

Confirm in Burp, or with curl — if the injected `Set-Cookie` comes back as a real response
header, it is real:

```bash
curl -I "https://$TARGET/%0aSet-Cookie:coffin=hi;"
```

More payload variants → [CRLF Injection](../web/crlf.md).

## :material-pipe: LostFuzzer — passive URLs → nuclei DAST { #lostfuzzer-passive-urls-nuclei-dast }

Nuclei's `-dast` mode is only as good as the URL list you hand it, and the usual generators
are the weak link: ParamSpider-style output puts a `FUZZ` marker in *every* parameter at
once —

```text
http://testphp.vulnweb.com/listproducts.php?artist=FUZZ&cat=FUZZ
```

— which is not a valid query for a scanner that needs to vary one parameter against a real
baseline value. [LostFuzzer](https://github.com/coffinxp/lostfuzzer) is a small bash wrapper
that fixes the input side: pull passive URLs, keep only the ones with genuine query
parameters, verify they are alive, then scan.

### Prerequisites

| Tool | Role |
| --- | --- |
| `gau` | Pulls URLs from passive sources (Wayback, Common Crawl, OTX) |
| `uro` | Collapses duplicate and near-identical URLs |
| `httpx-toolkit` | Filters the list down to live URLs |
| `nuclei` | Runs the DAST scan |

### Installation

```bash
git clone https://github.com/coffinxp/lostfuzzer.git
cd lostfuzzer
chmod +x lostfuzzer.sh
```

### Usage

```bash
./lostfuzzer.sh
```

It prompts for a single target domain or a file of subdomains, then runs the chain:

1. `gau` fetches passive URLs, in parallel across subdomains.
2. Keep only URLs that carry query parameters.
3. `httpx-toolkit` drops everything that is not live.
4. `nuclei` DAST-scans what survives.
5. Results are written out for manual follow-up.

Console output looks like:

```text
[INFO] Fetching URLs with gau...
[INFO] Filtering URLs with query parameters...
[INFO] Checking live URLs using httpx-toolkit...
[INFO] Running Nuclei DAST scan...
[SUCCESS] Results saved in nuclei_results.txt
```

### Output files

| File | Contents |
| --- | --- |
| `filtered_urls.txt` | Live URLs with valid query parameters — the manual-testing queue |
| `nuclei_results.txt` | Findings from the DAST scan |

!!! loot "`filtered_urls.txt` is the real prize"
    The nuclei results are the automated skim; the filtered URL list is a deduplicated map
    of every parameter the target has ever exposed. Grep it for `redirect`, `url`, `file`,
    `path`, `id`, `template`, `debug` and test those by hand.

!!! opsec "Passive first, then active"
    `gau` touches archives, not the target — free and silent. Only the `httpx` liveness
    check and the nuclei scan generate traffic, so build and trim the list before you send
    a single request.

## :material-link-variant: Related

- Content discovery to feed it → [FFUF](ffuf.md).
- Where this sits in the sweep → [Recon](../network/recon.md) and [OSINT](../network/osint.md).
- Secrets in the JS you collect along the way → [JS Recon](../web/js-recon.md).
- Tool picker → [Tool Index](../reference/tools.md).
- Reference: [projectdiscovery/nuclei](https://github.com/projectdiscovery/nuclei), [coffinxp/nuclei-templates](https://github.com/coffinxp/nuclei-templates), [coffinxp/lostfuzzer](https://github.com/coffinxp/lostfuzzer).
