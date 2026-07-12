---
tags:
  - Linux
  - Reference
---

# :material-file-cog: Files & Permissions

<span class="pill pill-easy">basics</span> <span class="pill pill-medium">footguns</span>

Copy, move, delete, link — and the permission model that decides who can do what. Getting permissions wrong is behind a huge share of "it doesn't work" moments.

!!! abstract "TL;DR"
    `cp -r` copy, `mv` move/rename, `rm -rf` delete (careful!), `ln -s` symlink. Permissions are **r(4) w(2) x(1)** for **user/group/other** → `chmod 640`, `chown user:group`.

## :material-content-copy: Copy, move, delete

```bash
cp file.txt backup.txt          # copy
cp -r src/ dst/                  # copy a directory tree
mv old.txt new.txt              # rename or move
mkdir -p a/b/c                  # create nested dirs, no error if exists
touch notes.txt                 # create empty / update timestamp
rm file.txt                     # delete
rm -rf dir/                     # delete dir recursively, no prompts
```

!!! warning "`rm -rf` has no undo"
    There's no recycle bin. Double-check the path, and never run `rm -rf` with a variable that might be empty (`rm -rf "$DIR"/` with unset `DIR` = disaster). Use `rm -i` to be prompted.

## :material-link: Links

```bash
ln -s /opt/app/current app      # symbolic link (points to a path)
ln  file.txt hard.txt           # hard link (same inode/data)
readlink -f app                 # resolve a symlink to its real target
```

## :material-lock: Permissions

```bash
ls -l file        # -rw-r--r--  → user rw, group r, other r
chmod 640 file    # rw- r-- ---   (6=rw, 4=r, 0=none)
chmod +x script   # add execute for everyone
chmod u+x,go-w f  # symbolic: user +execute, group/other -write
chown alice file        # change owner
chown alice:devs file   # owner and group
chmod -R 755 dir/       # recurse into a tree
```

| Digit | r | w | x | = |
| --- | --- | --- | --- | --- |
| 7 | ✔ | ✔ | ✔ | rwx |
| 6 | ✔ | ✔ | | rw- |
| 5 | ✔ | | ✔ | r-x |
| 4 | ✔ | | | r-- |

!!! tip "Special bits worth knowing"
    `chmod 4755` sets **SUID** (runs as the file's owner) — the reason SUID binaries matter for privesc. `stat file` shows owner, perms, and timestamps in full.

## :material-link-variant: Related

- SUID/SGID as an attack path → [GTFOBins & SUID](../privesc/gtfobins.md).
- Default perms on new files → controlled by `umask` (`umask 022` → 644 files).
