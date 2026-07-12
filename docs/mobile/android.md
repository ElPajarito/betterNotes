---
tags:
  - Mobile
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

## :material-download: Get the APK off the device

```bash
adb shell pm list packages | grep -i target      # find the package name
adb shell pm path com.target.app                 # locate the base APK(s)
adb pull /data/app/.../base.apk .
# Split APKs (most modern apps): grab them all and merge
adb shell pm path com.target.app                 # lists base + split_*.apk
apkeep -a com.target.app ./                       # or pull straight from a mirror
```

!!! tip "No device? Use an emulator"
    `avdmanager` / Genymotion give you a rooted-ish image. Prefer a **Google APIs**
    (not Play) image — it's easy to root and lets you drop a system CA.

## :material-file-search: Static analysis

```bash
# Decompile to readable Java
jadx -d out/ base.apk        # or the jadx-gui for point-and-click
# Smali + resources (for repackaging)
apktool d base.apk -o smali_out/
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
    [AWS](../cloud/aws.md) / [GCP](../cloud/gcp.md).

### The manifest tells you the attack surface

```bash
apktool d base.apk; less smali_out/AndroidManifest.xml
```

- **`android:exported="true"`** components (Activity/Service/Receiver/Provider)
  are callable by any other app → launch them directly:
  ```bash
  adb shell am start -n com.target.app/.SecretActivity
  adb shell content query --uri content://com.target.app.provider/users
  ```
- **`android:debuggable="true"`** → attach a debugger, `run-as` the app.
- **`android:allowBackup="true"`** → `adb backup` extracts app data with no root.
- **`usesCleartextTraffic="true"`** → HTTP allowed; look for creds in the clear.

## :material-swap-horizontal: Proxying + SSL pinning bypass

Route traffic through Burp, then defeat pinning:

=== "Objection (fastest)"

    ```bash
    objection -g com.target.app explore
    android sslpinning disable
    ```

=== "Frida script"

    ```bash
    frida -U -f com.target.app -l frida-pinning-bypass.js
    # Popular: 'Universal Android SSL Pinning Bypass' (Codeshare)
    ```

!!! bug "Traffic still won't decrypt?"
    - **Android 7+ ignores user CAs** — a Frida/Objection bypass is usually
      required, or repackage with a `network_security_config.xml` that trusts user
      certs (see below).
    - **Certificate *pinning* ≠ user-CA distrust** — you may need to beat both.
    - **Flutter / React Native / Xamarin** apps route through their own HTTP stack,
      not the system proxy. Flutter ignores proxy settings entirely — use
      `reFlutter`, or hook BoringSSL with Frida.
    - **Native pinning in a `.so`** won't be hooked by Java-level scripts — hook the
      native `SSL_CTX_set_custom_verify` / `ByteArray` instead.

## :material-wrench: Repackage & patch

When you can't hook, rewrite the app:

```bash
apktool d base.apk -o work/
# ...edit smali (e.g. force a root/pinning check to return false)...
apktool b work/ -o patched.apk
# sign it (unsigned APKs won't install)
apksigner sign --ks debug.keystore patched.apk
adb install patched.apk
```

Add a network config to trust your CA before rebuilding:

```xml
<!-- res/xml/network_security_config.xml, referenced from the manifest -->
<network-security-config>
  <base-config><trust-anchors>
    <certificates src="user"/><certificates src="system"/>
  </trust-anchors></base-config>
</network-security-config>
```

## :material-database-eye: Local storage & runtime

!!! loot "Data left on the device"
    ```bash
    adb shell run-as com.target.app ls -la /data/data/com.target.app/
    #   shared_prefs/*.xml   -> tokens, flags, PII in plaintext
    #   databases/*.db       -> sqlite3, look for creds/session
    #   files/  cache/       -> downloaded content, logs
    adb shell run-as com.target.app cat shared_prefs/auth.xml
    ```
    Also check external storage (world-readable): `adb shell ls /sdcard/Android/data/...`.

- **Frida runtime tricks** — dump decrypted strings, bypass root detection, log
  crypto calls, tamper with return values (`objection ... android root disable`).
- **Deep links / intents** — a malicious app or a crafted `intent://` URL can hit
  exported handlers; test for injection and auth bypass in `am start -d`.

## :material-shield-check: Remediation (for the report)

- Don't ship secrets in the client; fetch short-lived tokens from the backend.
- Enforce every security control **server-side** — the client is untrusted.
- Pin certificates *and* store nothing sensitive in plaintext (`EncryptedSharedPreferences`, Keystore).
- Set `exported=false`, `debuggable=false`, `allowBackup=false`.

## :material-link-variant: Related

- Every intercepted request is an [API attack surface](../web/index.md):
  [Auth Bypass](../web/auth-bypass.md), [JWT](../web/jwt.md),
  [SQLi](../web/sqli.md), IDOR.
- iOS counterpart: [iOS App Pentesting](ios.md).
- Reference: [OWASP MASTG — Android](https://mas.owasp.org/MASTG/), [apktool](https://apktool.org/), [jadx](https://github.com/skylot/jadx).
