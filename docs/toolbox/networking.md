---
tags:
  - Linux
  - Reference
---

# :material-lan: Networking

<span class="pill pill-medium">essential</span> <span class="pill pill-info">connectivity</span>

Check your addresses, prove connectivity, resolve names, and talk to services. When "the internet is down," these commands tell you *which* layer actually broke.

!!! abstract "TL;DR"
    `ip a` your addresses, `ip r` your routes, `ping`/`dig` reachability + DNS, `ss -tlnp` listening ports, `curl` talk to HTTP. (`ifconfig`/`netstat` are the deprecated equivalents.)

## :material-ip-network: Interfaces & routes

```bash
ip a                   # addresses on every interface
ip r                   # routing table (default gateway)
ip -br a               # brief one-line-per-interface view
sudo ip link set eth0 up   # bring an interface up
```

## :material-connection: Is it reachable?

```bash
ping -c4 8.8.8.8       # raw IP connectivity (4 packets)
ping -c4 google.com    # if IP works but name fails → DNS problem
traceroute google.com  # path + where it stalls (or: mtr)
```

## :material-dns: DNS lookups

```bash
dig example.com                 # full answer
dig +short example.com          # just the IP
dig example.com MX              # mail records
dig @1.1.1.1 example.com        # ask a specific resolver
nslookup example.com            # simple alternative
cat /etc/resolv.conf            # which resolvers you're using
```

## :material-lan-connect: Ports & connections

```bash
ss -tlnp               # TCP listening ports + owning process
ss -tunap              # all TCP+UDP with PIDs
ss -tlnp | grep :443   # who's on 443?
```

## :material-web: Talking to services

```bash
curl -I https://site           # headers only
curl -sSL https://site         # follow redirects, quiet
curl -d 'a=1&b=2' https://site # POST form data
nc -vz host 22                 # test if a TCP port is open
nc -lvnp 4444                  # listen (handy for quick tests)
```

!!! tip "Name vs. address split"
    If `ping 8.8.8.8` works but `ping google.com` doesn't, routing is fine and **DNS is broken** — check `/etc/resolv.conf`. Fix names locally via `/etc/hosts`.

## :material-link-variant: Related

- Scanning/enumerating what you find → [Network Recon](../network/recon.md).
- Remote shells and tunnels → [SSH](ssh.md) · [Pivoting](../privesc/pivoting.md).
