---
tags:
  - Web
  - Recon
icon: material/web-check
---

# :material-web-check: Web Recon

<span class="pill pill-info">web</span> <span class="pill pill-medium">asset discovery</span>

Mapping a web target's attack surface. Which hostnames exist. Which vhosts a
single IP serves and what paths are reachable.

!!! abstract "TL;DR"
    Dorking -> Check github leaks -> Crawl JS files -> Scan with nuclei -> Fuzz subdomains, directories and files

## :material-file-tree: Vhost & content discovery

```bash
# Virtual hosts
ffuf -w subdomains.txt -H "Host: FUZZ.target.com" -u http://10.10.10.5 -fs <baseline>
# Directories/files
feroxbuster -u http://10.10.10.5 -w /usr/share/seclists/Discovery/Web-Content/raft-medium-directories.txt -x php,txt,bak
```

### :material-magnify-expand: FFUF run


```bash
ffuf -fs 4038,6628 -fc 403,404 -mc all -sf -ac -r -c -v -t 20 \
  -H "Cookie: Admin=1" \
  -w ~/wordlists/SecLists/Discovery/Web-Content/raft-large-files.txt \
  -H 'User-Agent: Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:136.0) Gecko/20100101 Firefox/136.0' \
  -u https://$TARGET/FUZZ
```

<div class="grid tight" markdown>

<div markdown>
**Filtering and display**

| Flag | Does |
| --- | --- |
| `-fs` | ignore by response size |
| `-fc` | ignore by response code |
| `-c` | display colors |
</div>

<div markdown>
**Matching and run behaviour**

| Flag | Does |
| --- | --- |
| `-mc` | Match HTTP status codes, or "all" for everything. (default: 200,204,301,302,307,401,403) |
| `-ac` | Auto calibrate filtering options |
| `-sf` | Stop when > 95% of responses return 403 Forbidden (default: false) |
| `-s` | Do not print additional information (silent mode) |
| `-r` | Follow redirects |
</div>

</div>



## :material-link-variant: Related

- Secrets, routes and API keys in the bundles you collect → [JS Recon](js-recon.md).
- Reference for the commands → [FFUF](../toolbox/ffuf.md) · [Nuclei](../toolbox/nuclei.md) · [Wordlists](../reference/wordlists.md).