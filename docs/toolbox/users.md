---
tags:
  - Linux
  - Reference
---

# :material-account-group: Users & Sudo

<span class="pill pill-easy">basics</span> <span class="pill pill-info">identity</span>

Who you are, what groups you're in, and how to run things as someone else. Understanding this model is half of Linux privilege escalation.

!!! abstract "TL;DR"
    `id` / `whoami` = who am I, `sudo` = run as root, `su - user` = become another user, `sudo -l` = what am I allowed to run. Users live in `/etc/passwd`, hashes in `/etc/shadow`.

## :material-card-account-details: Who am I?

```bash
whoami            # current username
id                # UID, GID, and all group memberships
groups            # just the group list
who               # who else is logged in
last              # recent login history
```

## :material-account-switch: Becoming another user

```bash
sudo command          # run one command as root
sudo -i               # interactive root shell
sudo -u www-data cmd  # run as a specific user
su - alice            # switch user (needs their password)
sudo -l               # list what YOUR sudo rights allow
```

!!! tip "`sudo -l` is the first thing to check"
    It shows exactly which commands you may run as root — including `NOPASSWD` entries. A single misconfigured line here is often the whole privesc.

## :material-account-plus: Managing users (as root)

```bash
sudo useradd -m -s /bin/bash bob   # create with home + shell
sudo passwd bob                    # set/change password
sudo usermod -aG sudo bob          # add to a group ( -a = append! )
sudo userdel -r bob                # delete + remove home
```

## :material-file-account: The important files

| File | Holds |
| --- | --- |
| `/etc/passwd` | Usernames, UIDs, shells, home dirs (world-readable) |
| `/etc/shadow` | Password hashes (root-only) |
| `/etc/group` | Group memberships |
| `/etc/sudoers` | Who can `sudo` what — edit with `visudo` only |

!!! warning "Never edit sudoers directly"
    Use `sudo visudo` — it validates syntax before saving. A broken `/etc/sudoers` can lock everyone out of root.

## :material-link-variant: Related

- Turning these misconfigs into root → [Linux Privesc](../privesc/linux.md).
- Cracking hashes from `/etc/shadow` → [Credential Hunting](../privesc/credential-hunting.md).
