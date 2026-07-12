---
tags:
  - Web
---

# :material-gitlab: GitLab

<span class="pill pill-hard">source + creds</span> <span class="pill pill-info">web</span>

Self-hosted GitLab is a goldmine: **source code, CI/CD secrets, registry tokens,
and deploy keys** — plus a history of serious unauth CVEs.

!!! abstract "TL;DR"
    Grab the version from `/help` → match a CVE (unauth RCE / arbitrary file read /
    account-takeover) → or register/enumerate users, hunt public repos and CI
    variables for secrets.

## :material-magnify: Identify & enumerate

```bash
curl -s http://$TARGET/help | grep -i "GitLab .* (v"        # version
curl -s http://$TARGET/users/sign_in                        # login page
# user/project enumeration
curl -s "http://$TARGET/api/v4/users?username=admin"
curl -s "http://$TARGET/api/v4/projects?visibility=public"
```

!!! loot "Notable CVEs (match the version!)"
    - **CVE-2023-7028** — account takeover via password-reset to arbitrary email.
    - **CVE-2021-22205** — unauth RCE via ExifTool on image upload (pre-13.10.3).
    - **CVE-2020-10977** — arbitrary file read via path traversal.

## :material-fire: CVE-2021-22205 (unauth RCE)

```bash
# Upload a crafted DjVu image that ExifTool mishandles → RCE as `git`
# public PoCs: gitlab_exif_rce; confirm version < 13.10.3 / 13.9.6 / 13.8.8
```

## :material-key-variant: Secret hunting (authenticated)

```bash
# CI/CD variables often hold cloud keys, registry & deploy creds
curl -s -H "PRIVATE-TOKEN: $TOK" "http://$TARGET/api/v4/projects/$ID/variables"
# scan repos + history for secrets
trufflehog gitlab --endpoint http://$TARGET --token $TOK
gitleaks detect --source ./repo
```

## :material-shield-check: Remediation

- Patch aggressively (GitLab CVEs are frequent + severe); disable open
  registration; scope CI variables; enforce 2FA.

## :material-link-variant: Related

- Fingerprinted at [Web Technologies](index.md) / [Ports](../network/ports.md).
- CI secrets → [CI/CD & Supply Chain](../cloud/cicd.md), [Cloud](../cloud/index.md).
- Reference: [HackTricks GitLab](https://book.hacktricks.wiki/en/network-services-pentesting/pentesting-web/gitlab.html).
