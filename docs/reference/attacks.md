---
tags:
  - Reference
---

# :material-sitemap: Attack Index (MITRE ATT&CK)

<span class="pill pill-info">reference</span>

Techniques in these notes mapped to [MITRE ATT&CK](https://attack.mitre.org/)
tactics — so you can navigate by *what you're trying to do* and speak the same
language as the blue team in your report.

## :material-door-open: Initial Access (TA0001)

| Technique | Where |
| --- | --- |
| Exploit public-facing app | [Web Apps](../web/index.md) · [Web Technologies](../webtech/index.md) |
| External remote services (VPN/RDP/SSH) | [Ports & Services](../network/ports.md) |
| Valid accounts / default creds | [Password Spraying](../network/password-spraying.md) · [Ports](../network/ports.md) |
| Phishing | [Social engineering — external] |
| Supply-chain compromise | [CI/CD & Supply Chain](../cloud/cicd.md) |

## :material-console: Execution (TA0002)

| Technique | Where |
| --- | --- |
| Command & scripting interpreter | [Command Injection](../web/command-injection.md) |
| Exploitation for client execution | [XSS](../web/xss.md) · [Deserialization](../web/deserialization.md) |
| Server software component (webshell) | [File Upload](../web/file-upload.md) · [Tomcat](../webtech/tomcat.md) |

## :material-anchor: Persistence (TA0003)

| Technique | Where |
| --- | --- |
| Web shell | [File Upload](../web/file-upload.md) |
| Create/modify accounts | [Persistence](../privesc/persistence.md) |
| Scheduled task / cron | [Linux Privesc](../privesc/linux.md) · [Persistence](../privesc/persistence.md) |
| Valid accounts (Golden Ticket) | [Kerberos](../network/kerberos.md) |

## :material-arrow-up-bold: Privilege Escalation (TA0004)

| Technique | Where |
| --- | --- |
| Abuse elevation (sudo, SUID, caps) | [Linux Privesc](../privesc/linux.md) · [GTFOBins](../privesc/gtfobins.md) |
| Access-token manipulation | [Windows Tokens](../privesc/windows-tokens.md) |
| Exploit for privesc (services, kernel) | [Windows Privesc](../privesc/windows.md) |
| Domain-privilege escalation (ACLs/ADCS) | [AD Attack Paths](../network/active-directory.md) · [AD CS](../network/adcs.md) |

## :material-incognito: Defense Evasion (TA0005)

| Technique | Where |
| --- | --- |
| Living-off-the-land binaries | [GTFOBins](../privesc/gtfobins.md) |
| Ticket/encryption downgrade | [Kerberos](../network/kerberos.md) |
| Filter/WAF bypass | [XSS](../web/xss.md) · [SQLi](../web/sqli.md) |

## :material-key: Credential Access (TA0006)

| Technique | Where |
| --- | --- |
| Brute force / spraying | [Password Spraying](../network/password-spraying.md) · [Ports](../network/ports.md) |
| OS credential dumping (LSASS/SAM) | [Windows Privesc](../privesc/windows.md) |
| Kerberoast / AS-REP roast | [Kerberos](../network/kerberos.md) |
| Creds in files/config | [Credential Hunting](../privesc/credential-hunting.md) |

## :material-radar: Discovery (TA0007)

| Technique | Where |
| --- | --- |
| Network/service scanning | [Recon](../network/recon.md) · [Ports](../network/ports.md) |
| Domain/account discovery | [SMB](../network/smb.md) · [BloodHound](../network/bloodhound.md) |
| Cloud service discovery | [Cloud](../cloud/index.md) |

## :material-transit-connection: Lateral Movement (TA0008)

| Technique | Where |
| --- | --- |
| Pass-the-hash / ticket | [Kerberos](../network/kerberos.md) · [Windows](../privesc/windows.md) |
| Remote services (WinRM/SMB/RDP) | [Ports](../network/ports.md) · [SMB](../network/smb.md) |
| Internal proxying / tunneling | [Pivoting](../privesc/pivoting.md) |

## :material-cloud-upload: Collection & Exfiltration (TA0009 / TA0010)

| Technique | Where |
| --- | --- |
| Data from local system / repos | [Credential Hunting](../privesc/credential-hunting.md) |
| Exfil over C2 / alternative protocol | [Pivoting & Exfil](../privesc/pivoting.md) |
| Cloud storage/data theft | [AWS](../cloud/aws.md) · [SSRF → metadata](../web/ssrf.md) |

!!! tip "Use it two ways"
    Forward — "I need persistence, what are my options?" Backward — after the
    engagement, map every finding to a tactic for a clean, blue-team-legible report.

## :material-link-variant: Related

- Tool for each technique → [Tool Index](tools.md). Methodology → [Web Checklist](../checklists/web.md).
- Reference: [MITRE ATT&CK Matrix](https://attack.mitre.org/matrices/enterprise/).
