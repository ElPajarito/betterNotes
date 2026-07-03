---
hide:
  - navigation
  - toc
---

<div class="pwn-hero" markdown>

# pwn.notes <span class="pwn-blink">▮</span>

**A lively, searchable field manual for offensive security.**
Web · Cloud · Network/AD · Privesc & Post-Exploitation — hit the **Search** button (bottom-right) or press <kbd>Ctrl</kbd>+<kbd>K</kbd>.

</div>

!!! warning "Authorized testing only"
    Everything here is written for **CTFs, labs, and engagements you have written permission to test**. Running these techniques against systems you don't own or aren't scoped to test is illegal. Be a professional. :material-shield-check:

## :material-map-marker-path: Pick a level

<div class="grid cards" markdown>

-   :material-spider-web:{ .lg .middle } __Web Apps__

    ---

    Injection, XSS, SSRF, broken auth, unsafe uploads, and deserialization. The bread and butter of app testing.

    [:octicons-arrow-right-24: Enter world 1](web/index.md)

-   :material-cloud:{ .lg .middle } __Cloud__

    ---

    AWS, Azure, and GCP — enumeration, IAM privilege escalation, metadata SSRF, and storage misconfigurations.

    [:octicons-arrow-right-24: Enter world 2](cloud/index.md)

-   :material-lan:{ .lg .middle } __Network / AD__

    ---

    Recon, SMB, Kerberos, and full Active Directory attack paths from foothold to Domain Admin.

    [:octicons-arrow-right-24: Enter world 3](network/index.md)

-   :material-key-chain:{ .lg .middle } __Privesc & Post-Ex__

    ---

    Linux & Windows local privilege escalation, persistence, pivoting, and exfiltration.

    [:octicons-arrow-right-24: Enter world 4](privesc/index.md)

</div>

## :material-lightbulb-on: How to use these notes

<div class="grid cards" markdown>

-   :material-magnify:{ .lg .middle } __Search everything__

    ---

    Full-text search is built in. It also indexes headings and code, so searching `xp_cmdshell` or `IMDSv2` jumps you straight to the relevant note.

-   :material-tag-multiple:{ .lg .middle } __Browse by tag__

    ---

    Every note is tagged (`web`, `cloud`, `privesc`, `windows`, …). The [Tags index](tags.md) is your cross-cutting map of related topics.

-   :material-link-variant:{ .lg .middle } __Follow the kill chain__

    ---

    Each note ends with **Related** links so you can move naturally from *recon → exploit → privesc → post-ex* the way a real engagement flows.

</div>

## :material-format-list-checks: Legend

Notes use a consistent vocabulary so you can skim fast:

| Marker | Meaning |
| --- | --- |
| <span class="pill pill-easy">easy</span> <span class="pill pill-medium">medium</span> <span class="pill pill-hard">hard</span> | Rough difficulty / reliability of a technique |
| !!! loot | High-value loot — credentials, tokens, keys to grab |
| !!! opsec | Detection & noise warning — this is loud |
| ==highlight== | Something important to notice in output |
| ++key++ combos | Keyboard shortcuts |

!!! loot "Example: what a loot box looks like"
    When you see one of these, it's flagging **something worth exfiltrating or pivoting on** — an access key, a hash, a session token.

!!! opsec "Example: what an opsec box looks like"
    These flag **loud, detectable actions**. On a real engagement, weigh them against your rules of engagement.

---

<p style="text-align:center; opacity:0.6;">
Made with :material-heart:{ .pwn-blink } and too much coffee. Try the <kbd>↑ ↑ ↓ ↓ ← → ← → B A</kbd> code. 🍄
</p>
