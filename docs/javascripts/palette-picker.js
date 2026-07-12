/* ==========================================================================
   Palette picker — a floating swatch-grid theme chooser.
   Replaces Material's one-at-a-time header toggle (hidden via CSS). Each
   swatch clicks the matching hidden Material palette radio (#__palette_N),
   so Material still drives the actual switch + localStorage persistence.
   Indices below MUST match the order of palette: entries in mkdocs.yml.
   ========================================================================== */
(function () {
  "use strict";

  var PALETTES = [
    // ---- Dark ----
    { i: 0,  g: "Dark",  name: "Nocturne",           bg: "#1a1b26", d: ["#7aa2f7", "#7dcfff", "#bb9af7"] },
    { i: 1,  g: "Dark",  name: "Eclipse",            bg: "#1e1e2e", d: ["#cba6f7", "#89dceb", "#f5c2e7"] },
    { i: 2,  g: "Dark",  name: "Forest",             bg: "#2b3339", d: ["#a7c080", "#7fbbb3", "#d699b6"] },
    { i: 3,  g: "Dark",  name: "Ember",              bg: "#282828", d: ["#fe8019", "#fabd2f", "#d3869b"] },
    { i: 4,  g: "Dark",  name: "Plum",               bg: "#1e1725", d: ["#c9a0dc", "#6ec7b8", "#e89bb0"] },
    { i: 5,  g: "Dark",  name: "Academia",           bg: "#26201a", d: ["#c9a66b", "#9caa6e", "#b5745f"] },
    { i: 6,  g: "Dark",  name: "Future Dusk",        bg: "#1a1a2e", d: ["#7c6cf0", "#9d8bff", "#d17fe0"] },
    { i: 7,  g: "Dark",  name: "Transformative Teal", bg: "#0f2327", d: ["#2dd4bf", "#38bdf8", "#5eead4"] },
    { i: 8,  g: "Dark",  name: "Terminal",           bg: "#0d1117", d: ["#39ff14", "#22d3ee", "#a855f7"] },
    // ---- Light ----
    { i: 9,  g: "Light", name: "Daybreak",           bg: "#ffffff", d: ["#3b5bdb", "#0c8599", "#7048e8"] },
    { i: 10, g: "Light", name: "Rosé Dawn",          bg: "#faf4ed", d: ["#907aa9", "#286983", "#d7827e"] },
    { i: 11, g: "Light", name: "Mocha",              bg: "#f4ece3", d: ["#a47864", "#6f5a4a", "#c08b6e"] },
    { i: 12, g: "Light", name: "Lavender",           bg: "#f5f2fb", d: ["#7c6bc4", "#6a5aa8", "#c9a7e0"] },
    { i: 13, g: "Light", name: "Matcha",             bg: "#eef1e7", d: ["#6f8f5f", "#4f6f52", "#a3b18a"] },
    { i: 14, g: "Light", name: "Butter",             bg: "#fdf8e7", d: ["#c99a2e", "#8a6d1f", "#e0b85c"] },
    { i: 15, g: "Light", name: "Cloud Dancer",       bg: "#faf9f6", d: ["#55707e", "#3f5560", "#b0a08c"] },
    { i: 16, g: "Light", name: "Peach Fuzz",         bg: "#fff5ef", d: ["#ec8a6a", "#c25b3f", "#f6b99e"] },
    // ---- Dark (hacker) ----
    { i: 17, g: "Dark",  name: "Matrix",             bg: "#050805", d: ["#00ff41", "#39ff14", "#7fff00"] },
    { i: 18, g: "Dark",  name: "Redline",            bg: "#0a0507", d: ["#ff2b4e", "#ff5c7a", "#ff9f45"] },
    { i: 19, g: "Dark",  name: "Bloodmoon",          bg: "#0f0704", d: ["#ff4d2e", "#ff7849", "#ffab40"] },
    { i: 20, g: "Dark",  name: "Toxic",              bg: "#080a04", d: ["#b6ff00", "#eaff00", "#39ff14"] },
    { i: 21, g: "Dark",  name: "Cyberdeck",          bg: "#04070f", d: ["#00e5ff", "#22d3ee", "#ff2e97"] },
    { i: 22, g: "Dark",  name: "Amber",              bg: "#0d0a03", d: ["#ffb000", "#ffc94d", "#ff8c00"] },
    { i: 23, g: "Dark",  name: "Synthwave",          bg: "#0d0221", d: ["#ff2e97", "#00e5ff", "#b967ff"] },
    // ---- Dark (warm multi-hue) ----
    { i: 24, g: "Dark",  name: "Aurora",             bg: "#131a26", d: ["#64d9b0", "#7cc6ff", "#b79cff"] },
    { i: 25, g: "Dark",  name: "Nebula",             bg: "#16111f", d: ["#b98aff", "#ff8ec4", "#ffb454"] },
    { i: 26, g: "Dark",  name: "Nova",               bg: "#0c0d12", d: ["#ff5c72", "#ffb454", "#56c8d8"] },
    { i: 27, g: "Dark",  name: "Vaporwave",          bg: "#191333", d: ["#ff6ec7", "#6ce0ff", "#c9a0ff"] }
  ];

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function activeIndex() {
    var c = document.querySelector('input[name="__palette"]:checked');
    var m = c && /(\d+)$/.exec(c.id);
    return m ? parseInt(m[1], 10) : 0;
  }

  function build() {
    if (document.querySelector(".pwn-palette-fab")) return; // already mounted

    var fab = el("button", "pwn-palette-fab");
    fab.type = "button";
    fab.title = "Colour theme";
    fab.setAttribute("aria-label", "Change colour theme");
    fab.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 0 0 0 20c1.1 0 2-.9 2-2 0-.5-.2-.95-.5-1.3-.3-.35-.5-.8-.5-1.2 0-.9.7-1.5 1.5-1.5H16c3.3 0 6-2.7 6-6 0-4.42-4.48-8-10-8Zm-5.5 10a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm3-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm3.5 4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z"/></svg>';

    var panel = el("div", "pwn-palette-panel");
    panel.hidden = true;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Colour theme picker");
    panel.appendChild(el("p", "pwn-palette-head", "Colour theme"));

    ["Dark", "Light"].forEach(function (group) {
      panel.appendChild(el("div", "pwn-palette-group", group));
      var grid = el("div", "pwn-palette-grid");
      PALETTES.filter(function (p) { return p.g === group; }).forEach(function (p) {
        var b = el("button", "pwn-swatch");
        b.type = "button";
        b.dataset.i = p.i;
        b.title = p.name;
        var chip = el("span", "pwn-swatch-chip");
        chip.style.background = p.bg;
        p.d.forEach(function (c) {
          var dot = el("i");
          dot.style.background = c;
          chip.appendChild(dot);
        });
        b.appendChild(chip);
        b.appendChild(el("span", "pwn-swatch-name", p.name));
        b.addEventListener("click", function () { choose(p.i); });
        grid.appendChild(b);
      });
      panel.appendChild(grid);
    });

    document.body.appendChild(fab);
    document.body.appendChild(panel);

    function markActive() {
      var ai = activeIndex();
      var items = panel.querySelectorAll(".pwn-swatch");
      for (var k = 0; k < items.length; k++) {
        items[k].classList.toggle("is-active", parseInt(items[k].dataset.i, 10) === ai);
      }
    }
    function open() { markActive(); panel.hidden = false; }
    function close() { panel.hidden = true; }
    function choose(i) {
      var input = document.getElementById("__palette_" + i);
      if (input) input.click();
      markActive();
    }

    fab.addEventListener("click", function (e) {
      e.stopPropagation();
      panel.hidden ? open() : close();
    });
    document.addEventListener("click", function (e) {
      if (!panel.hidden && !panel.contains(e.target) && e.target !== fab) close();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !panel.hidden) close();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build);
  } else {
    build();
  }
})();
