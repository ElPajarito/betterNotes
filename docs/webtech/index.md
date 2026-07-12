---
tags:
  - Web
  - Recon
icon: material/application-braces
---

# :material-application-braces: Web Technologies

> Fingerprint the stack, then jump to its cheat page. The moment `whatweb` /
> `nuclei` / a `Server:` header tells you *what* is running, there's usually a
> product-specific fast path to creds or RCE.

<div class="grid cards" markdown>

-   :material-wordpress:{ .lg .middle } __WordPress__

    ---
    Plugins are the attack surface. Enumerate, brute XML-RPC, exploit the weakest plugin.

    [:octicons-arrow-right-24: WordPress](wordpress.md)

-   :material-jenkins:{ .lg .middle } __Jenkins__

    ---
    Script Console = instant RCE as the CI user. Often unauthenticated.

    [:octicons-arrow-right-24: Jenkins](jenkins.md)

-   :material-cat:{ .lg .middle } __Tomcat__

    ---
    Manager creds → deploy a WAR → shell. Watch for path-traversal CVEs.

    [:octicons-arrow-right-24: Tomcat](tomcat.md)

-   :material-microsoft:{ .lg .middle } __IIS__

    ---
    Short-name (`~`) disclosure, tilde enum, and .NET-specific bugs.

    [:octicons-arrow-right-24: IIS](iis.md)

-   :material-server:{ .lg .middle } __Nginx__

    ---
    Alias traversal, misrouted `merge_slashes`, and off-by-slash misconfigs.

    [:octicons-arrow-right-24: Nginx](nginx.md)

</div>

## :material-fingerprint: Fingerprint first

```bash
whatweb -a3 http://$IP                 # tech, versions, headers
nuclei -u http://$IP -tags tech        # tech-detection templates
curl -sI http://$IP                    # Server:, X-Powered-By:, cookies
# Wappalyzer / the browser devtools Network tab work too
```

| Signal | Likely stack |
| --- | --- |
| `Server: Apache` + `/wp-login.php` | [WordPress](wordpress.md) |
| `X-Jenkins:` header / `/login?from=` | [Jenkins](jenkins.md) |
| `Server: Apache-Coyote` / `/manager/html` | [Tomcat](tomcat.md) |
| `Server: Microsoft-IIS` / `X-AspNet-Version` | [IIS](iis.md) |
| `Server: nginx` | [Nginx](nginx.md) |
| `X-Drupal-Cache` / `/user/login` | [Drupal](drupal.md) |
| `X-Generator: Joomla` / `/administrator` | [Joomla](joomla.md) |
| `/help` shows `GitLab` / `X-Gitlab-*` | [GitLab](gitlab.md) |
| `/login` Grafana / port 3000 | [Grafana](grafana.md) |
| `/phpmyadmin/` reachable | [phpMyAdmin](phpmyadmin.md) |
| ports 9200 / 5601, `X-Elastic-Product` | [Kibana / ELK](kibana-elk.md) |
| `/actuator` or `Whitelabel Error Page` | [Spring Boot](spring-boot.md) |
| `/rest/api/2/serverInfo`, `X-AREQUESTID` | [Atlassian (Jira/Confluence)](atlassian.md) |
| `MicrosoftSharePointTeamServices` header | [SharePoint](sharepoint.md) |
| `/js/varien/js.js`, `Magento` cookies | [Magento](magento.md) |
| `/CFIDE/`, `.cfm` extensions | [ColdFusion](coldfusion.md) |
| `Server: Werkzeug` / Python, `{{7*7}}`→49 | [Flask / Werkzeug](flask.md) |
| `/graphql` responds, `__typename` works | [GraphQL (enum)](graphql.md) |

!!! tip "This is enumeration, not exploitation"
    Identifying the tech and its version is *enumeration*. The generic bug classes
    (XSS, SQLi, SSRF…) live under [Web Apps](../web/index.md); these pages cover the
    **product-specific** fast paths.

## :material-link-variant: Related

- Reached here from [Ports & Services](../network/ports.md) (port 80/443 fingerprint).
- Generic web attacks → [Web Apps](../web/index.md).
- Reference: [HackTricks Web Pentesting](https://book.hacktricks.wiki/en/network-services-pentesting/pentesting-web/index.html).
