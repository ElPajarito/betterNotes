---
tags:
  - Linux
  - Reference
---

# :material-swap-vertical: Archives & Transfer

<span class="pill pill-easy">basics</span> <span class="pill pill-info">move data</span>

Bundling files up and moving them between machines. `tar` and `rsync` are the two you'll reach for most.

!!! abstract "TL;DR"
    `tar czf` to pack, `tar xzf` to unpack, `rsync -avz` to sync/copy efficiently, `scp` for quick one-offs, and a one-line web server for pulling files anywhere.

## :material-archive: tar (the classic)

```bash
tar czf out.tar.gz dir/     # Create Zipped from a File/dir
tar xzf out.tar.gz          # eXtract Zipped from File
tar tzf out.tar.gz          # lisT contents without extracting
tar xzf out.tar.gz -C /dst  # extract into a target dir
```

!!! tip "Remember the letters"
    **c**reate / e**x**tract / **t**list, **z** = gzip, **f** = file, **v** = verbose. So "make a zipped archive from a folder" = `czf`, "unpack it" = `xzf`.

## :material-folder-zip: zip & gzip

```bash
zip -r out.zip dir/         # zip a directory
unzip out.zip               # extract
unzip -l out.zip            # list contents
gzip big.log                # → big.log.gz (replaces original)
gunzip big.log.gz           # back to big.log
```

## :material-sync: rsync (smart copy)

```bash
rsync -avz src/ dst/                    # local, archive + compress
rsync -avz src/ user@host:/backup/      # to a remote box over SSH
rsync -avz --dry-run src/ dst/          # preview, change nothing
rsync -avz --delete src/ dst/           # make dst mirror src exactly
```

`rsync` only transfers what changed — ideal for large or repeated copies.

## :material-download: Pull files anywhere

```bash
# Serve the current directory over HTTP (great for grabbing files)
python3 -m http.server 8000
# On the other machine:
wget http://10.10.10.5:8000/file
curl -O http://10.10.10.5:8000/file
# Text-safe transfer when only a shell is available
base64 file | ...            # encode → paste → base64 -d to rebuild
```

## :material-link-variant: Related

- Copying over an existing session → [SSH & Keys](ssh.md).
- Getting data off a target → [Pivoting & Exfil](../privesc/pivoting.md).
