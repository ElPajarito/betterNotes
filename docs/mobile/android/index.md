---
tags:
  - Mobile
icon: material/android
---

# :material-android: Android App Pentesting

<span class="pill pill-medium">client-side</span> <span class="pill pill-info">mobile</span>

An APK is a signed zip of Dalvik bytecode, resources, and native libs. You can
unpack it, read it, patch it, and re-run it — so every client-side secret and
control is in reach.

!!! abstract "TL;DR"
    Pull the APK → `jadx` for source, `apktool` for smali → grep for secrets →
    proxy the traffic (bypass pinning with Frida/Objection) → hook the runtime →
    then attack the API and local storage.

<div class="grid cards" markdown>

-   :material-cellphone-cog:{ .lg .middle } __Emulator & Setup__

    ---
    Rooted AVD with Magisk, matching `frida-server`, proxy and CA install.

    [:octicons-arrow-right-24: Build the lab](emulator.md)

-   :material-package-variant:{ .lg .middle } __APKs, AABs & Signing__

    ---
    Get the package off the device, convert bundles, rebuild and re-sign.

    [:octicons-arrow-right-24: Get the app](apks.md)

-   :material-needle:{ .lg .middle } __Frida & Objection__

    ---
    Hook the runtime: pinning, root detection, integrity attestation, `FLAG_SECURE`.

    [:octicons-arrow-right-24: Instrument it](frida.md)

-   :material-shape-outline:{ .lg .middle } __Components & Intents__

    ---
    Activities, Services, Receivers, Providers — and the intents that reach them.

    [:octicons-arrow-right-24: Attack the surface](components.md)

</div>

## :material-layers-triple: The platform model

Everything you do to an Android app is shaped by four facts about the OS.

**It's Linux underneath.** The stack runs Applications → Application Framework
(Activity/Package/Window managers, Content Providers) → Libraries + Android
Runtime (SQLite, WebKit, SSL, libc; Dalvik/ART) → Hardware Abstraction Layer →
Linux kernel, where the **Binder** driver carries all IPC.

**Every app is a Linux user.** Each package gets its own UID and its own security
sandbox — standard process isolation plus restricted filesystem permissions. Its
private directory (*internal storage*) is unreadable by any other app. Apps in a
sandbox cannot talk to each other or do anything security-sensitive without going
through the framework, which is why **exported components and intents matter so
much**: they are the sanctioned holes in that wall.

**Multiuser changes every path you type.** Each user has separate app data, and
the user id is baked into the paths and the UID:

```bash
/data/data/{userId}/{app.path}          # per-user app sandbox
/sdcard/{userId}                        # per-user external storage
# UID naming in `ps`/`ls`:  u0_a228  ->  user 0, app 228
```

```bash
adb shell pm list users                 # who exists
adb shell am get-current-user           # who is in the foreground
adb shell pm list packages --user <id>  # packages for one user
adb install   --user <id> app.apk
adb uninstall --user <id> com.target.app
```

!!! tip "Wrong user = empty directory"
    If `run-as` or a `pm path` lookup comes back empty on a device with a work
    profile or a second user, you are almost certainly looking at user 0 while
    the app is installed for another. Check `pm list users` first.

**Partitions worth knowing:**

| Path | What's on it |
| --- | --- |
| `/data` | App sandboxes — the interesting one |
| `/cache` | Frequently accessed app data and components |
| `/misc` | Miscellaneous system settings — carrier/region ID, USB config, hardware switches |
| `/sdcard` | User-accessible storage; world-readable, so a classic leak sink |
| `/sd-ext` | Extra sdcard partition, only on some custom-ROM devices |

## :material-clipboard-check: Workflow

1. [x] Route traffic through Burp; test for root detection and pinning up front
2. [x] **Use the app for 30 minutes** — you cannot attack flows you have never seen
3. [x] Static analysis pass: MobSF / Quark / AndroBugs
4. [x] Read `AndroidManifest.xml` for `allowBackup`, `debuggable`, `exported`
5. [x] `resources.arsc` / `strings.xml` — devs are told to put strings here, so they do
6. [x] `res/xml/file_paths.xml` — where the app is allowed to write
7. [x] Database encryption under `/data/data/<package>/`; check source for DB creds
8. [x] `adb backup com.target.app` if backups are allowed
9. [x] Watch **logcat** during login and every sensitive action
10. [ ] External storage: `/sdcard/Android/data/com.target.app/`

## :material-file-search: Static analysis

```bash
# Decompile to readable Java
jadx -d out/ base.apk        # or the jadx-gui for point-and-click
# Smali + resources (for repackaging)
apktool d base.apk -o smali_out/
```

Automated first pass:

```bash
# MobSF — full static (and dynamic) analysis web UI
docker run -it --rm -p 8000:8000 opensecurity/mobile-security-framework-mobsf:latest
# Quark — behaviour/rule engine
pipenv shell && quark -a target.apk -r rules/ --detail
# AndroBugs — classic vuln scanner
python androbugs.py -f target.apk
```

!!! loot "Where Android apps leak secrets"
    ```bash
    grep -rEi 'api[_-]?key|secret|password|token|bearer|firebase|s3|aws' out/
    # The usual hiding spots:
    #   res/values/strings.xml     AndroidManifest.xml
    #   assets/  res/raw/          BuildConfig.java (compile-time constants)
    #   .so native libs (strings)  google-services.json (Firebase)
    ```
    Firebase URLs → test for open `/.json`. Cloud keys → straight to
    [AWS](../../cloud/aws.md) / [GCP](../../cloud/gcp.md).

    What counts as hardcoded-and-reportable: credentials and PINs, cryptographic
    keys, keys for encrypted databases, API/private keys **even when base64'd or
    XOR'd**, and internal server IPs.

### The manifest tells you the attack surface

```bash
apktool d base.apk; less smali_out/AndroidManifest.xml
```

- **`android:exported="true"`** components (Activity/Service/Receiver/Provider)
  are callable by any other app → see [Components & Intents](components.md).
- **`android:debuggable="true"`** → attach a debugger, `run-as` the app.
- **`android:allowBackup="true"`** → `adb backup` extracts app data with no root.
- **`usesCleartextTraffic="true"`** → HTTP allowed; look for creds in the clear.

## :material-database-eye: Local storage

!!! loot "Data left on the device"
    ```bash
    adb shell run-as com.target.app ls -la /data/data/com.target.app/
    #   shared_prefs/*.xml   -> tokens, flags, PII in plaintext
    #   databases/*.db       -> sqlite3, look for creds/session
    #   files/  cache/       -> downloaded content, logs
    adb shell run-as com.target.app cat shared_prefs/auth.xml
    ```
    Also check external storage (world-readable): `adb shell ls /sdcard/Android/data/...`.

```bash
# Pull an app's DB without root via debuggable/run-as
adb exec-out run-as com.target.app cat databases/appName > app.db && sqlitebrowser app.db
# Or, as root, mass-copy the sandbox out
adb shell su -c 'cp -r /data/data/com.target.app/databases /sdcard/dump'
adb pull /sdcard/dump ~/Downloads
```

## :material-console-line: adb & runtime tips

```bash
# Colour logcat scoped to one app (pidcat alternative)
adb logcat -v color --pid=$(adb shell pidof -s com.target.app)
# Filter the log by a keyword while you drive the app
adb logcat | grep -i target
# One-liner to locate an installed app's base APK
adb shell su -c "pm path com.target.app"
# Devices Frida can see
frida-ls-devices
```

!!! bug "What is actually a finding"
    Bypassing root detection or certificate pinning is **not** a vulnerability —
    it is how you get to work. A **fingerprint/biometric bypass** is. So is
    **ECB** mode, and an encryption key that is fixed rather than regenerated
    per run.

## :material-link-variant: Related

- Every intercepted request is an [API attack surface](../../web/index.md):
  [Auth Bypass](../../web/auth-bypass.md), [JWT](../../web/jwt.md),
  [SQLi](../../web/sqli.md), IDOR.
- iOS counterpart: [iOS App Pentesting](../ios.md).
- Free labs → [Mobile Hacking Lab](https://www.mobilehackinglab.com/free-mobile-hacking-labs); checklist → [MobileApp-Pentest-Cheatsheet](https://github.com/tanprathan/MobileApp-Pentest-Cheatsheet).
- Reference: [OWASP MASTG — Android](https://mas.owasp.org/MASTG/), [apktool](https://apktool.org/), [jadx](https://github.com/skylot/jadx).
