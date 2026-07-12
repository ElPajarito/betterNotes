---
tags:
  - Linux
  - Reference
icon: material/toolbox
---

# :material-toolbox: The Toolbox

> Warp zone. Every world above assumes you can already move around a Linux box, wrangle text, and fix the little things that break. This is that baseline — short, copy-pasteable, no fluff.

<div class="grid cards" markdown>

-   :material-folder-search:{ .lg .middle } __Navigation & Files__

    ---
    Move around, find anything, manage files without fear.

    [:octicons-arrow-right-24: Navigation](navigation.md) · [Files](files.md)

-   :material-text-search:{ .lg .middle } __Text Processing__

    ---
    grep / sed / awk — slice logs and output like a pro.

    [:octicons-arrow-right-24: Text](text.md)

-   :material-cog-play:{ .lg .middle } __Processes & Services__

    ---
    See what's running, kill it, run things in the background.

    [:octicons-arrow-right-24: Processes](processes.md)

-   :material-lan:{ .lg .middle } __Networking & SSH__

    ---
    Check connectivity, resolve names, move files, tunnel.

    [:octicons-arrow-right-24: Networking](networking.md) · [SSH](ssh.md)

-   :material-lifebuoy:{ .lg .middle } __When It Breaks__

    ---
    The errors you'll actually hit, and how to fix them fast.

    [:octicons-arrow-right-24: Troubleshooting](troubleshooting.md)

</div>

## :material-format-list-bulleted-square: Full index

- **Shell basics** — [Navigation & Finding](navigation.md) · [Files & Permissions](files.md) · [Text Processing](text.md)
- **System** — [Processes & Services](processes.md) · [Disk & Filesystem](disk.md) · [Users & Sudo](users.md) · [Packages](packages.md) · [Logs & System Info](logs.md)
- **Networking & Transfer** — [Networking](networking.md) · [SSH & Keys](ssh.md) · [Archives & Transfer](transfer.md)
- **Fixing things** — [Troubleshooting](troubleshooting.md) · [Bash Tips](bash.md)

## :material-flash: Survival cheat card

| I want to… | Command |
| --- | --- |
| See where I am | `pwd` |
| List everything, incl. hidden | `ls -la` |
| Find a file by name | `find / -name '*.conf' 2>/dev/null` |
| Search text inside files | `grep -rn "needle" .` |
| What's using this port? | `ss -tlnp \| grep :80` |
| Free disk / what's huge | `df -h` · `du -sh * \| sort -h` |
| Who am I / my groups | `id` |
| Read a service's logs | `journalctl -u nginx -e` |

!!! tip "How to read these pages"
    Each page is a **cheat sheet, not a course** — the flags you actually use, one line each. `man <cmd>` or `<cmd> --help` is always the full reference.
