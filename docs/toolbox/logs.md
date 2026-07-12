---
tags:
  - Linux
  - Reference
---

# :material-file-document-multiple: Logs & System Info

<span class="pill pill-easy">basics</span> <span class="pill pill-info">diagnostics</span>

When something misbehaves, the logs already told you why. Know where they are and how to read them fast.

!!! abstract "TL;DR"
    `journalctl -u service -e` for systemd logs, `dmesg` for kernel/hardware, `/var/log/*` for the classics, `uname -a` / `hostnamectl` to identify the box.

## :material-book-open-variant: systemd journal

```bash
journalctl -u nginx            # logs for one service
journalctl -u nginx -e         # jump to the end (newest)
journalctl -u nginx -f         # follow live (like tail -f)
journalctl -p err -b           # only errors, this boot
journalctl --since "10 min ago"
journalctl --since today --until "1 hour ago"
```

## :material-folder-text: The classic log files

```bash
tail -f /var/log/syslog        # general system (Debian)
tail -f /var/log/messages      # general system (RHEL)
tail -f /var/log/auth.log      # logins, sudo, SSH (Debian)
less /var/log/nginx/error.log  # per-service app logs
dmesg | tail                   # kernel ring buffer (hardware, OOM kills)
dmesg -w                       # follow kernel messages live
```

!!! tip "Chase an error across files"
    `grep -ri "out of memory" /var/log/` finds OOM events; `grep "Failed password" /var/log/auth.log` surfaces brute-force attempts against SSH.

## :material-information: Identify the machine

```bash
uname -a               # kernel version + architecture
hostnamectl            # hostname, OS, kernel, virtualization
cat /etc/os-release    # distro name and version
lsb_release -a         # distro (if installed)
uptime                 # how long up + load average
arch                   # CPU architecture (x86_64, aarch64…)
```

!!! note "First 30 seconds on an unfamiliar box"
    `hostnamectl && uptime && df -h && free -h` gives you OS, load, disk, and memory in four commands — enough to know if it's healthy.

## :material-link-variant: Related

- The service producing the logs → [Processes & Services](processes.md).
- OS/kernel fingerprinting for exploits → [Linux Privesc](../privesc/linux.md).
