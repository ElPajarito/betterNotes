---
tags:
  - Reference
---

# :material-cube-outline: HTB Writeups

<span class="pill pill-info">curated</span> <span class="pill pill-medium">labs</span>

Hack The Box machines & challenges — indexed by **the trick that unlocked them**,
not a step-by-step (that spoils the practice). Same format as [Bug Bounty](bug-bounty.md):
source · technique · takeaway · tags.

!!! warning "Spoiler etiquette"
    The entries below name the *concept*, not the full solution. My own
    step-by-step notes live in the collapsed blocks at the bottom of the page —
    they contain complete solutions and credentials, so open them only after
    you've genuinely tried the box. Retired machines only.

## :material-microsoft-windows: Active Directory

### Forest — AS-REP roast → BloodHound → DCSync
- **Source:** [0xdf — Forest](https://0xdf.gitlab.io/2020/02/29/htb-forest.html)
- **Technique:** AS-REP roasting a no-preauth user → path to `Exchange Windows Permissions` → DCSync.
- **Takeaway:** always check `DONT_REQ_PREAUTH`; let [BloodHound](../network/bloodhound.md) find the ACL path.
- **Tags:** `ad` `asreproast` `dcsync` `bloodhound`

### Sauna — enumeration → AS-REP → autologon creds → DCSync
- **Source:** [0xdf — Sauna](https://0xdf.gitlab.io/2020/07/18/htb-sauna.html)
- **Technique:** user enum from a web page → AS-REP → registry autologon creds → privesc.
- **Takeaway:** names on the "team" web page are your userlist. Autologon creds live in the registry.
- **Tags:** `ad` `kerberos` `credential-hunting`

### Active — GPP password → Kerberoast → DA
- **Source:** [0xdf — Active](https://0xdf.gitlab.io/2018/12/08/htb-active.html)
- **Technique:** SYSVOL `Groups.xml` GPP cpassword → Kerberoast the SPN.
- **Takeaway:** always loot SYSVOL for GPP `cpassword` (AES key is public) → [Kerberos](../network/kerberos.md).
- **Tags:** `ad` `gpp` `kerberoast`

### Blackfield — AS-REP → ForceChangePassword ACL → Backup Operators → NTDS
- **Source:** [0xdf — Blackfield](https://0xdf.gitlab.io/2020/10/03/htb-blackfield.html)
- **Technique:** userlist from an open `profiles$` SMB share → AS-REP roast the no-preauth user → a `ForceChangePassword` ACL lets you reset another account's password over RPC → that user is in **Backup Operators**, so `SeBackupPrivilege` reads `ntds.dit`.
- **Takeaway:** null/guest shares hand you the userlist; let [BloodHound](../network/bloodhound.md) find `ForceChangePassword` edges; Backup Operators = read the whole disk (SAM/NTDS).
- **Tags:** `ad` `asreproast` `acl` `backup-operators` `ntds`

### Intelligence — predictable doc names → password spray → gMSA → constrained delegation
- **Source:** [0xdf — Intelligence](https://0xdf.gitlab.io/2021/11/27/htb-intelligence.html)
- **Technique:** brute the date-based PDF naming scheme to pull docs → a default password hides in one → spray it to land a user → abuse `ReadGMSAPassword` on a gMSA that has constrained delegation to the DC.
- **Takeaway:** guessable filename patterns are an enumeration primitive; always read document metadata/content for default creds; gMSA + delegation is a clean path to DA → [Active Directory](../network/active-directory.md).
- **Tags:** `ad` `password-spraying` `gmsa` `constrained-delegation`

## :material-web: Web → foothold

### Beep / classic — creds reuse across services
- **Source:** [0xdf — Beep](https://0xdf.gitlab.io/2021/06/12/htb-beep.html)
- **Technique:** one leaked password reused on SSH/web/admin.
- **Takeaway:** harvest creds once, spray them everywhere → [Password Spraying](../network/password-spraying.md).
- **Tags:** `password-reuse` `enumeration`

### Knife — vulnerable PHP version backdoor → sudo GTFOBin
- **Source:** [0xdf — Knife](https://0xdf.gitlab.io/2021/09/11/htb-knife.html)
- **Technique:** PHP 8.1.0-dev backdoor header → shell → `sudo knife` GTFOBin.
- **Takeaway:** fingerprint exact versions; check [GTFOBins](../privesc/gtfobins.md) for every `sudo -l` entry.
- **Tags:** `web` `rce` `sudo` `gtfobins`

### Noter — Flask secret brute-force → forged session cookie
- **Source:** [0xdf — Noter](https://0xdf.gitlab.io/2022/09/03/htb-noter.html)
- **Technique:** decode the Flask session cookie → `flask-unsign --unsign` brute-forces the signing secret against a wordlist → re-sign a cookie with a privileged `username`/`logged_in` to become another user.
- **Takeaway:** any Flask app is one weak `SECRET_KEY` away from full session forgery — always run `flask-unsign` on `eyJ…`-style cookies.
- **Tags:** `web` `flask` `session-forgery` `auth-bypass`

### Titanic — path-traversal file read → crack DB hash → root
- **Source:** [0xdf — Titanic](https://0xdf.gitlab.io/2025/06/21/htb-titanic.html)
- **Technique:** a `download?ticket=` parameter is vulnerable to directory traversal → read the Gitea DB → crack a user hash reused on SSH → a root cron running ImageMagick on uploads is exploited via a known CVE.
- **Takeaway:** every download/export param is an arbitrary-file-read candidate; loot app databases for reusable hashes; audit root cron jobs that process user-controlled files.
- **Tags:** `web` `path-traversal` `file-read` `cron` `cve`

## :material-linux: Linux privesc

### Lame / classic — known-service exploit
- **Source:** [0xdf — Lame](https://0xdf.gitlab.io/2020/04/07/htb-lame.html)
- **Technique:** Samba `usermap_script` command injection.
- **Takeaway:** old service versions have public exploits — enumerate version first, `searchsploit` second.
- **Tags:** `smb` `rce` `searchsploit`

### Various — SUID / capabilities / cron privesc
- **Source:** [HackTricks Linux privesc](https://book.hacktricks.wiki/en/linux-hardening/privilege-escalation/index.html)
- **Technique:** `linpeas` → unusual SUID / capability / writable cron.
- **Takeaway:** run [linPEAS](../privesc/linux.md), read slowly, cross-ref GTFOBins.
- **Tags:** `linux` `suid` `privesc`

## :material-puzzle: Challenges (crypto / rev / pwn)

### General pwn — classic buffer overflow → shell
- **Source:** [0xdf — pwn writeups](https://0xdf.gitlab.io/)
- **Technique:** stack overflow, ret2win / ret2libc.
- **Takeaway:** check protections (`checksec`) first — they dictate the whole approach.
- **Tags:** `pwn` `bof` `binexp`

## :material-notebook: Full walkthroughs — my own notes

Complete step-by-step notes for each machine, translated from my originals, with
the screenshots I took at the time. They contain working credentials, so they live
on their own pages rather than inline here.

<div class="grid cards" markdown>

-   :material-microsoft-windows:{ .lg .middle } __Active Directory__

    ---
    [Active](htb/active.md) · [Blackfield](htb/blackfield.md) · [Forest](htb/forest.md) · [Sauna](htb/sauna.md) · [Intelligence](htb/intelligence.md)

-   :material-web:{ .lg .middle } __Web / Linux__

    ---
    [Titanic](htb/titanic.md) · [Noter](htb/noter.md)

</div>

## :material-book-open-page-variant: Where to find more

- [0xdf.gitlab.io](https://0xdf.gitlab.io/) — the gold-standard HTB writeups (retired boxes).
- [IppSec YouTube](https://www.youtube.com/c/ippsec) + [ippsec.rocks](https://ippsec.rocks/) — searchable video writeups by technique.
- [HTB official writeups](https://www.hackthebox.com/) (retired, with VIP).
- [S1REN / Rana Khalil / others](https://www.youtube.com/) — walkthroughs by topic.

## :material-link-variant: Related

- Bug-bounty-style real-world writeups → [Bug Bounty](bug-bounty.md).
- Apply these on a real engagement: [Internal / AD Checklist](../checklists/internal-ad.md) · [Web Checklist](../checklists/web.md).
- Cert prep that uses boxes like these → [Certification Roadmaps](certifications.md).
