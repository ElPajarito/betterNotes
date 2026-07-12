---
tags:
  - Mobile
---

# :material-apple-ios: iOS App Pentesting

<span class="pill pill-medium">client-side</span> <span class="pill pill-info">mobile</span>

iOS is more locked down than Android — App Store binaries are encrypted and you
usually need a jailbroken device — but once you're on the device the same
methodology applies: read the binary, break pinning, hook the runtime, and
attack the API and the Keychain.

!!! abstract "TL;DR"
    Decrypt the IPA (`frida-ios-dump`) → `class-dump`/Hopper for the interface →
    grep the bundle for secrets → bypass jailbreak/pinning with Objection/Frida →
    inspect the Keychain, plists, and API traffic.

## :material-cellphone-cog: Setup

- **Jailbroken device** (checkra1n/palera1n for A-series, or a rootless JB) with
  **Frida**, **Objection**, OpenSSH, and Filza installed via Sileo/Cydia.
- **No jailbreak?** You're limited to: static analysis of a decrypted IPA someone
  else dumped, MITM without pinning bypass, and re-signing with a tool like
  **objection patchipa** / Frida gadget injection for on-device instrumentation.

## :material-download: Get a decrypted binary

App Store apps are FairPlay-encrypted on disk — you need the *decrypted* image
from memory:

```bash
frida-ios-dump.py -u root -P alpine com.target.app     # dumps a decrypted .ipa
# or, on-device:
objection --gadget com.target.app explore
```

An `.ipa` is a zip: `unzip target.ipa` → `Payload/Target.app/` holds the Mach-O
binary, `Info.plist`, resources, and frameworks.

## :material-file-search: Static analysis

```bash
# Confirm it's actually decrypted (cryptid should be 0)
otool -l Target.app/Target | grep -A4 LC_ENCRYPTION_INFO
# Objective-C class/method names
class-dump -H Target.app/Target -o headers/
# Strings + secret hunting
strings -a Target.app/Target | grep -Ei 'http|key|secret|token|password'
```

!!! loot "Where iOS apps leak secrets"
    ```bash
    #   Info.plist            -> URL schemes, ATS exceptions, config
    #   *.plist / *.strings   -> hardcoded endpoints, flags
    #   embedded.mobileprovision, frameworks/, assets
    #   the Mach-O __cstring / __objc_methname sections
    ```
    ATS exceptions (`NSAllowsArbitraryLoads`) in `Info.plist` reveal endpoints
    that fall back to cleartext.

!!! tip "Swift vs Objective-C"
    `class-dump` only sees Objective-C metadata. Swift binaries need
    **Hopper**/**Ghidra** (or `frida-trace -m '*[* *]'` at runtime) — demangle with
    `swift-demangle`.

## :material-swap-horizontal: Pinning & jailbreak-detection bypass

```bash
objection -g com.target.app explore
ios sslpinning disable
ios jailbreak disable
```

- Frida alternatives: **SSL Kill Switch 2** (tweak), or a Codeshare pinning
  bypass script.
- Add Burp's CA as a **trusted profile** (Settings → General → About → Certificate
  Trust) so system-level TLS validates before you even touch pinning.

!!! bug "Common iOS gotchas"
    - **App won't launch after re-sign** — entitlements/provisioning mismatch. Use
      the app's original entitlements when re-signing (`codesign -d --entitlements`).
    - **Frida can't attach** — version skew between the `frida-server` on-device and
      your host client; match versions exactly.
    - **NSURLSession pinning** lives in `URLSession:didReceiveChallenge:` — hook
      that delegate if the generic bypass misses.
    - **Jailbreak detection** often checks for `/Applications/Cydia.app`, `fork()`
      success, or suspicious dylibs — `ios jailbreak disable` hooks the common ones;
      stubborn apps need targeted Frida hooks on the specific check.

## :material-database-eye: Local storage & the Keychain

!!! loot "Data at rest on iOS"
    ```bash
    # Over SSH / Filza, in the app's sandbox:
    #   Library/Preferences/*.plist   -> NSUserDefaults (tokens, flags, PII)
    #   Documents/  Library/Caches/   -> downloaded data, cached responses
    #   *.sqlite / *.realm            -> local DBs
    # The Keychain (credentials, keys):
    objection -g com.target.app explore
    ios keychain dump
    ios nsurlcredentialstorage dump
    ```
    Check the Keychain **accessibility class** — items marked
    `kSecAttrAccessibleAlways` persist without a passcode and survive backup.

- **Pasteboard / screenshots** — sensitive data copied to the general pasteboard
  (readable by any app) or snapshotted on backgrounding.
- **Runtime tampering** — `objection` to bypass biometric prompts, flip feature
  flags, and read decrypted values live.

## :material-shield-check: Remediation (for the report)

- Store credentials in the Keychain with `...ThisDeviceOnly` accessibility; never
  in `NSUserDefaults`/plists.
- Enforce controls server-side; treat jailbreak/pinning as defense-in-depth only.
- Keep ATS strict (no arbitrary-loads exceptions); pin certificates.
- Clear the pasteboard and blur the app snapshot on background.

## :material-link-variant: Related

- Intercepted traffic → [API / web attacks](../web/index.md):
  [Auth Bypass](../web/auth-bypass.md), [JWT](../web/jwt.md), IDOR.
- Android counterpart: [Android App Pentesting](android.md).
- Reference: [OWASP MASTG — iOS](https://mas.owasp.org/MASTG/), [Frida](https://frida.re/), [Objection](https://github.com/sensepost/objection).
