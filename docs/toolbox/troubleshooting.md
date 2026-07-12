---
tags:
  - Linux
  - Reference
---

# :material-lifebuoy: Troubleshooting

<span class="pill pill-medium">when it breaks</span> <span class="pill pill-info">field fixes</span>

The handful of errors you'll actually run into, and the fastest path from message to fix. Read the error first — Linux is usually telling you exactly what's wrong.

!!! abstract "TL;DR"
    Permission denied → perms/sudo. Command not found → PATH/package. No space left → clean disk. Address in use → find the PID. Service failed → read `journalctl`. Can't resolve host → DNS.

## :material-lock-alert: "Permission denied"

```bash
ls -l file            # who owns it, what perms
sudo !!                # re-run the last command with sudo
chmod +x script.sh    # trying to run a non-executable script?
```
Check you own the file (or are in its group), that it has the bit you need, and that no parent directory blocks access.

## :material-help-box: "command not found"

```bash
echo $PATH            # is the binary's dir listed?
which tool            # empty = not installed / not in PATH
sudo apt install tool # install it (see Packages)
export PATH=$PATH:/opt/tool/bin   # add a dir for this session
```

## :material-database-alert: "No space left on device"

```bash
df -h                 # which filesystem is 100%?
df -i                 # or is it INODES that are full?
du -sh /var/* | sort -h   # find the hog, then clean
```
See [Disk & Filesystem](disk.md) for freeing space (logs, caches, deleted-but-open files).

## :material-lan-disconnect: "Address already in use"

```bash
ss -tlnp | grep :8080   # find the PID holding the port
kill <pid>              # stop it, or run your app on another port
```

## :material-alert-circle: A service won't start

```bash
systemctl status myapp    # the failing line + last log lines
journalctl -u myapp -e    # full recent logs — the real reason
systemctl restart myapp
```
90% of the time the journal names the exact problem (bad config path, port taken, missing permission).

## :material-web-off: "Could not resolve host"

```bash
ping -c2 8.8.8.8         # IP works but names don't → DNS
cat /etc/resolv.conf     # is a nameserver set?
```
See [Networking](networking.md) for the name-vs-address split.

!!! tip "Read-only filesystem?"
    `mount -o remount,rw /` re-mounts writable — but a filesystem forced read-only usually means the kernel detected disk errors. Check `dmesg` before assuming it's safe.

## :material-link-variant: Related

- Disk cleanup detail → [Disk & Filesystem](disk.md).
- Reading the logs that explain failures → [Logs & System Info](logs.md).
