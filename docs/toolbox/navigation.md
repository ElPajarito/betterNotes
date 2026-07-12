---
tags:
  - Linux
  - Reference
---

# :material-folder-search: Navigation & Finding

<span class="pill pill-easy">basics</span> <span class="pill pill-info">everyday</span>

Getting around the filesystem and locating files without clicking through folders. This is muscle memory you'll use every single session.

!!! abstract "TL;DR"
    `pwd` where am I, `cd` move, `ls -la` look, `find` locate by name/attribute, `grep -r` locate by content. `cd -` jumps back to the last dir.

## :material-map-marker: Where am I / moving

```bash
pwd                 # print working directory
cd /etc             # absolute path
cd ../..            # up two levels
cd ~                # home ( or just: cd )
cd -                # back to the PREVIOUS directory (toggle)
pushd /var/log; popd  # remember a dir, come back to it
```

## :material-format-list-bulleted: Listing

```bash
ls -la              # long format + hidden (dotfiles)
ls -lh              # human-readable sizes
ls -lt              # newest first  (-ltr = oldest last, handy for /tmp)
ls -d */            # only directories
tree -L 2           # visual tree, 2 levels deep
```

## :material-magnify: Finding files

=== "By name / type"

    ```bash
    find . -name '*.log'                 # glob, case-sensitive
    find / -iname 'id_rsa' 2>/dev/null   # case-insensitive, hide errors
    find . -type d -name 'conf*'         # directories only
    find /var -type f -size +100M        # files bigger than 100 MB
    find . -mmin -10                     # modified in last 10 minutes
    ```

=== "Fast index (locate)"

    ```bash
    sudo updatedb          # refresh the index
    locate nginx.conf      # instant, but only as fresh as updatedb
    ```

=== "By content (grep)"

    ```bash
    grep -rn "password" /etc 2>/dev/null   # recursive, with line numbers
    ```

## :material-arrow-decision: Where does a command live?

```bash
which python3     # path of the binary that runs
type ll           # is it a binary, alias, or function?
command -v curl   # script-safe existence check
```

!!! tip "Wildcards (globbing)"
    `*` = any chars, `?` = one char, `[a-z]` = a range, `{jpg,png}` = alternatives, `**` = recursive (with `shopt -s globstar`). The **shell** expands these before the command runs.

## :material-link-variant: Related

- Search *inside* files at scale → [Text Processing](text.md).
- Hunting creds/keys on a target → [Credential Hunting](../privesc/credential-hunting.md).
