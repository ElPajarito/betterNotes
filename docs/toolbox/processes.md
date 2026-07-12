---
tags:
  - Linux
  - Reference
---

# :material-cog-play: Processes & Services

<span class="pill pill-easy">basics</span> <span class="pill pill-info">systemd</span>

See what's running, stop what's misbehaving, and run things in the background. On modern distros, long-running services live under **systemd**.

!!! abstract "TL;DR"
    `ps aux` / `top` to see, `kill` to stop, `&` + `nohup` to background, `systemctl` to manage services, `journalctl -u name` to read their logs.

## :material-format-list-checks: What's running

```bash
ps aux                 # every process, with CPU/MEM
ps aux | grep nginx    # filter (or: pgrep -a nginx)
top                    # live view (q quits, P sort by CPU, M by MEM)
htop                   # nicer top, if installed
pstree -p              # process tree with PIDs
```

## :material-close-octagon: Stopping processes

```bash
kill 1234              # polite TERM signal
kill -9 1234           # forceful KILL (last resort)
pkill -f "python app"  # kill by matching command line
killall firefox        # kill by exact process name
```

!!! tip "Signals in one line"
    `kill` sends `TERM` (asks nicely — lets the process clean up). `kill -9` sends `KILL` (can't be caught — use only if `TERM` hangs). `kill -HUP` often reloads config without a restart.

## :material-arrow-expand-right: Foreground & background

```bash
long_task &            # run in background
jobs                   # list background jobs of this shell
fg %1                  # bring job 1 to foreground
Ctrl-Z                 # suspend the foreground job
bg %1                  # resume it in the background
nohup ./run.sh &       # survive logout (output → nohup.out)
disown -a              # detach jobs from the shell
```

## :material-server: systemd services

```bash
systemctl status nginx      # is it running? recent logs
systemctl start nginx       # start now
systemctl stop nginx        # stop now
systemctl restart nginx     # bounce it
systemctl enable nginx      # start on boot
systemctl enable --now nginx  # enable + start in one go
systemctl list-units --type=service --state=running
```

!!! note "Load and pressure"
    `uptime` shows load averages (1/5/15 min). A rough rule: load ≈ number of CPU cores means "fully busy"; well above that means work is queuing.

## :material-link-variant: Related

- Reading a service's output → [Logs & System Info](logs.md).
- Abusing services/timers for persistence → [Linux Privesc](../privesc/linux.md).
