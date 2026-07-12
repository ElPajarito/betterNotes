---
tags:
  - Linux
  - Reference
---

# :material-harddisk: Disk & Filesystem

<span class="pill pill-easy">basics</span> <span class="pill pill-medium">"disk full"</span>

Where the space went, what's mounted, and how to free room when a box grinds to a halt. "No space left on device" is one of the most common outages you'll fix.

!!! abstract "TL;DR"
    `df -h` = free space per filesystem, `du -sh *` = what's eating a directory, `lsblk` = block devices, `ncdu` = interactive space explorer.

## :material-gauge: How full is it?

```bash
df -h                  # free/used per mounted filesystem
df -i                  # INODES — can be full even when df -h looks fine
du -sh *               # size of each item in current dir
du -sh * | sort -h     # sorted, smallest → largest
du -h --max-depth=1 /var | sort -h
ncdu /                 # interactive, drill-down (install if missing)
```

## :material-memory: Memory

```bash
free -h                # RAM + swap, human-readable
```

## :material-harddisk-plus: Devices & mounts

```bash
lsblk                  # tree of disks and partitions
mount                  # what's mounted where (or: findmnt)
mount /dev/sdb1 /mnt   # mount a partition
umount /mnt            # unmount
sudo fdisk -l          # list disks and partition tables
blkid                  # UUIDs + filesystem types (used in /etc/fstab)
```

## :material-broom: Freeing space fast

```bash
# Biggest files under a path
find /var -type f -size +100M -exec ls -lh {} \; 2>/dev/null
# Clean package caches
sudo apt clean               # Debian/Ubuntu
sudo journalctl --vacuum-size=200M   # trim systemd logs
# Usual suspects: /var/log, /tmp, old kernels, Docker images
docker system df             # what Docker is holding
```

!!! warning "`df` says full but `du` doesn't add up?"
    A **deleted-but-still-open** file still holds space until the process closes it. Find them with `lsof +L1` (or `lsof | grep deleted`) and restart the holding process.

## :material-link-variant: Related

- Diagnosing a wedged box → [Troubleshooting](troubleshooting.md).
- Mounting remote shares you found → [SMB](../network/smb.md).
