---
tags:
  - Mobile
---

# :material-needle: Frida & Objection

<span class="pill pill-hard">runtime</span> <span class="pill pill-info">mobile</span>

Frida injects a JavaScript engine into the running app, so you can replace any
method's implementation while it runs. Objection is a ready-made Frida toolkit —
reach for it first, and drop to raw Frida when it can't do what you need.

!!! abstract "TL;DR"
    `frida-ps -Uai` to find the process → `frida -Uf <pkg> -l script.js` to spawn
    and hook → or `objection -g <pkg> explore` for the batteries-included version.

## :material-format-list-bulleted: Find the process

```bash
frida-ls-devices          # devices Frida can see
frida-ps -Uai
```

| Flag | Meaning |
| --- | --- |
| `-U` | List processes on a **USB**-connected device |
| `-a` | Show **system apps** in addition to user apps |
| `-i` | Display process **information** such as PIDs |

## :material-play: Spawn vs attach

```bash
frida -Uf com.target.app -l script.js     # SPAWN the app with the hook already in place
frida -U  com.target.app -l script.js     # ATTACH to an app that is already running
```

Spawn (`-f`) is what you want almost always: root and pinning checks usually run
in `onCreate()`, long before you could attach.

!!! bug "`Failed to spawn` errors"
    Usually the `frida-server` version does not match your host `frida`, or it is
    not running as root. Re-check both — see [Emulator & Setup](emulator.md).

## :material-lock-open: SSL pinning

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

=== "Patch instead"

    ```bash
    apk-mitm universal.apk && adb install universal-patched.apk
    ```

!!! bug "Native pinning"
    Pinning implemented in a `.so` will not be touched by Java-level scripts.
    Hook the native side instead — `SSL_CTX_set_custom_verify` in BoringSSL is
    the usual target for Flutter and other bundled stacks.

## :material-shield-off: Root detection

Non-universal scripts target the specific check the app uses, which is why
reading the decompiled source first pays off:

```bash
frida -Uf com.target.app -l nonUniversalRootDetectionBypass.js
```

Most apps use **RootBeer**. Find the class in jadx, then force its result:

```javascript
Java.perform(function () {
  let RootBeer = Java.use("com.scottyab.rootbeer.RootBeer");
  RootBeer["isRooted"].implementation = function () {
    console.log("RootBeer.isRooted called");
    return false;
  };
});
```

!!! tip "Obfuscated method names"
    In a release build `isRooted` is often renamed to something like `n`. Hook
    whatever the decompiler shows you — the class and method names in your script
    must match the **shipped** bytecode, not the library's source.

## :material-shield-check: Device integrity — SafetyNet & Play Integrity

Before trying to beat attestation, check whether the app even uses it. Search
the decompiled classes in **jadx**:

| API | Class to search for |
| --- | --- |
| SafetyNet Attestation (legacy) | `com.google.android.gms.safetynet.SafetyNet` |
| Play Integrity (current) | `com.google.android.play.core.integrity.IntegrityManagerFactory` |

**How the check flows:** the app asks Google Play services for an attestation →
Play services calls Google's Attestation API backend → the signed verdict comes
back to the app → the app forwards it to its own backend, which is where the
accept/reject decision should be made. If the app decides *locally*, the whole
control is hookable.

SafetyNet returns two booleans:

| Device status | `ctsProfileMatch` | `basicIntegrity` |
| --- | --- | --- |
| Certified, genuine device that passes CTS | `true` | `true` |
| Certified device with unlocked bootloader | `false` | `true` |
| Genuine but uncertified (no manufacturer certification) | `false` | `true` |
| Custom ROM, not rooted | `false` | `true` |
| **Emulator** | `false` | `false` |
| No device (a protocol-emulating script) | `false` | `false` |
| Signs of system integrity compromise, e.g. rooting | `false` | `false` |
| Signs of active attack, e.g. API hooking | `false` | `false` |

Play Integrity replaced those with labelled verdicts:

| Verdict | Meaning |
| --- | --- |
| `MEETS_BASIC_INTEGRITY` | Passes basic checks, but may be an unrecognised Android version, unlocked bootloader, or uncertified device |
| `MEETS_DEVICE_INTEGRITY` | A device powered by Google Play services that passes system integrity checks |
| `MEETS_STRONG_INTEGRITY` | The above **plus** a hardware-backed proof of boot integrity |

!!! tip "Check the device's own certification status"
    Play Store → profile icon → **Settings** → **About** → *Play Protect
    certification*. "Device is not certified" tells you `ctsProfileMatch` will be
    `false` before you write a single hook.

!!! note "Why teams skip attestation"
    It has real costs: **no iOS equivalent**, it **requires Google Play services**
    (so it fails on Huawei and de-Googled devices), and the **app must be online**
    to get a verdict. Plenty of apps therefore fall back to a local root check —
    which is the one you can hook.

## :material-eye-off: Screenshot blocking — `FLAG_SECURE`

Apps set `FLAG_SECURE` on sensitive screens to block screenshots and screen
recording — including yours, when you are trying to evidence a finding. Objection
toggles it live:

```bash
android ui FLAG_SECURE false     # allow screenshots again
android ui FLAG_SECURE true      # put it back
```

## :material-toolbox: Objection quick reference

```bash
objection -g com.target.app explore                     # attach by name
objection -psn com.target.app start                     # spawn by name
objection -psn com.target.app start -S fingerprintBypass.js   # spawn with a script
```

Inside the console:

```text
android sslpinning disable
android root disable
android hooking list activities
android hooking watch class_method com.target.app.Login.check --dump-args --dump-return
android keystore list
```

!!! bug "Fingerprint bypass IS a finding"
    Bypassing root detection or pinning is scaffolding. Bypassing the
    **biometric/fingerprint** gate is a real vulnerability — if hooking the
    success callback logs you in, the authentication decision was made
    client-side.

## :material-link-variant: Related

- Getting `frida-server` running → [Emulator & Setup](emulator.md).
- Patching instead of hooking → [APKs, AABs & Signing](apks.md).
- Reference: [Frida CodeShare](https://codeshare.frida.re/), [Objection](https://github.com/sensepost/objection).
