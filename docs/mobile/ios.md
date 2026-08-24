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

## :material-cellphone-arrow-down: Sideloading & provisioning

```bash
mpt_ios -m                       # mount the device filesystem
mpt_ios -i /path/to/app.ipa      # (re)sign + install an IPA
idevice install app.ipa          # alternative installer over USB
# Read the embedded provisioning profile (entitlements, team, expiry, devices)
openssl cms -cmsout -in Payload/Target.app/embedded.mobileprovision -inform der -print
```

!!! bug "Device wedged / tooling can't see it"
    First thing to try: **unplug and replug the cable**. USB muxd sessions go stale
    constantly — a reconnect fixes most "device not found" / hung-install errors
    before you go deeper.

## :material-swap-horizontal: Full proxy setup (host ↔ VM ↔ iPhone)

When the phone can only reach your analysis VM (not the host running Burp), bridge the two so Burp still sees the traffic:

1. On the iPhone: Wi-Fi → set the **host/VM as HTTP proxy** on Burp's port (8080).
2. If the phone reaches the *host* but Burp runs in a *VM*, port-forward the host
   port into the VM (SSH tunnel `host:8080 → vm:8080`, or a Windows port-proxy —
   it'll prompt to authorise the forward the first time).
3. In Burp, bind the proxy listener to the **VM IP / all interfaces**.
4. Install Burp's CA: browse to `http://burp`, install the profile, then
   **Settings → General → About → Certificate Trust** and flip the switch to give
   it *full* trust.
5. Sanity-check with an HTTP site (`ifconfig.me`) **and** an HTTPS site
   (`google.com`) — both should load clean and appear in Burp.

!!! tip "Prove the path before blaming pinning"
    Spin up a `python3 -m http.server` on the host and `curl` it from the VM, then
    hit it from the iPhone browser. If plain HTTP/HTTPS doesn't proxy cleanly, it's
    a **routing/CA** problem, not app-level pinning — fix that first.

## :material-link-variant: Related

- Intercepted traffic → [API / web attacks](../web/index.md):
  [Auth Bypass](../web/auth-bypass.md), [JWT](../web/jwt.md), IDOR.
- Android counterpart: [Android App Pentesting](android/index.md).
- Reference: [OWASP MASTG — iOS](https://mas.owasp.org/MASTG/), [Frida](https://frida.re/), [Objection](https://github.com/sensepost/objection).
