---
tags:
  - Linux
  - Reference
---

# :material-ssh: SSH & Keys

<span class="pill pill-medium">daily driver</span> <span class="pill pill-info">remote access</span>

Logging into remote boxes, key-based auth, a config file to save typing, and tunnels to reach things you otherwise can't.

!!! abstract "TL;DR"
    `ssh user@host`, key auth with `ssh-keygen` + `ssh-copy-id`, save hosts in `~/.ssh/config`, forward ports with `-L`/`-R`/`-D`.

## :material-console: Connecting

```bash
ssh user@host                  # basic login
ssh -p 2222 user@host          # non-standard port
ssh -i ~/.ssh/id_ed25519 user@host   # specific key
ssh user@host 'uname -a'       # run one command and exit
```

## :material-key-variant: Keys (no more passwords)

```bash
ssh-keygen -t ed25519 -C "me@example"   # generate a keypair
ssh-copy-id user@host          # install your pubkey on the server
# manual alternative: append ~/.ssh/id_ed25519.pub to the
# server's ~/.ssh/authorized_keys
ssh-add ~/.ssh/id_ed25519      # load into the agent (asks passphrase once)
```

!!! warning "Guard the private key"
    Share only the `.pub` file. The private key needs `chmod 600` — SSH refuses to use a key that's group/world-readable.

## :material-file-cog: `~/.ssh/config` saves typing

```
Host box
    HostName 10.10.10.5
    User alice
    Port 2222
    IdentityFile ~/.ssh/id_ed25519
```

Now just `ssh box`. Add `AddKeysToAgent yes` to auto-load the key.

## :material-tunnel: Tunnels & transfer

```bash
scp file user@host:/tmp/       # copy a file over SSH
scp -r dir/ user@host:/tmp/    # copy a directory
ssh -L 8080:localhost:80 user@host   # LOCAL: reach host's :80 as localhost:8080
ssh -R 9000:localhost:3000 user@host # REMOTE: expose your :3000 on the host
ssh -D 1080 user@host          # DYNAMIC: SOCKS proxy through the host
```

!!! tip "Which forward is which?"
    `-L` pulls a remote port **to you**. `-R` pushes a local port **out to them**. `-D` turns SSH into a SOCKS proxy so a whole toolset can route through the box.

## :material-link-variant: Related

- Using tunnels to move through a network → [Pivoting & Exfil](../privesc/pivoting.md).
- Transferring larger sets of files → [Archives & Transfer](transfer.md).
