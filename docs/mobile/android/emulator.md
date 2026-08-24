---
tags:
  - Mobile
---

# :material-cellphone-cog: Emulator & Setup

<span class="pill pill-easy">start here</span> <span class="pill pill-info">mobile</span>

A rooted emulator with a matching `frida-server` and a trusted CA is the whole
lab. Get this right once and every other Android page just works.

!!! abstract "TL;DR"
    Root a stock AVD with rootAVD → push a `frida-server` whose version matches
    your host `frida` **exactly** → point the AVD's Wi-Fi proxy at `10.0.2.2` →
    install Burp's CA from `http://burp`.

## :material-cellphone-link: Pick an image

Prefer a **Google APIs** image over a **Google Play** image. Play images ship a
locked `/system` and refuse to run as root; Google APIs images root cleanly and
let you drop a CA into the system store.

```bash
avdmanager list device
avdmanager create avd -n pentest -k "system-images;android-31;google_apis;x86_64"
emulator -avd pentest -writable-system
```

`adb shell getprop ro.product.cpu.abilist` tells you the architecture — output
like `x86_64,arm64-v8a` is ideal, since it runs x86_64 natively *and* can run
arm binaries for apps that ship arm-only native libs.

## :material-shield-crown: Root it with rootAVD

```bash
./rootAVD.sh ListAllAVDs
./rootAVD.sh system-images/android-31/google_apis/x86_64/ramdisk.img
# -> device shuts down; cold-boot it, open Magisk, reboot, install.
#    Magisk > Superuser > enable "Shared UID shell" so `su` works from adb.
adb shell
su          # you are root
```

## :material-needle: frida-server

The server on the device and the `frida` on your host **must be the same
version**. A mismatch fails with confusing errors that look like device
problems.

```bash
adb shell getprop ro.product.cpu.abilist   # e.g. x86_64,arm64-v8a -> grab the x86_64 build
frida --version                            # e.g. 17.2.5
```

Download `frida-server-<version>-android-<arch>.xz` from the
[releases page](https://github.com/frida/frida/releases), extract it, and rename
the binary to `frida-server`:

```bash
adb push frida-server /data/local/tmp/                      # push to a temp dir
adb shell "chmod 755 /data/local/tmp/frida-server"          # make it executable
adb shell "su -c '/data/local/tmp/frida-server &'"          # run in background as root
frida-ps -U                                                 # confirm it's alive
```

## :material-swap-horizontal: Proxy the traffic

**Burp:** set the proxy listener to **All Interfaces**, not just localhost —
the emulator is a separate host as far as the network stack is concerned.

**Emulator:** Wi-Fi settings → Edit (pencil) → Advanced options → **Proxy:
Manual**, Hostname `10.0.2.2`, Port `8080`.

!!! tip "`10.0.2.2` is the magic IP"
    From inside an AVD, `10.0.2.2` is your host machine's localhost. `127.0.0.1`
    inside the emulator is the emulator itself.

**CA certificate:** browse to `http://burp` in the emulator's browser, download
the certificate (`cacert.der`), **rename it to `.cer`** — the installer will not
offer a `.der` file — then Settings → Security → Encryption & Credentials →
Install a certificate → **CA certificate**.

### Proxy over iptables instead

When the app ignores the system proxy (or you want everything, not just HTTP),
drop the device proxy setting, turn on Burp's **invisible proxying**, and
redirect at the packet level:

```bash
./proxy.sh 8080
```

## :material-bug: Troubleshooting

```bash
netstat -an | grep 8080        # is Burp actually listening, and on what interface?
tcpdump -i any port 8080       # is the device even reaching you?
```

!!! bug "Traffic still won't decrypt?"
    - **Android 7+ ignores user CAs** for app traffic — you need a Frida bypass
      or a repackaged app that trusts user certs. See [Frida & Objection](frida.md)
      and [APKs & Signing](apks.md).
    - **Pinning ≠ user-CA distrust.** They are two separate controls and you may
      have to beat both.
    - **Flutter / React Native / Xamarin** route through their own HTTP stack and
      ignore the system proxy entirely — use `reFlutter`, or hook BoringSSL.
    - **App won't install** because your image is too old → lower `minSdkVersion`,
      see [APKs & Signing](apks.md).

## :material-link-variant: Related

- Now get the app onto it → [APKs, AABs & Signing](apks.md).
- Now hook it → [Frida & Objection](frida.md).
- Overview and platform model → [Android](index.md).
