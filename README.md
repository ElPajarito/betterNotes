# pwn.notes 🍄

A lively, searchable **pentester field manual** built with [Material for MkDocs](https://squidfunk.github.io/mkdocs-material/). Playful dark-hacker theme, full-text + tag search, and extensive sample notes across **Web · Cloud · Network/AD · Privesc & Post-Exploitation**.

> ⚠️ For authorized testing only — CTFs, labs, and engagements you have written permission to test.

## Features

- 🔎 **Full-text search** (indexes headings *and* code — search `xp_cmdshell`, `169.254.169.254`, `ligolo`).
- 🏷️ **Tag-based browsing** for cross-cutting topics (`web`, `cloud`, `windows`, `privesc`, …) — see [Tags](docs/tags.md).
- 🔗 **Related links** on every page so you can follow the kill chain: *recon → exploit → privesc → post-ex*.
- 🎨 Rich text: syntax highlighting, tabbed code, admonitions (incl. custom **loot** & **opsec** callouts), difficulty pills, Mermaid diagrams, keyboard keys, `==highlight==`, and more.
- 📱 Responsive, dark/light toggle, instant navigation.

## Quick start

```bash
# 1. Install dependencies (a virtualenv is recommended)
python3 -m pip install -r requirements.txt

# 2. Live-preview at http://127.0.0.1:8000 (auto-reloads on save)
mkdocs serve

# 3. Build the static site into ./site
mkdocs build
```

## Content layout

```
docs/
├── index.md              # Home / hero / "level select"
├── web/                  # SQLi, XSS, SSRF, Auth bypass, File upload, Deserialization
├── cloud/                # AWS, Azure, GCP
├── network/              # Recon, SMB, Kerberos, Active Directory
├── privesc/              # Linux, Windows, Persistence, Pivoting & Exfil
├── tags.md               # Auto-generated tag index
├── stylesheets/extra.css # The theme personality
└── javascripts/extra.js  # Small enhancements (try the Konami code 😉)
```

## Adding a note

1. Create `docs/<section>/<topic>.md`.
2. Add front-matter tags:
   ```yaml
   ---
   tags:
     - Web
   ---
   ```
3. Add it to the `nav:` block in `mkdocs.yml`.
4. End with a **Related** section linking neighboring notes.

Rich-text building blocks you can use out of the box:

| Feature | Syntax |
| --- | --- |
| Loot callout | `!!! loot "title"` |
| Opsec warning | `!!! opsec "title"` |
| Difficulty pill | `<span class="pill pill-hard">hard</span>` |
| Tabbed code | `=== "Tab name"` |
| Highlight | `==text==` |
| Keyboard key | `++ctrl+c++` |
| Diagram | ` ```mermaid ` |

## Deploying to GitHub Pages

A workflow at `.github/workflows/ci.yml` builds and deploys on every push to `main`.

1. Update `site_url`, `repo_url`, and `repo_name` in `mkdocs.yml` to your fork.
2. In your repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Push to `main`. The site publishes to `https://<user>.github.io/<repo>/`.

You can also deploy manually with `mkdocs gh-deploy --force`.

---

Made with ❤️ and too much coffee. Contributions welcome — keep it accurate, keep it lively.
