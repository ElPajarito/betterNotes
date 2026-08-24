---
tags:
  - Recon
---

# :material-language-javascript: JS Recon — secrets in JavaScript files

<span class="pill pill-easy">start here</span> <span class="pill pill-info">recon</span> <span class="pill pill-info">web</span>

Every single-page app ships its own map of the backend to the browser. Bundlers inline route tables, API base URLs, feature flags, and — regularly — credentials that were never meant to leave the build server. The files are public by definition, so reading them costs nothing and skips straight past authentication.

*Technique set from "How to Identify Sensitive Data in JavaScript Files: (JSRecon)" by [coffinxp](https://medium.com/@coffinxp).*

!!! abstract "TL;DR"
    Collect every `.js` URL the target serves (crawl actively with `katana`, passively with `gau`), filter to live files with `httpx`, then run `jsleaks`, `nuclei`, and `lazyegg` over the list to pull out secrets, hidden endpoints, internal hosts, and leaked credentials.

## :material-file-search-outline: Why JS bundles leak

A production bundle routinely contains:

- **Endpoints** — internal API routes that never appear in the site's navigation, including admin-only ones the UI hides but the router still knows about.
- **API keys** — third-party service tokens (maps, analytics, payments, cloud SDKs) that were dropped into a client-side config because "it's only frontend".
- **Internal hosts** — staging domains, internal load balancers, S3 bucket names, private subdomains referenced by dead code paths.
- **Comments and source maps** — developer notes, TODOs, and `.map` files that reconstruct the original unminified source.

Hidden endpoints found here feed straight into [IDOR](idor.md), [SSRF](ssrf.md), and access-control testing; keys and internal hostnames feed [Information Leakage](info-leakage.md) reports.

## :material-eye-outline: Manual inspection

The zero-tooling version, useful for a first look at a single page:

1. Open the target page and hit ++ctrl+u++ to view source.
2. ++ctrl+f++ and search for `.js` to enumerate every script the page pulls in.
3. Click through to the JavaScript URLs — they carry far more data than the page itself, and some of it is sensitive.
4. Search inside each file for keywords like `api`, `token`, `password`, `jwt`, or `secret`. Anything that hits is a lead worth chasing into a demonstrable impact before reporting.

## :material-puzzle: Browser extensions

### LazyEgg (collection)

The [LazyEgg extension](https://chromewebstore.google.com/) removes the click-every-script step:

- Install LazyEgg from the Chrome Web Store.
- Visit the target site, refresh, click the extension — it extracts every `.js` URL the page loaded.
- Copy the collected URLs into a multiple-URL-opener extension so all the JavaScript endpoints load at once.
- Search across the opened files for `api`, `token`, `password`, `jwt`, `secret`.

This still gets slow once a page loads dozens of bundles — that's the cue to move to the command line.

### EndPointer (endpoint parsing)

Where LazyEgg collects files, [EndPointer](https://chromewebstore.google.com/detail/endpointer/ppliilneafplhagjhhphcjmjdmbjagcp) parses them for routes:

- Install the EndPointer extension.
- Toggle the **auto-parser** button on and refresh the page — EndPointer analyses the page and every linked JavaScript file.
- Open the extension and press the **panel** button to view all detected endpoints, filterable by source and by page.
- Use the built-in search for `secret`, `API`, `jwt token`, `keys`, `passwords`. Matching endpoints come with request and response details for follow-up.

## :material-console: Command-line workflow

The scalable version. Each step narrows the corpus before the expensive analysis runs.

### Active crawling — katana

Crawl the live site and keep only JavaScript:

```bash
katana -u samsung.com -d 5 -jc | grep '\.js$' | tee alljs.txt
```

- `-u samsung.com` — target URL or domain to scan.
- `-d 5` — crawl depth of 5, following links up to five levels deep.
- `-jc` — JavaScript crawling; focus on discovering JavaScript-related resources.
- `grep '\.js$'` — keep only lines ending in `.js`.
- `tee alljs.txt` — write to `alljs.txt` while still printing to the terminal.

### Passive crawling — gau

Add everything the archives already know about, without touching the target:

```bash
echo www.samsung.com | gau | grep '\.js$' | anew alljs.txt
```

- `gau` — collects known URLs for the domain from the Wayback Machine, Common Crawl, AlienVault OTX and other public archives.
- `grep '\.js$'` — keep only URLs ending in `.js`.
- `anew alljs.txt` — append to `alljs.txt`, deduplicating so only unique entries land in the file.

!!! tip "Passive catches what crawling can't"
    Archived URLs include old bundles, retired build hashes, and files the current SPA no longer references. Dead JS often still resolves — and often predates the commit that removed the hardcoded key.

### Refining — httpx

Probe the combined list and keep only the files that actually respond:

```bash
cat alljs.txt | httpx-toolkit -mc 200 -o samsung.txt
```

- `cat alljs.txt` — feed in the collected JavaScript URLs.
- `httpx-toolkit` — HTTP toolkit used here to check URL status.
- `-mc 200` — match only responses with status code 200.
- `-o samsung.txt` — save the surviving URLs.

You now have a deduplicated list of live JavaScript endpoints ready for analysis.

### Extracting secrets — JSLeak

```bash
cat samsung.txt | jsleaks -s -l -k
```

- `jsleaks` — analyses JavaScript files for sensitive information and leaks.
- `-s` — enable secretFinder.
- `-l` — enable linkFinder.
- `-k` — check status code.

Output is hidden links, secret keys, and the status code for each. Read it carefully rather than mass-reporting — most hits are third-party public keys, and the interesting ones hide among them.

### Advanced scanning — nuclei

Template-driven detection across the same list:

```bash
cat samsung.txt | nuclei -t prsnl/credentials-disclosure-all.yaml -c 30
```

```bash
cat samsung.txt | nuclei -t /home/coffinxp/nuclei-templates/http/exposures -c 30
```

- `-t /home/coffinxp/nuclei-templates/http/exposures` — path to the template directory holding exposure-related templates. The `credentials-disclosure-all` custom template is the alternative: it bundles every credential-leak regex pattern into one file.
- `-c 30` — concurrency of 30, so 30 requests run simultaneously.

Nuclei returns a categorised list of detected API keys and other sensitive data.

### Comprehensive analysis — LazyEgg (CLI)

The CLI version of LazyEgg extracts links, images, cookies, forms, JavaScript URLs, localStorage, host, IP, and leaked credentials from a target URL:

```bash
cat samsung.txt | xargs -I{} bash -c 'echo -e "\ntarget : {}\n" && python lazyegg.py "{}" --js_urls --domains --ips --leaked_creds --local_storage'
```

- `--js_urls` — extract JavaScript file URLs from the target.
- `--domains` — identify domains associated with the target.
- `--ips` — retrieve IP addresses related to the target.
- `--leaked_creds` — check for leaked credentials associated with the target.
- `--local_storage` — pull localStorage contents.

Between them these flags surface hidden endpoints, URLs, domains, IPs and leaked credentials inside the `.js` files.

!!! bug "Flag dashes get mangled by article renderers"
    Medium's typography converts `--` into an em dash. The flags are double-hyphen long options — if `lazyegg.py` rejects them, check you pasted `--js_urls` and not `—js_urls`.

### Replaying into Burp for a passive scan

`grep` finds patterns you thought of. A passive scan finds the ones you didn't —
so push every live JS file through Burp and let an extension flag the secrets.

```bash
# 1. Gather all links for the target
cat hosts | sed 's/https\?:\/\///' | gau > urls.txt
# 2. Filter to JavaScript
cat urls.txt | grep -P "\w+\.js(\?|$)" | sort -u > jsurls.txt
# 3. Keep only the ones that resolve, replaying each through Burp
ffuf -mc 200 -w jsurls.txt:HFUZZ -u HFUZZ -replay-proxy http://127.0.0.1:8080
```

Then in Burp: install **Scan Check Builder**, add a *passive* profile matching
`accessToken` / `access_token` (and whatever else the target's stack names its
credentials), and run a passive scan across the JS you just replayed.

!!! bug "Validate before you report"
    Bundles are full of dead keys — rotated credentials, sandbox tokens,
    third-party public keys that are *supposed* to ship. Prove each one still
    authenticates against the service it belongs to before it goes in the report.
    An unvalidated "leaked token" finding is how you lose a triager's trust.

## :material-magnify: What to grep for

The keyword set that pays across every step — manual view-source, extension search boxes, and `grep` over downloaded bundles:

```text
api
token
password
jwt
secret
```

Widen it once you're grepping files locally:

```bash
grep -rniE '(api[_-]?key|apikey|access[_-]?token|auth[_-]?token|bearer|secret|passwd|password|client[_-]?secret|private[_-]?key)' *.js
grep -rnoE 'https?://[a-zA-Z0-9.-]+\.[a-z]{2,}[^"'"'"'` ]*' *.js | sort -u     # endpoints & internal hosts
grep -rnoE '[a-z0-9.-]+\.s3[.-][a-z0-9-]*\.?amazonaws\.com' *.js | sort -u     # s3 buckets
grep -rnoE 'AKIA[0-9A-Z]{16}' *.js                                              # aws access key ids
grep -rnoE 'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+' *.js             # jwts
grep -rnoE '(internal|staging|dev|qa|uat|test)[.-][a-z0-9.-]+' *.js | sort -u   # internal domains
```

!!! loot "Chase impact, not the regex hit"
    A raw key in a bundle is not a finding on its own — a triager wants the API call it authorises. Test the key against the vendor's API, or the internal endpoint against an unauthenticated session, and report *that*.

## :material-toolbox: Tooling index

| Tool | Role | Source |
| --- | --- | --- |
| katana | Active crawling / spidering | [projectdiscovery/katana](https://github.com/projectdiscovery/katana) |
| gau | Passive URL collection from archives | [lc/gau](https://github.com/lc/gau) |
| httpx | HTTP probing and status filtering | [projectdiscovery/httpx](https://github.com/projectdiscovery/httpx) |
| nuclei | Template-driven vulnerability scanning | [projectdiscovery/nuclei](https://github.com/projectdiscovery/nuclei) |
| jsleak | Secrets, paths and links in source code | [byt3hx/jsleak](https://github.com/byt3hx/jsleak) |
| lazyegg | Multi-type extraction from a target URL | [schooldropout1337/lazyegg](https://github.com/schooldropout1337/lazyegg) |
| EndPointer | In-browser endpoint parsing | [Chrome Web Store](https://chromewebstore.google.com/detail/endpointer/ppliilneafplhagjhhphcjmjdmbjagcp) |

## :material-link-variant: Related

- Parent section — surface mapping this feeds off → [Web Recon](recon.md).
- Reporting what you find → [Information Leakage](info-leakage.md).
- Passive sources for the same secrets, outside the app → [OSINT & Dorking](../network/osint.md).
- Turning discovered hosts into scanned services → [Network Recon](../network/recon.md).
- Template management and custom scanning → [Nuclei](../toolbox/nuclei.md).
- Internal hostnames from bundles are prime [SSRF](ssrf.md) targets.
