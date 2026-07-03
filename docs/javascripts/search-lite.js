/* pwn.notes — self-contained "lite" search.
   Works everywhere (http, https, and file://) because it reads window.PWN_INDEX
   from a plain <script> instead of fetching an index through a web worker.
   Renders a visible floating Search button + an overlay with live results. */

(function () {
  "use strict";

  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  // Relative path to the site root, taken from Material's depth-aware logo link
  // (correct on file://, localhost, and project subpaths alike).
  function baseHref() {
    var logo = document.querySelector(".md-header__button.md-logo");
    var h = logo && logo.getAttribute("href");
    if (!h) return ".";
    return h.replace(/\/?$/, ""); // strip trailing slash
  }

  function hrefFor(u) {
    var b = baseHref();
    return u ? b + "/" + u : b + "/";
  }

  // Score an entry against the (lowercased) query terms. Requires every term to
  // appear somewhere (title or body). Title hits are weighted heavily.
  function score(entry, terms) {
    var t = entry.t.toLowerCase();
    var x = entry.x.toLowerCase();
    var total = 0;
    for (var i = 0; i < terms.length; i++) {
      var term = terms[i];
      var inTitle = t.indexOf(term) !== -1;
      var bodyHits = 0;
      var from = 0, idx;
      while ((idx = x.indexOf(term, from)) !== -1 && bodyHits < 8) {
        bodyHits++;
        from = idx + term.length;
      }
      if (!inTitle && bodyHits === 0) return 0; // AND semantics
      total += (inTitle ? 12 : 0) + bodyHits;
      if (t.indexOf(term) === 0) total += 6; // title prefix bonus
    }
    return total;
  }

  function snippet(text, terms) {
    var low = text.toLowerCase();
    var at = -1;
    for (var i = 0; i < terms.length; i++) {
      var p = low.indexOf(terms[i]);
      if (p !== -1 && (at === -1 || p < at)) at = p;
    }
    if (at === -1) at = 0;
    var start = Math.max(0, at - 40);
    var frag = text.slice(start, start + 180);
    var out = esc((start > 0 ? "… " : "") + frag + " …");
    terms.forEach(function (term) {
      var re = new RegExp("(" + term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig");
      out = out.replace(re, "<mark>$1</mark>");
    });
    return out;
  }

  ready(function () {
    var index = window.PWN_INDEX || [];

    // ---- Build the UI --------------------------------------------------
    var btn = document.createElement("button");
    btn.className = "pwn-search-fab";
    btn.type = "button";
    btn.setAttribute("aria-label", "Search the notes");
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">' +
      '<path fill="currentColor" d="M9.5 3a6.5 6.5 0 0 1 5.25 10.34l5.2 5.2-1.41 1.41-5.2-5.2A6.5 6.5 0 1 1 9.5 3m0 2a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9"/></svg>' +
      "<span>Search</span>";

    var overlay = document.createElement("div");
    overlay.className = "pwn-search-overlay";
    overlay.setAttribute("hidden", "");
    overlay.innerHTML =
      '<div class="pwn-search-modal" role="dialog" aria-label="Search" aria-modal="true">' +
      '<div class="pwn-search-bar">' +
      '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M9.5 3a6.5 6.5 0 0 1 5.25 10.34l5.2 5.2-1.41 1.41-5.2-5.2A6.5 6.5 0 1 1 9.5 3m0 2a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9"/></svg>' +
      '<input type="search" class="pwn-search-input" placeholder="Search notes by name or content…" autocomplete="off" spellcheck="false" aria-label="Search query">' +
      '<kbd class="pwn-search-esc">Esc</kbd>' +
      "</div>" +
      '<div class="pwn-search-meta" aria-live="polite"></div>' +
      '<ul class="pwn-search-results"></ul>' +
      "</div>";

    document.body.appendChild(btn);
    document.body.appendChild(overlay);

    var input = overlay.querySelector(".pwn-search-input");
    var meta = overlay.querySelector(".pwn-search-meta");
    var list = overlay.querySelector(".pwn-search-results");

    function open() {
      overlay.removeAttribute("hidden");
      document.body.classList.add("pwn-search-open");
      input.value = "";
      render("");
      setTimeout(function () { input.focus(); }, 0);
    }
    function close() {
      overlay.setAttribute("hidden", "");
      document.body.classList.remove("pwn-search-open");
    }

    function render(q) {
      list.innerHTML = "";
      var query = q.trim().toLowerCase();
      if (!query) {
        meta.textContent = index.length
          ? index.length + " pages indexed — start typing"
          : "Search index not loaded";
        return;
      }
      var terms = query.split(/\s+/).filter(Boolean);
      var hits = [];
      for (var i = 0; i < index.length; i++) {
        var s = score(index[i], terms);
        if (s > 0) hits.push([s, index[i]]);
      }
      hits.sort(function (a, b) { return b[0] - a[0]; });
      hits = hits.slice(0, 25);

      meta.textContent =
        hits.length + (hits.length === 1 ? " result" : " results") +
        ' for "' + q.trim() + '"';

      hits.forEach(function (h, i) {
        var e = h[1];
        var li = document.createElement("li");
        var a = document.createElement("a");
        a.className = "pwn-search-result" + (i === 0 ? " is-active" : "");
        a.href = hrefFor(e.u);
        a.innerHTML =
          '<span class="pwn-search-title">' + esc(e.t) + "</span>" +
          '<span class="pwn-search-snip">' + snippet(e.x, terms) + "</span>";
        li.appendChild(a);
        list.appendChild(li);
      });
    }

    // ---- Wire events ---------------------------------------------------
    btn.addEventListener("click", open);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) close();
    });
    input.addEventListener("input", function () { render(input.value); });

    input.addEventListener("keydown", function (e) {
      var active = list.querySelector(".pwn-search-result.is-active");
      var items = Array.prototype.slice.call(
        list.querySelectorAll(".pwn-search-result")
      );
      var i = items.indexOf(active);
      if (e.key === "ArrowDown" && items.length) {
        e.preventDefault();
        if (active) active.classList.remove("is-active");
        items[Math.min(i + 1, items.length - 1)].classList.add("is-active");
      } else if (e.key === "ArrowUp" && items.length) {
        e.preventDefault();
        if (active) active.classList.remove("is-active");
        items[Math.max(i - 1, 0)].classList.add("is-active");
      } else if (e.key === "Enter") {
        var target = active || items[0];
        if (target) { e.preventDefault(); window.location.href = target.href; }
      }
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !overlay.hasAttribute("hidden")) close();
      // Ctrl/Cmd+K opens it, without clashing with Material's own bindings.
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        overlay.hasAttribute("hidden") ? open() : close();
      }
    });
  });
})();
