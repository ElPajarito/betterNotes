---
tags:
  - Reference
---

# :material-format-list-bulleted-type: Wordlist Reference

<span class="pill pill-info">reference</span>

Which list for which job. The wrong wordlist wastes hours; the right one finds the
path/param/cred in minutes. Most of these ship with **[SecLists](https://github.com/danielmiessler/SecLists)**
(`/usr/share/seclists` on Kali).

!!! abstract "TL;DR"
    Content discovery → `raft-*` / `directory-list-2.3`. Subdomains → `subdomains-top1million`.
    Passwords → `rockyou` then `top-*`. Params → `burp-parameter-names`. Vhosts →
    a subdomain list with `-H "Host:"`.

## :material-folder-search: Content / directory discovery

| List | Use |
| --- | --- |
| `SecLists/.../raft-medium-directories.txt` | Best all-round dir fuzzing |
| `raft-medium-files.txt` | Files (add `-e .php,.txt,.bak`) |
| `directory-list-2.3-medium.txt` | Dirbuster classic, broad |
| `common.txt` (dirb) | Fast first pass |
| `OneListForAll` | Curated mega-list (six2dez) |

```bash
ffuf -u http://$IP/FUZZ -w raft-medium-directories.txt -e .php,.txt,.bak -mc 200,301,302,403
```

## :material-dns: Subdomains & vhosts

| List | Use |
| --- | --- |
| `subdomains-top1million-110000.txt` | Standard subdomain brute |
| `dns-Jhaddix.txt` | Larger, deeper |
| `namelist.txt` | Vhost fuzzing (`-H "Host: FUZZ.target"`) |

```bash
ffuf -u http://$IP -H "Host: FUZZ.target.com" -w subdomains-top1million-110000.txt -fs <baseline>
```

## :material-key: Passwords & credentials

| List | Use |
| --- | --- |
| `rockyou.txt` | The default; 14M real-world passwords |
| `SecLists/Passwords/Common-Credentials/top-*.txt` | Fast, high-hit spraying |
| `Passwords/Default-Credentials/*` | Product default creds |
| `Usernames/top-usernames-shortlist.txt` | Username spraying |

```bash
# Spray a domain (low-and-slow to dodge lockout) — see Password Spraying note
nxc smb $DC -u users.txt -p 'Season2024!' --continue-on-success
```

!!! opsec "Spraying triggers lockouts & alerts"
    Respect the account-lockout policy: one or two passwords per window across many
    users, never many passwords per user. See [Password Spraying](../network/password-spraying.md).

## :material-code-braces: Parameters, fuzzing & payloads

| List | Use |
| --- | --- |
| `burp-parameter-names.txt` | Hidden GET/POST params |
| `SecLists/Fuzzing/*` | LFI, SQLi, XSS, SSTI payloads |
| `SecLists/Fuzzing/LFI/*` | Path-traversal / LFI |
| `PayloadsAllTheThings` | Curated payloads per bug class |

```bash
ffuf -u "http://$IP/page?FUZZ=1" -w burp-parameter-names.txt -fs <baseline>   # param mining
```

## :material-hammer-wrench: Generate your own

```bash
# Targeted from a site's own words
cewl -d 3 -m 5 http://$IP -w custom.txt
# Mutate with rules (append years/symbols)
hashcat --stdout custom.txt -r /usr/share/hashcat/rules/best64.rule > mutated.txt
# Username permutations from names
username-anarchy -i names.txt
```

## :material-link-variant: Related

- Feeds the fuzz/brute tools in [Tool Index](tools.md) and [Ports](../network/ports.md).
- Cracking the hashes you collect → [Credential Hunting](../privesc/credential-hunting.md).
- Reference: [SecLists](https://github.com/danielmiessler/SecLists), [PayloadsAllTheThings](https://github.com/swisskyrepo/PayloadsAllTheThings).
