---
tags:
  - Network
  - Recon
---

# :material-dns: DNS Recon & Abuse

<span class="pill pill-easy">recon</span> <span class="pill pill-info">network</span>

DNS is the map of the target. Beyond enumeration, misconfigured zones leak the whole internal estate and sometimes hand you a takeover.

!!! abstract "TL;DR"
    Enumerate records and subdomains, try a zone transfer, and check for dangling records pointing at reclaimable cloud resources.

## :material-magnify: Enumerate

```bash
dig ANY target.tld +noall +answer
dig axfr target.tld @ns1.target.tld      # zone transfer (often refused)
dnsenum target.tld
subfinder -d target.tld | httpx          # passive subdomains → live hosts
```

## :material-swap-horizontal: Internal / AD DNS

On an AD network, DNS is gold:

```bash
# List domain controllers & services via SRV records
dig _ldap._tcp.dc._msdcs.corp.local SRV
nslookup -type=SRV _kerberos._tcp.corp.local
```

## :material-alert: Subdomain takeover

A CNAME pointing at an unclaimed cloud resource (S3, Azure, GitHub Pages, Heroku) = takeover:

```bash
dig sub.target.tld            # CNAME -> nonexistent-bucket.s3.amazonaws.com
# claim the bucket/app name → serve content on their subdomain
```

!!! opsec "Passive first"
    Zone transfers and brute forcing are noticeable; passive sources (crt.sh, `subfinder`) map most of the surface without touching the target.

## :material-shield-check: Remediation

- Restrict AXFR to secondaries; remove dangling DNS records promptly.
- Split-horizon DNS so internal names aren't public.

## :material-link-variant: Related

- Kicks off broader [Recon](recon.md); SRV records enumerate [Active Directory](active-directory.md).
- Reference: [HackTricks DNS](https://book.hacktricks.wiki/).
