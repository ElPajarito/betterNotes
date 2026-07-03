"""
Build hook: generate a self-contained search index for pwn.notes.

Material's built-in search is great, but it needs a web server (it fetches
search_index.json via XHR + a web worker), so it silently returns nothing when
someone opens the built HTML directly from disk (file://).

This hook writes docs/javascripts/search-data.js — a plain script that defines
`window.PWN_INDEX` — which loads fine over http(s) *and* file://. The companion
search-lite.js turns it into a visible "Search" button that works everywhere.

The file is regenerated on every build; change-detection avoids a mkdocs-serve
rebuild loop.
"""

import json
import os
import re

_FRONT_MATTER = re.compile(r"^---\s*\n.*?\n---\s*\n", re.S)
_HEADING = re.compile(r"^#\s+(.+?)\s*$", re.M)
_ICON = re.compile(r":[a-z0-9_+-]+:")
_HTML_TAG = re.compile(r"<[^>]+>")
_MD_LINK = re.compile(r"!?\[([^\]]*)\]\([^)]*\)")
_ATTR = re.compile(r"\{[^}]*\}")
_FENCE = re.compile(r"^```.*$", re.M)
_NOISE = re.compile(r"[#>*_`~=|]+")
_WS = re.compile(r"\s+")


def _clean_inline(text: str) -> str:
    text = _ICON.sub(" ", text)
    text = _HTML_TAG.sub(" ", text)
    text = _MD_LINK.sub(r"\1", text)
    text = _ATTR.sub(" ", text)
    return text.strip()


def _to_text(md: str) -> str:
    md = _FRONT_MATTER.sub("", md)
    md = _FENCE.sub(" ", md)          # drop fence markers, keep code contents
    md = _MD_LINK.sub(r"\1", md)      # keep link text, drop targets
    md = _HTML_TAG.sub(" ", md)
    md = _ATTR.sub(" ", md)           # {: .pill } style attrs
    md = _ICON.sub(" ", md)
    md = _NOISE.sub(" ", md)
    md = _WS.sub(" ", md)
    return md.strip()


def _title(md: str, fallback: str) -> str:
    m = _HEADING.search(md)
    return _clean_inline(m.group(1)) if m else fallback


def _url_for(rel_path: str) -> str:
    """docs-relative .md path -> site-root-relative URL (use_directory_urls)."""
    stem = rel_path[:-3] if rel_path.endswith(".md") else rel_path
    stem = stem.replace(os.sep, "/")
    if stem == "index":
        return ""
    if stem.endswith("/index"):
        return stem[: -len("index")]
    return stem + "/"


def on_pre_build(config, **kwargs):
    docs_dir = config["docs_dir"]
    entries = []
    for root, _dirs, files in os.walk(docs_dir):
        for name in sorted(files):
            if not name.endswith(".md"):
                continue
            path = os.path.join(root, name)
            rel = os.path.relpath(path, docs_dir)
            with open(path, encoding="utf-8") as fh:
                raw = fh.read()
            text = _to_text(raw)
            if not text:
                continue
            entries.append(
                {
                    "t": _title(raw, rel),
                    "u": _url_for(rel),
                    "x": text[:1800],
                }
            )

    entries.sort(key=lambda e: e["u"])
    payload = "window.PWN_INDEX=" + json.dumps(
        entries, ensure_ascii=False, separators=(",", ":")
    ) + ";\n"

    out_path = os.path.join(docs_dir, "javascripts", "search-data.js")
    old = None
    if os.path.exists(out_path):
        with open(out_path, encoding="utf-8") as fh:
            old = fh.read()
    if old != payload:  # only touch on change -> no serve rebuild loop
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as fh:
            fh.write(payload)
