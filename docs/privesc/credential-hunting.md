---
tags:
  - Privesc
---

# :material-treasure-chest: Credential Hunting

<span class="pill pill-medium">post-ex</span> <span class="pill pill-info">privesc</span>

After any foothold, the fastest escalation is often just *finding a password someone left lying around*. Config files, history, memory, and vaults are full of them.

!!! abstract "TL;DR"
    Grep the filesystem and process memory for secrets, then reuse them to escalate or move laterally. Loot beats exploits.

## :material-linux: Linux

```bash
grep -rniE 'password|passwd|secret|api[_-]?key|token' /etc /var/www /opt 2>/dev/null
cat ~/.bash_history ~/.mysql_history ~/.ssh/id_*
find / -name "*.kdbx" -o -name ".env" -o -name "id_rsa" 2>/dev/null
cat /var/www/**/wp-config.php /etc/*/*.conf
```

## :material-microsoft-windows: Windows

```powershell
findstr /si password *.xml *.ini *.txt *.config
cmdkey /list                              # saved creds
:: unattend/sysprep, Group Policy Preferences
type C:\Windows\Panther\Unattend.xml
:: LSASS in memory (need SeDebug/admin)
```

## :material-key-star: High-value stores

!!! loot "Where secrets cluster"
    - Browser & password-manager databases (`Login Data`, `*.kdbx`).
    - Cloud CLI configs: `~/.aws/credentials`, `~/.azure`, `gcloud`.
    - CI/agent configs, `.git-credentials`, kubeconfig, `.npmrc`, `.pgpass`.
    - Memory: LSASS (Windows), `gcore` a process (Linux).

!!! opsec "Touching LSASS is watched"
    Dumping LSASS is a top EDR trigger — prefer disk-based creds first, or use a signed/comsvcs technique deliberately.

## :material-shield-check: Remediation

- Secrets in a vault, never on disk; rotate on exposure; least-privilege service accounts.

## :material-link-variant: Related

- Fuels [Linux Privesc](linux.md), [Windows Privesc](windows.md), and [Pivoting & Exfil](pivoting.md).
- Cloud keys → [AWS](../cloud/aws.md); domain creds → [Active Directory](../network/active-directory.md).
- Reference: [HackTricks — Credential Hunting](https://book.hacktricks.wiki/).
