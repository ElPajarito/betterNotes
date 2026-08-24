---
tags:
  - Reference
icon: material/flask-outline
---

# :material-flask-outline: Labbing

> Build the bug yourself. A technique you've only read about is a guess; a
> technique you've watched fire in your own lab is a finding you can report.

Each page here is a self-contained vulnerable setup: what to install, how to wire
it up, and how to confirm the bug fires. Every lab links out to the technique
page that explains *why* it works.

<div class="grid cards" markdown>

-   :material-file-pdf-box:{ .lg .middle } __wkhtmltopdf — SSRF → LFI__ <span class="pill pill-hard">→ file read</span>

    ---
    HTML injection into a PDF renderer, escalated to arbitrary file read through a
    cross-scheme redirect.

    [:octicons-arrow-right-24: Build it](wkhtmltopdf.md)

</div>

!!! warning "Run vulnerable software like it's radioactive"
    These builds are deliberately exploitable and usually pinned to an old
    version. Keep them on an isolated VM or a throwaway container, never on a
    host you care about, and never on a network segment that can reach anything
    that matters. Bind services to `127.0.0.1` unless the lab specifically needs
    otherwise.

## :material-lightbulb-on: What makes a lab worth keeping

- **Pin the vulnerable version.** "Latest" gets patched and the lab silently stops
  reproducing. Record the exact version the bug needs.
- **Keep the trigger URL** in the notes — the fastest way back in after a rebuild.
- **Vary one thing at a time.** Once it fires, change a single variable — a filter,
  a flag, a version — and see which payload variants survive. That is how you learn
  to read what a real target's setup is telling you.
