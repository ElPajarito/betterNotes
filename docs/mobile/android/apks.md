---
tags:
  - Mobile
---

# :material-package-variant: APKs, AABs & Signing

<span class="pill pill-info">mobile</span> <span class="pill pill-medium">repackaging</span>

Getting the package off the device, understanding why modern apps arrive in
pieces, and re-signing whatever you rebuild — because **an unsigned APK will not
install**.

!!! abstract "TL;DR"
    `pm path` → `adb pull` → `apktool d` → edit → `apktool b` → sign with
    `uber-apk-signer`. Bundles (`.aab`) need `bundletool` to become installable
    APKs first.

## :material-download: Get the APK off the device

Installed apps live under `/data/app`, one folder per app. The layout changed at
Android 12:

```text
Android <= 11   /data/app/com.google.android.apps.docs-3ard7NFLP7DMStroVv5lSQ==
Android >= 12   /data/app/~~BXaKKCyC579zuEf5DPdKEw==/com.google.android.apps.docs-3ard7NFLP7DMStroVv5lSQ==
```

Those random segments change on every install, so never hardcode the path — ask
for it:

```bash
adb shell pm list packages | grep -i target      # find the package name
adb shell pm path com.target.app                 # locate the base APK(s)
adb pull /data/app/~~.../com.target.app-.../base.apk .
```

As a one-liner, and via the device shell when you need root:

```bash
adb shell su -c "pm path com.target.app"
# or interactively
adb shell
pm list packages | grep target
pm path com.target.app
```

Not on a device at all? `apkeep -a com.target.app ./` pulls from a mirror.

### Split APKs

Most modern apps ship split: a `base.apk` plus `split_config.*` for
architecture, density and language. `pm path` lists them all — you need the set,
not just the base, or the rebuilt app will crash on missing resources.

## :material-package: AAB — the bundle format

An **AAB (Android App Bundle)** is a *publishing* format; an **APK** is the
*packaging* format that actually installs. The developer uploads one `.aab` and
Google Play generates a tailored APK per device configuration, so each user
downloads only the code and resources their device needs.

For testing you want the **universal** APK — every configuration in one file:

```bash
# Convert an .aab bundle to an installable universal APK
java -jar bundletool.jar build-apks --bundle=app.aab --output=app.apks --mode=universal
mv app.apks app.zip && unzip app.zip
```

The longer route, if you need the bundle signed and installed as-is:

```bash
# 1. Sign the .aab (can often be skipped — try without it first)
jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 \
  -keystore <keystore> <bundle.aab> androiddebugkey
# 2. Build the .apks set from the bundle
java -jar bundletool-all.jar build-apks --bundle=<bundle.aab> --output=<out.apks> \
  --ks=<keystore> --ks-key-alias=androiddebugkey --ks-pass=pass:android
# 3. Install the set
java -jar bundletool-all.jar install-apks --adb=/usr/bin/adb --apks=<out.apks>
```

## :material-wrench: Repackage & patch

```bash
apktool d base.apk -o work/          # decompile (the manifest is usually binary)
# ...edit smali (e.g. force a root/pinning check to return false)...
apktool b work/ -o patched.apk       # rebuild
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

!!! tip "Lowering minSdk to run on your emulator"
    App refuses to install because your image is too old? After `apktool d`, edit
    **`apktool.yml`** → lower `minSdkVersion`, then `apktool b` and re-sign. The
    same trick makes a release build debuggable — add `android:debuggable="true"`
    to the manifest before rebuilding.

## :material-draw-pen: Signing

Full manual chain — generate a keystore, then sign:

```bash
# Generate a keystore
keytool -genkey -v -keystore my.keystore -storepass pass -alias androiddebugkey \
  -dname "CN=Android Debug,O=Android,C=US" -keyalg RSA -sigalg SHA256withRSA -keysize 2048

# v1 signing
jarsigner -verbose -keystore my.keystore patched.apk androiddebugkey

# ...or apksigner (v2), which the store now requires
apksigner sign --ks my.keystore --ks-key-alias androiddebugkey patched.apk
apksigner sign --in patched.apk --out final.apk --ks my.keystore \
  --ks-key-alias androiddebugkey --v2-signing-enabled
```

If the keystore was generated with the command above, `--ks-key-alias` can be
omitted — `androiddebugkey` is the default alias.

Skip the whole dance:

```bash
# Auto-sign
java -jar uber-apk-signer.jar -a patched.apk       # github.com/patrickfav/uber-apk-signer
# Auto-patch an app to defeat cert pinning WITHOUT writing a Frida script
npm install -g apk-mitm && apk-mitm universal.apk && adb install universal-patched.apk
```

!!! tip "apk-mitm is the fastest path to intercepted traffic"
    It rewrites the network security config and strips pinning for you. When it
    works you never touch Frida; when it fails you have learned the app pins in
    native code — go to [Frida & Objection](frida.md).

## :material-link-variant: Related

- Hooking instead of patching → [Frida & Objection](frida.md).
- Where to install it → [Emulator & Setup](emulator.md).
- What to read once it's decompiled → [Android](index.md).
