---
tags:
  - Web
---

# :material-speedometer: Rate Limit Bypass

<span class="pill pill-medium">logic flaw</span> <span class="pill pill-info">web</span>

**Rate limiting** caps how many requests a client may send in a window. It is the control standing between you and brute force, OTP guessing, credential stuffing, and enumeration — so when it is implemented on the wrong key (an IP, a header, one route, one verb), everything behind it opens back up.

*Technique set from "Mastering Rate Limit Bypass Techniques" by [coffinxp](https://medium.com/@coffinxp).*

!!! abstract "TL;DR"
    Find what the limiter counts on — IP, header, session, username, path, method — then make each request look like it came from somewhere else. Rotate IPs and spoofing headers, change the verb, hit an alternate endpoint for the same action, or vary the payload just enough that the key changes.

## :material-cog: How rate limiting is usually built

Knowing the mechanism tells you which key to attack:

- **IP-based** — a request budget per source address in a time window. Falls to IP rotation and spoofing headers.
- **Token bucket** — requests draw from a bucket that refills over time, so bursts are allowed up to the bucket size. Falls to paced requests.
- **Leaky bucket** — requests drain at a fixed rate and excess is throttled rather than rejected. Falls to timing manipulation.
- **Geographic / region-based** — limits vary by origin country. Falls to proxy/VPN egress in a permitted region.
- **User-based** — counted against a session or credential rather than an address. Falls to fresh sessions, anonymous variants of the endpoint, or parameter tricks that change the identity key.

## :material-ip-network: IP spoofing and rotation

Route each request out of a different source address so the per-IP counter never fills.

```bash
proxychains curl -X POST https://target.com/login -d "user=admin&pass=1234"
```

Burp extensions do this at scale:

- [BurpFakeIP](https://github.com/AeolusTF/BurpFakeIP) — forges client-IP headers per request for brute forcing.
- [PortSwigger/ip-rotate](https://github.com/PortSwigger/ip-rotate) — uses AWS API Gateway to give you a new source IP on *every* request. The most reliable bypass when the limiter is genuinely IP-keyed.

## :material-format-list-bulleted: Header manipulation

Most apps sit behind a proxy or CDN and read the "real" client IP out of a header. If that header is trusted without checking which hop set it, you control the rate-limit key directly. Set it to a new value each request — `127.0.0.1` just proves the header is honoured.

```http
X-Forwarded-For: 127.0.0.1
X-Real-IP: 127.0.0.1
X-Client-IP: 127.0.0.1
X-Remote-IP: 127.0.0.1
X-Remote-Addr: 127.0.0.1
True-Client-IP: 127.0.0.1
CF-Connecting-IP: 127.0.0.1
Fastly-Client-IP: 127.0.0.1
X-Cluster-Client-IP: 127.0.0.1
```

Where each one shows up:

- `X-Forwarded-For` — the standard proxy chain header, and the one most apps read blindly. Try it first, and try it with a comma-separated list too.
- `X-Real-IP` — the nginx convention.
- `X-Client-IP`, `X-Remote-IP`, `X-Remote-Addr` — application- and framework-specific variants; often logged or used by backend logic.
- `True-Client-IP` — Akamai and other CDNs.
- `CF-Connecting-IP` — Cloudflare's real-client-IP header.
- `Fastly-Client-IP` — Fastly's equivalent.
- `X-Cluster-Client-IP` — clustered load-balancer environments.

!!! tip "Fuzz the value, not just the header"
    Point Burp Intruder at the header value with a payload list of incrementing IPs. If the block threshold never trips, the header is the key and the limiter is dead.

## :material-web: User-Agent rotation

Some limiters fingerprint the client rather than the address. Randomising `User-Agent` per request makes every attempt look like a new browser. Run it as an Intruder payload position on the `User-Agent` field.

## :material-server-network: Proxy rotation

Distribute requests across a pool of proxies — public lists, VPN exits, or a paid rotating service.

```python
import requests

# List of proxies to rotate through
proxies = [
    {"http": "http://proxy1.com:8080"},
    {"http": "http://proxy2.com:8080"},
    {"http": "http://proxy3.com:8080"}
]

# Sending requests through different proxies
for proxy in proxies:
    response = requests.get("https://example.com/api", proxies=proxy)
    print(response.status_code)  # Print response status code
```

## :material-swap-horizontal: Different HTTP methods

Limiters are often wired to one verb on one route. Re-issue the same action as `GET`, `PUT`, `DELETE`, or `OPTIONS` and see whether the counter follows. Walk every method in Repeater.

```bash
curl -X POST https://target.com/login -d "user=admin&pass=1234"
curl -X GET "https://target.com/login?user=admin&pass=1234"
```

## :material-form-textbox: Parameter name variation

Backends are frequently loose about parameter naming and will accept an alias, while the WAF or limiter only recognises the canonical name.

```text
username=admin&password=1234
user=admin&pass=1234
uname=admin&pwd=1234
login=admin&passwd=1234
u=admin&p=1234
email=admin&key=1234
id=admin&token=1234
```

Useful for slipping past input filters and for evading WAF rules keyed to a specific parameter name.

## :material-content-duplicate: Parameter pollution

Send the same parameter twice. Front-end and back-end often disagree about whether the first or last occurrence wins, and the limiter may key off the one that isn't used.

```http
POST /login HTTP/1.1
Host: target.com
Content-Type: application/x-www-form-urlencoded

user=admin&user=admin2&pass=1234
```

Watch for two outcomes: the counter never increments, or duplicate handling exposes a logic flaw of its own.

## :material-sitemap: Alternate endpoints

The same action is usually reachable through several routes — legacy versions, the mobile API, an internal path — and the protections are rarely applied to all of them. Fuzz for a variant that skips the limiter, the CAPTCHA, or 2FA entirely.

```text
/login
/user/login
/account/login
/api/login
/api/v1/login
/api/v2/login
/mobile/login
/auth/login
/authenticate
/session/create
/customers/signin
/users/auth
/rest/v1/login
```

## :material-code-braces: Encoding tricks

Encode the payload so the limiter's normaliser and the application's parser disagree — the app still sees `admin`, the counter sees something new.

```text
user=admin%20        # space after admin
user=admin%00        # null byte injection
user=%61%64%6d%69%6e # 'admin' in hex
user=ad%6Din  # only 'm' is encoded
user=%2561%2564%256d%2569%256e  # double-encoded 'admin'
```

Changing the *content type* is the same idea one layer up — a limiter that parses form bodies may ignore JSON:

```text
Content-Type: application/json
{"user":"admin"}

Content-Type: application/x-www-form-urlencoded
user=admin
```

## :material-timer-outline: Timing manipulation

If the window is generous, just stay under it. Pace requests to sit fractionally below the threshold — slower, but invisible.

```python
import requests
import time

# Loop to send multiple requests
for i in range(10):
    # Sending a POST request to login endpoint
    r = requests.post("https://target.com/login", data={"user":"admin", "pass":"1234"})
    print(r.status_code)  # Print the response status code
    time.sleep(0.9)  # Adjust sleep time based on rate limit window
```

## :material-flash: Race conditions

The opposite approach: instead of spacing requests out, fire them all at once. A limiter that reads a counter, then increments it, has a window where dozens of parallel requests all pass the check. Burp Repeater's *Send group in parallel* (single-packet attack) is the tool for this — an OTP endpoint that allows five attempts may accept fifty. See [Race Conditions](race-conditions.md).

## :material-alphabetical: Special character injection

Trailing bytes that the app strips but the limiter counts as a distinct value.

```text
email=test@example.com%00  # Null byte to end string
email=test@example.com%0D%0AHeader: injected  # CRLF to inject headers
email=test@example.com%20  # Adding space at the end
email=test@example.com%0A  # Injecting a newline
```

`%00` may bypass string sanitisation outright, and `%0D%0A` crosses over into [CRLF injection](crlf.md) — header injection or response splitting, not just a bypass.

## :material-format-letter-case: Case and look-alike tricks

Identity keys are frequently case-sensitive in the limiter and case-insensitive in the application — so the same account gets a fresh budget for every casing.

```text
Email: Test@Example.com  # Mixed case
Email: test@example.com   # Lowercase
Email: TEST@example.com   # Uppercase
```

Look-alike characters push it further, and overlap with [Account Takeover](account-takeover.md) via homograph tricks:

```text
Email: t3st@3xample.com   # '3' instead of 'e'
Email: t@est@example.com   # Replacing 'l' with 'I' or vice versa
```

## :material-keyboard-space: Blank and invisible characters

Whitespace and zero-width bytes change the key without changing the value the app resolves.

```text
email=" test@example.com "  # Adding spaces at the beginning and end
email=test@example.com%20  # Adding a space encoded as %20
email=test@example.com%E2%80%8B  # Injecting a zero-width space

email=test@example.com%09  # Tab character
email=test@example.com%0A  # Newline character
```

## :material-robot-outline: CAPTCHA bypass

When a CAPTCHA sits in front of the endpoint instead of a counter, check first whether it is actually enforced server-side (replay an old token, drop the parameter entirely, submit an empty value). If it is enforced, automated solvers exist:

- [GoogleRecaptchaBypass](https://github.com/sarperavci/GoogleRecaptchaBypass) — automated reCAPTCHA solving.
- [CloudflareBypassForScraping](https://github.com/sarperavci/CloudflareBypassForScraping) — Cloudflare verification bypass for scraping.

## :material-target: Endpoints worth testing

Rate limiting is only interesting where the action behind it is. Prioritise:

- Account registration / signup
- Login and account lockout
- Forgot / reset password
- 2FA / MFA / OTP verification
- Messaging, comments, invites
- Viewing QR codes and secret keys
- Disabling 2FA, SMS, and similar security settings
- Resend / regenerate OTP code

!!! loot "What a missing limit is worth"
    On its own, "no rate limit" is often a low-severity finding. Chained, it is critical — unlimited OTP attempts is [account takeover](account-takeover.md), unlimited login attempts is credential stuffing, unlimited invite or SMS sends is billing abuse. Always demonstrate the *outcome*, not just the request count.

!!! bug "Bypass looks like it worked but didn't"
    - **Silent throttling** — you still get `200`, but responses are stale, queued, or always "invalid". Diff response times and body length, not just status codes.
    - **Shadow banning** — the counter tripped and the endpoint now lies. Verify with a known-good credential mid-run.
    - **The limit is on the account, not you** — rotating IPs won't help; rotate the target username instead (password spraying).
    - **CDN vs origin** — the CDN limit trips before the app's. A different edge POP, or a direct-to-origin request, sidesteps it.

## :material-link-variant: Related

- The point of most of this is [Auth Bypass](auth-bypass.md) and [Account Takeover](account-takeover.md).
- Parallel-request bypasses belong with [Race Conditions](race-conditions.md).
- Header spoofing overlaps with [Host Header Injection](host-header.md) and [SSRF](ssrf.md).
- Intruder, Turbo Intruder, and extension setup in [Burp](../toolbox/burp.md).
- Reference: [OWASP WSTG — Testing for Weak Lock Out Mechanism](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/04-Authentication_Testing/03-Testing_for_Weak_Lock_Out_Mechanism).
