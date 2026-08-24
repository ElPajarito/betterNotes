---
tags:
  - Linux
  - Reference
---

# :material-console-line: Bash Tips & Shortcuts

<span class="pill pill-medium">speed</span> <span class="pill pill-info">quality of life</span>

The shell tricks that make you fast: redirection, history, loops, and the keyboard shortcuts that stop you retyping lines.

!!! abstract "TL;DR"
    `>`/`>>`/`2>&1` redirect, `|` pipe, `$(...)` capture output, `Ctrl-R` search history, `!!`/`!$` reuse the last command/arg, `for` loops for repetition.

## :material-arrow-right-bold: Redirection

```bash
cmd > out.txt          # stdout → file (overwrite)
cmd >> out.txt         # stdout → file (append)
cmd 2> err.txt         # stderr → file
cmd > all.txt 2>&1     # stdout AND stderr → one file
cmd 2>/dev/null        # discard errors
cmd | tee out.txt      # see output AND save it
```

## :material-history: History reuse

```bash
history                # numbered list of past commands
!!                     # the entire last command
sudo !!                # re-run it with sudo
!$                     # last argument of the previous command
!123                   # run history item 123
Ctrl-R                 # reverse-search history as you type
```

## :material-variable: Variables & substitution

```bash
name="world"; echo "hi $name"    # use "double quotes" to expand
echo '$name is literal'          # 'single quotes' = no expansion
files=$(ls *.txt)                # capture command output
echo "today is $(date +%F)"      # inline a command
export API_KEY=xyz               # pass to child processes
```

## :material-repeat: Loops & xargs

```bash
for i in 1 2 3; do echo "host$i"; done
for f in *.log; do gzip "$f"; done
seq 1 5 | while read n; do echo "n=$n"; done
cat urls.txt | xargs -n1 curl -sI   # run a command per line
find . -name '*.tmp' | xargs rm     # feed results into a command
```

## :material-keyboard: Keyboard shortcuts

| Keys | Does |
| --- | --- |
| ++ctrl+a++ / ++ctrl+e++ | Jump to start / end of line |
| ++ctrl+u++ / ++ctrl+k++ | Delete to start / end of line |
| ++ctrl+w++ | Delete the word before the cursor |
| ++ctrl+l++ | Clear the screen (like `clear`) |
| ++ctrl+r++ | Search command history |
| ++ctrl+c++ / ++ctrl+d++ | Cancel command / send EOF (logout) |
| ++alt+"."++ | Insert last argument of previous command |

!!! tip "Chaining commands"
    `a && b` runs `b` only if `a` succeeded. `a || b` runs `b` only if `a` failed. `a ; b` runs both regardless. Great for `make && ./run || echo FAILED`.

## :material-file-find: Finding files & handy recipes

```bash
find . -type f -name "*.xml"     # files ending .xml ( -type f ignores dirs )
find . -type f -iname "*.xml"    # case-insensitive
grep -rin "string" .             # recursive, case-insensitive, with line numbers

# proxy a python script through Burp without touching its code
HTTP_PROXY="http://127.0.0.1:8080" HTTPS_PROXY="http://127.0.0.1:8080" \
  REQUESTS_CA_BUNDLE="/path/to/burp-cert.pem" python3 script.py

# pull URLs out of a JSON/wayback dump
cat site.json | grep -oP 'https?://[^"]+' > urls.txt
```

!!! tip "Keep a command out of history"
    Prefix a command with a **leading space** and it won't be saved to shell history (needs `HISTCONTROL=ignorespace`/`ignoreboth`, the default on most distros). Handy for one-off commands containing secrets.

## :material-git: Git essentials

```bash
# wire a local repo to a new remote and push
git remote add origin git@github.com:<user>/<repo>.git
git branch -M main
git push -u origin main
git pull origin main

# load your key so SSH pushes stop prompting
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519

# committing a deletion (staging removes tracked files too)
git add path/to/file        # stages the deletion as well as edits
git commit -m "Remove file"
```

## :material-lan: VM as a gateway for another VM

Route a client VM's traffic through a second "router" VM (e.g. Kali → Ubuntu → internet) so the client only ever talks to the gateway.

```text
Adapters (VirtualBox):
  Gateway VM  Adapter1 = NAT/Bridged (WAN)   Adapter2 = Internal Network "proxy_net"
  Client  VM  Adapter1 = Internal Network "proxy_net"   (name must match)
```

```bash
# --- on the GATEWAY VM ---
ip a                                             # find WAN (has IP, e.g. enp0s3) + LAN (no IP, enp0s8)
sudo ip addr add 10.10.10.1/24 dev enp0s8        # give the LAN iface a static IP
sudo ip link set enp0s8 up
sudo sysctl -w net.ipv4.ip_forward=1             # enable forwarding (persist in /etc/sysctl.conf)
# NAT the internal net out through the WAN iface
sudo iptables -t nat -A POSTROUTING -o enp0s3 -j MASQUERADE
sudo iptables -A FORWARD -i enp0s3 -o enp0s8 -m state --state RELATED,ESTABLISHED -j ACCEPT
sudo iptables -A FORWARD -i enp0s8 -o enp0s3 -j ACCEPT

# --- on the CLIENT VM ---
sudo ip addr flush dev eth0
sudo ip addr add 10.10.10.2/24 dev eth0
sudo ip link set eth0 up
sudo ip route add default via 10.10.10.1         # send everything through the gateway
echo "nameserver 8.8.8.8" | sudo tee /etc/resolv.conf
```

!!! tip "Verify in order"
    From the client: `ping 10.10.10.1` (internal link) → `ping 8.8.8.8` (forwarding/NAT) → `ping google.com` (DNS). If `8.8.8.8` works but the domain fails, it's purely a `/etc/resolv.conf` DNS issue.

## :material-link-variant: Related

- Feeding output into filters → [Text Processing](text.md).
- Persistent aliases live in `~/.bashrc` / `~/.zshrc`.
