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

## :material-map-marker-path: Follow the kill chain

The notes are ordered the way an engagement actually runs — **Recon → Enumeration → Exploitation → Post-Ex** — with **Mobile** and a general **Toolbox** off to the side.

<div class="grid cards" markdown>

-   :material-radar:{ .lg .middle } __1 · Recon__

    ---

    Map the ground before you touch it: host discovery, port scanning, DNS, and the internal/AD overview.

    [:octicons-arrow-right-24: Start scanning](network/recon.md)

-   :material-magnify-scan:{ .lg .middle } __2 · Enumeration__

    ---

    Go deep on what you found — SMB, MSSQL, and cloud tenants (AWS/Azure/GCP) — to surface the soft targets.

    [:octicons-arrow-right-24: Enumerate services](network/smb.md)

-   :material-sword-cross:{ .lg .middle } __3 · Exploitation__

    ---

    The attacks: web (injection, XSS, SSRF…), Active Directory attack paths, and container/CI-CD escapes.

    [:octicons-arrow-right-24: Break in](web/index.md)

-   :material-key-chain:{ .lg .middle } __4 · Post-Exploitation__

    ---

    Turn a foothold into full control: Linux & Windows privesc, credential hunting, persistence, and pivoting.

    [:octicons-arrow-right-24: Escalate & pivot](privesc/index.md)

-   :material-cellphone-lock:{ .lg .middle } __5 · Mobile__

    ---

    Android & iOS: decompile the app, beat SSL pinning, hook the runtime, and attack the API behind it.

    [:octicons-arrow-right-24: Go mobile](mobile/index.md)

-   :material-toolbox:{ .lg .middle } __Toolbox__

    ---

    The baseline kit every phase assumes: Linux commands, text-fu, networking, transfer, and troubleshooting.

    [:octicons-arrow-right-24: Grab your kit](toolbox/index.md)

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
Made with :material-heart:{ .pwn-blink } and too much coffee. Try the <kbd>↑ ↑ ↓ ↓ ← → ← → B A</kbd> code. <span title="?" style="cursor:pointer" onclick="window.pwnWarp&&window.pwnWarp()">🍄</span>
</p>
