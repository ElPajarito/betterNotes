---
tags:
  - Recon
---

# :material-earth: OSINT & Dorking

<span class="pill pill-info">recon</span>

Dorking turns search engines into a low-noise recon tool that never sends a packet.

!!! abstract "TL;DR"
    Specialist search engines (Shodan-likes, cert logs, bucket search) map the external attack surface passively.

## :material-google: Google dorks

Operators: `site:`, `inurl:`, `intext:`, `intitle:`, `ext:`/`filetype:`, `-` to exclude, `|` for OR.

```bash
# Sensitive documents scoped to a target
ext:txt | ext:pdf | ext:xml | ext:xls | ext:xlsx | ext:ppt | ext:pptx | ext:doc | ext:docx
intext:"confidential" | intext:"Not for Public Release" | intext:"internal use only" | intext:"do not distribute" site:$TARGET

# Exposed config / secret / backup files
site:$TARGET ext:log | ext:txt | ext:conf | ext:cnf | ext:ini | ext:env | ext:sh | ext:bak | ext:backup | ext:swp | ext:old | ext:~ | ext:git | ext:svn | ext:htpasswd | ext:htaccess | ext:json

# Params that tend to be XSS-prone
inurl:q= | inurl:s= | inurl:search= | inurl:query= | inurl:keyword= | inurl:lang= inurl:&
```

Sensitive-doc phrasings worth cycling through:

```sql
"<company>" AND internal (filetype:docx OR filetype:pdf)
site:$TARGET AND "keywords" AND inurl:fileadmin
site:$TARGET (filetype:pdf OR filetype:ppt OR filetype:xls)
"<company>" AND confidential (filetype:ppt OR filetype:pdf)
site:$TARGET AND (contract OR "internal use only") filetype:pdf
"<company>" AND ("service agreement" OR "memorandum") -public
```



## :material-github: GitHub dorking

Public repos of a company (and their employees' personal repos) routinely leak keys, internal hostnames, and CI secrets.

```bash
org:<company> password
org:<company> api_key OR apikey OR secret
org:<company> filename:.env
org:<company> filename:.npmrc _auth
org:<company> "BEGIN RSA PRIVATE KEY"
org:<company> extension:sql
"$TARGET" AWS_SECRET_ACCESS_KEY
"$TARGET" language:yaml password
```

Then run a secret scanner over anything interesting instead of grepping by eye:

```bash
trufflehog github --org=<company>        # deep secret detection across a whole org
```

### Search syntax

Start dumb and get sharper. 

```bash
"example.com" password
```

```bash
"example.com" "password":
```

That second form returns far fewer hits, and the ones it returns look like this — which is exactly the shape you want:

```bash
"username": "admin",
"password": "supersecret123"
```

If the target maintains a public org, scope to it. Plenty of programs have no GitHub org at all, so treat this as a bonus pass rather than your main one:

```bash
org:example "password":
```

One combined dork replaces a dozen sequential searches.

```sql
"domain" AND ("api_key" OR "secret" OR "password" OR "access_token" OR "client_secret" OR "private_key" OR "AWS_SECRET_ACCESS_KEY" OR "DB_PASSWORD" OR "slack_token" OR "github_token" OR "BEGIN RSA PRIVATE KEY")
```


### Filters: `filename:`, `extension:`, `path:`, `repo:`

The filter set worth memorising:

```text
filename: Search by specific file names (e.g. filename:.env)
extension: Filter by file type (e.g. extension:json)
path: Search within specific directories (e.g. path:/config)
org: Limit results to an organization (e.g. org:my-company)
repo: Focus on a specific repository (e.g. repo:my-project)
```

=== "`filename:`"

    Pin the search to files that exist for the sole purpose of holding secrets:

    ```text
    filename:.env "DB_PASSWORD"
    ```

=== "`extension:`"

    Sweep a whole file type across GitHub — config formats leak tokens constantly:

    ```text
    extension:json "access_token"
    ```

=== "`path:`"

    Sensitive files live in predictable folders, so search the folder instead of the name:

    ```text
    path:/config filename:database.php       # Finds database.php inside any /config directory
    path:/wp-config.php                      # Targets the WordPress config file
    path:/src/secrets                        # Looks in typical config directories
    path:/settings                           # Looks in typical settings directories
    path:/.ssh                               # Searches hidden .ssh folder
    path:/.git                               # Searches hidden .git folder
    path:**/.env                             # Finds .env files in any nested directory
    ```

=== "`repo:`"

    Auditing one open-source project the target depends on:

    ```text
    repo:vercel/next.js filename:config.js
    ```

Stack filters when you want precision instead of volume — this one hunts credentials in a specific language's source files:

```text
"domain" language:PHP password
```

### Keyword variations

`password` is only one spelling of the same idea, and developers use all of them:

```text
password
passwd
pwd
pass
```

Beyond that, the keywords that actually pay are the ones naming a specific secret format. Cycle these against your target string:

=== "Authentication & secrets"

    ```text
    api_key
    access_token
    client_secret
    auth_token
    authorizationToken
    x-api-key
    secret
    SECRET_KEY
    secret_token
    credentials
    token
    secure
    ```

=== "Cloud provider secrets"

    ```text
    AWS_SECRET_ACCESS_KEY
    AWS_ACCESS_KEY_ID
    aws_access_key_id
    aws_secret_key
    aws_token
    GCP_SECRET
    gcloud_api_key
    firebase_url
    shodan_api_key
    ```

=== "Database credentials"

    ```text
    DB_PASSWORD
    DATABASE_URL
    db_password
    db_pass
    MYSQL_PASSWORD
    POSTGRES_PASSWORD
    mongo_uri
    mongodb_password
    ```

=== "SSH & private keys"

    ```text
    BEGIN RSA PRIVATE KEY
    BEGIN OPENSSH PRIVATE KEY
    BEGIN PGP PRIVATE KEY BLOCK
    id_rsa
    private_key
    pem private
    key
    ```

=== "Service-specific tokens"

    ```text
    slack_token
    discord_token
    github_token
    gitlab_token
    twilio_auth_token
    mailgun
    stripe_secret
    SF_USERNAME salesforce
    ```

!!! loot "A key is only a finding once it authenticates"
    [Keyhacks](https://github.com/streaak/keyhacks) documents the one-command validation test for 50+ API key types. Run it before writing the report — an expired or scoped-to-nothing key is not an impact.

### Scaling it up: gitGraber & trufflehog

Manual dorking finds the obvious; automation covers the long tail. [gitGraber](https://github.com/hisxo/gitGraber) sweeps a keyword wordlist against a target and hands back URLs, timestamps and raw JSON:

```bash
# Search for sensitive data related to the entire organization
python3 gitGraber.py -k wordlists/keywords.txt -q nasa.gov -s

# Search for sensitive data related strictly to the domain
python3 gitGraber.py -k wordlists/keywords.txt -q "nasa.gov" -s
```

[TruffleHog](https://github.com/trufflesecurity/trufflehog) goes deeper — it walks commit history, verifies detected credentials against the live provider, and can pull in issue/PR comments that dorking never touches:

```bash
# Scan a local Git repository
trufflehog git file:///home/user/my-repo

# Scan a public GitHub repository
trufflehog git https://github.com/username/repo.git

# Scan with filtering results to show only verified and unknown findings
trufflehog git https://github.com/trufflesecurity/test_keys --results=verified,unknown

# Scan and format output as JSON using jq for readability
trufflehog git https://github.com/trufflesecurity/test_keys --results=verified,unknown --json | jq

# Scan a GitHub repository and include issue and PR comments in the scan
trufflehog github --repo=https://github.com/trufflesecurity/test_keys --issue-comments --pr-comments

# Scan all repositories in a GitHub organization using a personal access token
trufflehog github --org=nasa --token=yourgithubtoken

# Scan a specific GitHub repository (basic usage)
trufflehog github --repo=https://github.com/username/repo
```

!!! tip "GitHub is also a subdomain source"
    Code, configs and CI files name internal hostnames constantly. [github-subdomains](https://github.com/gwen001/github-subdomains) scrapes GitHub's search index for hostnames under a domain — feed the output straight into your resolve/probe pipeline. More curated dork lists: [coffinxp/payloads `github-dork.txt`](https://github.com/coffinxp/payloads/blob/main/github-dork.txt).

### Exposed `.git` directories

A deployed `.git/` folder hands you the entire source history — including files the developers deleted but never purged. Sweep a host list for it:

```bash
cat domains.txt | nuclei -t gitExposed.yaml
```

```bash
cat domains.txt | httpx-toolkit -sc -server -cl -path "/.git/" -mc 200 -location -ms "Index of" -probe
cat domains.txt | grep "SUCCESS" | gf urls | httpx-toolkit -sc -server -cl -path "/.git/" -mc 200 -location -ms "Index of" -probe
```

That probes `/.git/`, keeps only `200`s, and matches the directory-listing string while printing status, server header, content length and redirect target. The [DotGit](https://github.com/davtur19/DotGit) browser extension does the same passively for every site you visit.

Once you have a live `.git/`, dump and rebuild it:

```bash
./gitdumper.sh  https://domain.com/.git/ outputdir

git-dumper https://domain.com/.git/ outputdir
```

```bash
cd output_dir
git status
git restore .
git checkout .
```

!!! loot "403 on `/.git/` is not a dead end"
    Directory listing being disabled only blocks the index. `/.git/config`, `/.git/HEAD` and the object files are often still fetchable, and [GitTools](https://github.com/internetwache/GitTools) / [git-dumper](https://github.com/arthaud/git-dumper) reconstruct the repo from those alone. The restore step above is where deleted files reappear.

## :material-history: Wayback Machine


The Internet Archive remembers what the target's ops team forgot: retired endpoints, config files that were pulled after a bad deploy, documents that were unlinked but never unpublished. None of it costs you a request against `$TARGET`.

### Passive URLs via the CDX API

The CDX API returns every archived URL under a domain and its subdomains as plain text — one deduplicated line each:

```text
https://web.archive.org/cdx/search/cdx?url=*.example.com/*&collapse=urlkey&output=text&fl=original
```

For anything larger than a toy domain the browser will choke on the result set. Pull it with curl instead and work on the file:

```bash
curl -G "https://web.archive.org/cdx/search/cdx" --data-urlencode "url=*.example.com/*" --data-urlencode "collapse=urlkey" --data-urlencode "output=text" --data-urlencode "fl=original" > output.txt
```

Now grep `output.txt` for emails, credential-shaped strings, and above all file extensions that shouldn't be public:

```bash
cat out.txt | uro | grep -E '\.xls|\.xml|\.xlsx|\.json|\.pdf|\.sql|\.doc|\.docx|\.pptx|\.txt|\.zip|\.tar\.gz|\.tgz|\.bak|\.7z|\.rar|\.log|\.cache|\.secret|\.db|\.backup|\.yml|\.gz|\.config|\.csv|\.yaml|\.md|\.md5|\.exe|\.dll|\.bin|\.ini|\.bat|\.sh|\.tar|\.deb|\.git|\.env|\.rpm|\.iso|\.img|\.apk|\.msi|\.dmg|\.tmp|\.crt|\.pem|\.key|\.pub|\.asc'
```

### Filtering server-side by extension

Cheaper still: make the CDX API do the filtering. Paste this straight into a browser tab for a readable, already-narrowed list:

```text
https://web.archive.org/cdx/search/cdx?url=*.example.com/*&collapse=urlkey&output=text&fl=original&filter=original:.*\.(xls|xml|xlsx|json|pdf|sql|doc|docx|pptx|txt|zip|tar\.gz|tgz|bak|7z|rar|log|cache|secret|db|backup|yml|gz|git|config|csv|yaml|md|md5|exe|dll|bin|ini|bat|sh|tar|deb|rpm|iso|img|apk|msi|env|dmg|tmp|crt|pem|key|pub|asc)$
```

Same query from the terminal, printing to screen and saving at once:

```bash
curl "https://web.archive.org/cdx/search/cdx?url=*.example.com/*&collapse=urlkey&output=text&fl=original&filter=original:.*\.(xls|xml|xlsx|json|pdf|sql|doc|docx|pptx|txt|git|zip|tar\.gz|tgz|bak|7z|rar|log|cache|secret|db|backup|yml|gz|config|csv|yaml|md|md5|exe|dll|bin|ini|bat|sh|tar|deb|rpm|iso|img|env|apk|msi|dmg|tmp|crt|pem|key|pub|asc)$" | tee output.txt
```

If you'd rather not touch CDX at all, the archive's own wildcard view lists every captured URL for a domain and has a search box you can type an extension into:

```text
https://web.archive.org/web/*/example.com/*
```

### Mining archived PDFs

Documents are the most under-read part of any URL dump. This one-liner pulls every archived PDF, converts it to text, and prints only the URLs whose contents trip a confidentiality keyword:

```bash
cat output.txt | grep -Ea '\.pdf' | while read -r url; do curl -s "$url" | pdftotext - - | grep -Eaiq '(internal use only|confidential|strictly private|personal & confidential|private|restricted|internal|not for distribution|do not share|proprietary|trade secret|classified|sensitive|bank statement|invoice|salary|contract|agreement|non disclosure|passport|social security|ssn|date of birth|credit card|identity|id number|company confidential|staff only|management only|internal only)' && echo "$url"; done
```

Review the hits by hand before reporting — keyword matches include plenty of boilerplate footers.

!!! loot "The 404 is the finding"
    Most hunters delete dead URLs from their wayback dump. Do the opposite: take the 404 URL, paste it into [web.archive.org](https://web.archive.org/), and open the snapshot timeline. An older capture gives you a download link for the file the server no longer serves — deleted backups, old configs and pulled documents come straight back.

### Archived `robots.txt`

`robots.txt` is a list of paths the owner did not want crawled, which makes historical copies a curated map of interesting endpoints. Diff old snapshots against the current file: entries that were removed usually point at admin panels, staging paths or exports that still exist but are no longer advertised.

## :material-file-search: File-extension recon

Interesting extensions to hunt for, whether via dorks or content discovery:

| Category | Extensions |
| --- | --- |
| Old backups | `.bak` `.old` `.zip` `~` `.swp` |
| Config/secrets | `.env` `.conf` `.cnf` `.ini` `.log` `.git` `.svn` `.htpasswd` `.htaccess` |
| Documents | `.pdf` `.doc(x)` `.ppt(x)` `.xls(x)` `.txt` `.rtf` `.7z` `.rar` |

!!! loot "Case-variant extensions bypass filters"
    A server that blocks `.php` uploads/handlers may still execute `.pHp`, `.Php`, `.phP`. Try mixed case (and alternates like `.php5`, `.phtml`) when an extension is filtered.

## :material-database-search: Search engines of interest

Passive-recon databases — most map internet-facing assets without you scanning them:

| Engine | Use |
| --- | --- |
| Shodan / Censys / ZoomEye / FOFA / Netlas / ONYPHE / Binary Edge | Internet-connected asset & service discovery |
| SecurityTrails / DNSDumpster / FullHunt | DNS data & attack-surface mapping |
| crt.sh | Subdomains via Certificate Transparency logs |
| GrayHatWarfare | Public S3 / cloud buckets |
| GreyNoise | Is an IP background-noise scanning or targeted |
| Hunter | Email addresses belonging to a domain |
| DeHashed / IntelligenceX / LeakIX | Leaked credentials, data leaks, Tor/I2P, indexed exposures |
| Grep App / SearchCode / PublicWWW | Search across public code / source / page markup |
| Vulners / Packet Storm | Vulnerability & exploit lookup |
| URLScan | Scan and inspect how a site behaves |

## :material-sitemap: General web recon workflow

Chain passive OSINT into active enumeration once you have a scope:

```bash
# Automated recon orchestration (subs, ports, screenshots, nuclei, etc.)
reconftw.sh -d $TARGET -r
# or via docker
docker run -it --rm -v "${PWD}/output/:/reconftw/Recon/" six2dez/reconftw:main -d $TARGET -r

# Content discovery — hidden files/dirs across live hosts
cat alive.txt | xargs -I@ sh -c 'ffuf -c -w /path/to/wordlist -e php,aspx,html,do,ashx -u @/FUZZ -ac -t 200' | tee -a dir-ffuf.txt

# Single-host ffuf with status/size filtering
ffuf -c -ac -sf -fc 403,404 -mc all -w raft-large-files.txt -u https://$TARGET/FUZZ
```

- `-fs` filter by response size, `-fc` filter by status code, `-mc all` match everything, `-ac` auto-calibrate, `-sf` stop on mass-403, `-r` follow redirects.
- IIS short-name enumeration: [shortscan](https://github.com/bitquark/shortscan) finds 8.3 filenames leaking real paths.
- Pull URLs out of JSON/wayback dumps: `cat site.json | grep -oP 'https?://[^"]+' > urls.txt`.

!!! loot "Secrets in JS"
    Front-end JavaScript often embeds API endpoints and keys. Feed collected JS through trufflehog / JS-secret tooling before manual review — it is one of the highest-yield passive wins.

## :material-link-variant: Related

- Reference: [DorkSearch](https://dorksearch.com/), [crt.sh](https://crt.sh/), [Shodan](https://www.shodan.io/), [trufflehog](https://github.com/trufflesecurity/trufflehog).
