---
tags:
  - Mobile
---

# :material-shape-outline: Components & Intents

<span class="pill pill-hard">attack surface</span> <span class="pill pill-info">mobile</span>

The sandbox stops apps talking to each other — **except** through components the
developer marked as exported. Those, and the intents that reach them, are the
external attack surface of an Android app.

!!! abstract "TL;DR"
    Four component types, reachable by intent. Anything `exported="true"` (or
    exported by default) can be driven by any app on the device, including a
    one-line `adb shell am` command.

## :material-view-grid: The four component types

| Component | What it is | Why you care |
| --- | --- | --- |
| **Activity** | A single screen. Each activity is independent of the others; lifecycle managed by callbacks like `onCreate()`. | An exported activity that accepts a user-supplied intent can expose *protected* intents, or be entered without going through login. |
| **Service** | Background functionality, no UI. | If exported and it trusts intent data, any app can drive it — command execution, data theft, forced uploads. |
| **Broadcast Receiver** | Receives broadcast events of interest. | If exported and it accepts user-supplied broadcasts, **any** app can trigger it with no restriction. |
| **Content Provider** | Manages access to stored data and shares it with other apps via `content://`. | Providers backed by SQLite are the classic **SQL injection** target from a third-party app. |

!!! bug "What to actually look for"
    - **Access to protected intents** — one exported activity that forwards a
      user-provided intent can reach the app's internal, non-exported screens.
    - **Sensitive data via exported Activity** — usually combined with deep links,
      stealing data through unvalidated parameters or writing session tokens to an
      external file.
    - **File theft / overwrite** — `external-files-path`, `external-path` and
      public app directories. Grep the source for `content://`.

## :material-arrow-decision: Explicit vs implicit intents

An **explicit** intent names its target component: this app, this class. Tap
Send, and a specific activity opens. Deterministic, and only reachable by
whoever knows the name.

An **implicit** intent describes an *action* and lets Android decide who handles
it — which is why you get the "Send this text via…" chooser with Bluetooth,
Gmail, Drive, WhatsApp. **Any app that registers a matching intent filter can
volunteer to handle it**, which is what makes implicit intents interesting: data
you send implicitly can land somewhere you did not intend, and data the target
receives implicitly may come from anyone.

## :material-console: Driving components from adb

The anatomy of an `am start`, piece by piece:

```bash
adb shell am start -n com.android.insecurebankv2/com.android.insecurebankv2.DoLogin \
  -a "com.android.insecurebankv2.DoLogin" \
  --es "passed_username" "devadmin" \
  --es "passed_password" "asda"
```

| Fragment | Part |
| --- | --- |
| `com.android.insecurebankv2` | App (package) name |
| `com.android.insecurebankv2.DoLogin` (after `/`) | Activity name |
| `-a "…"` | Action name |
| `--es` | Extra, of type **s**tring |
| `"passed_username"` | Parameter name |
| `"devadmin"` | Parameter data |

Services and broadcasts take the same shape:

```bash
adb shell am startservice -n com.target.app/.CommandService
adb shell am stopservice  -n com.target.app/.CommandService
adb shell am broadcast -n com.target.app/.IntentReceiver \
  -a com.target.app.intent.TEST --es "sms_body" "test from adb"
```

!!! tip "Activity naming rules"
    If the activity **has intent filters**, give the full path:

    ```bash
    am start -n com.target.app/com.target.app.ui.activities.SplashScreenActivity \
      -a "com.target.app.ui.activities.SplashScreenActivity"
    ```

    Otherwise either short or long form works:

    ```bash
    am start -n com.target.app/.PostLogin
    am start -n com.target.app/com.target.app.PostLogin
    ```

Query an exported provider directly:

```bash
adb shell content query --uri content://com.target.app.provider/users
```

## :material-radar: Drozer — component recon

```bash
adb forward tcp:31415 tcp:31415
drozer console connect --server 127.0.0.1

run app.package.attacksurface com.target.app      # what's exported, in one line
run app.activity.info -a com.target.app           # enumerate activities
run app.activity.start --component com.target.app com.target.app.PostLogin
run scanner.provider.finduris -a com.target.app   # then SQLi the content providers
```

## :material-link-variant-plus: Deep links

A deep link takes you straight to a destination inside an app — an Android URL
for a specific activity. They usually mirror the web app's routes with a
different scheme, and developers often keep **custom schemes** around for testing
new features long after they should have removed them.

Verified deep links can only use `http` and `https`. Everything else is
unverified, and the vulnerability class depends on how `scheme://`, the host and
the parameters are validated:

- **CSRF** — easiest when `autoVerify="true"` is absent from the manifest.
- **Open redirect** — custom schemes that don't verify endpoint parameters or hosts.
- **XSS** — unvalidated parameters/host in a WebView that uses
  `setJavaScriptEnabled(true)` and `addJavascriptInterface`.
- **LFI** — unvalidated path parameters: `appschema://app/goto?file=`.

Test a built-in WebView with:

```text
appscheme://webview?url=https://google.com
appscheme://webview?url=javascript:document.write(document.domain)
```

## :material-link-variant: Related

- Reading the manifest to find what's exported → [Android](index.md).
- Hooking the handlers you reach → [Frida & Objection](frida.md).
- Once you're inside the API: [Auth Bypass](../../web/auth-bypass.md) · [IDOR](../../web/idor.md) · [SQLi](../../web/sqli.md).
- Reference: [OWASP MASTG — Android platform APIs](https://mas.owasp.org/MASTG/).
