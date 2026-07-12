---
tags:
  - Reference
---

# :material-toolbox-outline: Tool Index

<span class="pill pill-info">reference</span>

The tools referenced across these notes, grouped by phase — a quick "what do I run
for X" lookup. Deep usage lives in the linked notes.

## :material-radar: Recon

| Tool | Job | Note |
| --- | --- | --- |
| `nmap` / `rustscan` / `masscan` | Port & service scanning | [Ports](../network/ports.md) · [Recon](../network/recon.md) |
| `amass` / `subfinder` | Subdomain enumeration | [Recon](../network/recon.md) |
| `httpx` | Alive-host / tech probing | [Web Technologies](../webtech/index.md) |
| `dnsrecon` / `dig` | DNS enum & zone transfer | [DNS](../network/dns.md) |
| `nuclei` | Templated vuln/tech detection | [Web Technologies](../webtech/index.md) |

## :material-magnify-scan: Enumeration

| Tool | Job | Note |
| --- | --- | --- |
| `nxc` (NetExec) | SMB/LDAP/WinRM/MSSQL Swiss-army | [SMB](../network/smb.md) · [Ports](../network/ports.md) |
| `enum4linux-ng` | SMB/LDAP enumeration | [SMB](../network/smb.md) |
| `ffuf` / `feroxbuster` / `gobuster` | Content & vhost fuzzing | [Ports](../network/ports.md) |
| `whatweb` / `wappalyzer` | Tech fingerprinting | [Web Technologies](../webtech/index.md) |
| `wpscan` | WordPress enumeration | [WordPress](../webtech/wordpress.md) |

## :material-sword-cross: Exploitation

| Tool | Job | Note |
| --- | --- | --- |
| `sqlmap` | SQL injection automation | [SQLi](../web/sqli.md) |
| `Burp Suite` | Web proxy & everything web | [Web Apps](../web/index.md) |
| `ysoserial(.net)` | Deserialization gadgets | [Deserialization](../web/deserialization.md) |
| `impacket` | AD/network protocol scripts | [Kerberos](../network/kerberos.md) · [AD](../network/active-directory.md) |
| `msfvenom` / `metasploit` | Payloads & exploits | [Command Injection](../web/command-injection.md) |
| `hydra` / `medusa` | Credential brute force | [Ports](../network/ports.md) |

## :material-account-arrow-up: Post-Exploitation

| Tool | Job | Note |
| --- | --- | --- |
| `linpeas` / `winPEAS` | Privesc enumeration | [Linux](../privesc/linux.md) · [Windows](../privesc/windows.md) |
| `BloodHound` / SharpHound | AD attack-path graphing | [BloodHound](../network/bloodhound.md) |
| `mimikatz` / `pypykatz` | Credential/ticket extraction | [Windows](../privesc/windows.md) |
| `Rubeus` | Kerberos ticket abuse | [Kerberos](../network/kerberos.md) |
| `chisel` / `ligolo-ng` | Tunneling & pivoting | [Pivoting](../privesc/pivoting.md) |
| GTFOBins / LOLBAS | Living-off-the-land lookup | [GTFOBins](../privesc/gtfobins.md) |

## :material-cellphone: Mobile

| Tool | Job | Note |
| --- | --- | --- |
| `jadx` / `apktool` | APK decompile / rebuild | [Android](../mobile/android.md) |
| `Frida` / `Objection` | Runtime instrumentation | [Android](../mobile/android.md) · [iOS](../mobile/ios.md) |
| `frida-ios-dump` | Decrypt iOS IPA | [iOS](../mobile/ios.md) |

!!! tip "Install once, standardize"
    Most engagements lean on `nxc`, `impacket`, `ffuf`, `nuclei`, `BloodHound`, and
    a proxy. Keep them current — NetExec (not CrackMapExec) and the maintained
    Impacket fork are the modern defaults.

## :material-link-variant: Related

- Cross-reference by technique → [Attack Index](attacks.md).
- Wordlists for the fuzzers/brute tools → [Wordlist Reference](wordlists.md).
