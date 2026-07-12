/* ==========================================================================
   pwn.notes — hidden mini platformer ("warp zone").
   A tiny self-contained Mario-style side-scroller. Zero assets, zero deps.
   Trigger: type the word  m a r i o  anywhere on the site (or dispatch a
   `pwn:warp` event, e.g. from a console). Esc / the X button closes it.
   It borrows the ACTIVE palette's --pwn-* colours so it matches your theme.
   Listener is attached once to document; the canvas is (re)built on demand,
   so it survives Material's navigation.instant page swaps.
   ========================================================================== */
(function () {
  "use strict";

  var TILE = 24; // world units per tile
  var GRAV = 0.9, MOVE = 3.1, JUMP = 14.2, MAXFALL = 16;

  // Level map. Bottom row is the last string. Legend:
  //   X ground   B brick   ? coin-block   P pipe   = platform
  //   o coin      g goomba   ^ spike        F flag   (space) empty
  var MAP = [
    "                                                                                                                    ",
    "                                                                                                                    ",
    "                     o o o                                                          o o o o                         ",
    "                    B?B?B                          o o                             BBBBBB                          ",
    "                                                  BB?BB                                                    F        ",
    "         o                                                          o o o                                 =        ",
    "        o o           g            g                    g          BB?BB          g        g             ==        ",
    "   o   BB?BB     ==========    ===========   o o o                              ========                ===        ",
    "  ===                                       BBBBBBB                                                    ====        ",
    "                                                                                              g       =====        ",
    "XXXXXXXXXXXXXX   XXXXXXXXXXXXXXXXX      XXXXXXXXXXXXXXXXXXXXXX   XXXXXXXXX   XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX      ",
    "XXXXXXXXXXXXXX   XXXXXXXXXXXXXXXXX      XXXXXXXXXXXXXXXXXXXXXX   XXXXXXXXX   XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX      "
  ];
  var ROWS = MAP.length, COLS = MAP[0].length;
  var W = COLS * TILE, H = ROWS * TILE;

  function solidAt(c, r) {
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return c < 0; // walls on left, open right
    var t = MAP[r][c];
    return t === "X" || t === "B" || t === "?" || t === "P" || t === "=";
  }

  // ---- palette bridge: read the live theme so the game matches the site ----
  function themeColors() {
    var cs = getComputedStyle(document.body);
    function v(name, fb) { var x = cs.getPropertyValue(name).trim(); return x || fb; }
    return {
      accent: v("--pwn-accent", "#ff5c72"),
      accent2: v("--pwn-accent-2", "#ffb454"),
      accent3: v("--pwn-accent-3", "#56c8d8"),
      ok: v("--pwn-ok", "#7fd88f"),
      bg: v("--pwn-bg", "#0c0d12"),
      surface: v("--pwn-surface", "#191b24"),
      fg: v("--md-default-fg-color", "#e8e6ef")
    };
  }

  var overlay, canvas, ctx, raf, running, keys, C;
  var player, goombas, coins, score, lives, won, dead, blink, camX;

  function reset() {
    player = { x: TILE * 1.5, y: TILE * 8, w: 18, h: 22, vx: 0, vy: 0, ground: false, face: 1 };
    goombas = []; coins = []; won = false; dead = false; blink = 0; camX = 0;
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
      var t = MAP[r][c];
      if (t === "g") goombas.push({ x: c * TILE, y: r * TILE + 2, w: 20, h: 22, vx: -1.1, alive: true });
      else if (t === "o") coins.push({ x: c * TILE + 3, y: r * TILE + 2, got: false });
    }
    // coin-blocks (?) also drop a coin above them, collected on head-bump
    score = 0; lives = 3;
  }

  function rectsHit(a, b) {
    return a.x < b.x + (b.w || TILE) && a.x + a.w > b.x &&
           a.y < b.y + (b.h || TILE) && a.y + a.h > b.y;
  }

  function moveAxis(e, dx, dy) {
    e.x += dx; e.y += dy;
    var c0 = Math.floor(e.x / TILE), c1 = Math.floor((e.x + e.w - 1) / TILE);
    var r0 = Math.floor(e.y / TILE), r1 = Math.floor((e.y + e.h - 1) / TILE);
    for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) {
      if (!solidAt(c, r)) continue;
      if (dx > 0) e.x = c * TILE - e.w;
      else if (dx < 0) e.x = (c + 1) * TILE;
      if (dy > 0) { e.y = r * TILE - e.h; e.ground = true; e.vy = 0; }
      else if (dy < 0) {
        e.y = (r + 1) * TILE; e.vy = 0;
        if (MAP[r] && MAP[r][c] === "?") popBlock(c, r); // head-bump a coin block
      }
    }
  }

  function popBlock(c, r) {
    var row = MAP[r];
    MAP[r] = row.slice(0, c) + "B" + row.slice(c + 1); // spent -> plain brick
    score += 1; ping(880);
  }

  function loseLife() {
    lives -= 1; ping(160);
    if (lives <= 0) { dead = true; return; }
    player.x = TILE * 1.5; player.y = TILE * 8; player.vx = player.vy = 0; blink = 60;
  }

  function step() {
    if (won || dead) return;
    if (blink > 0) blink--;
    // input
    var ax = 0;
    if (keys.left) { ax = -MOVE; player.face = -1; }
    if (keys.right) { ax = MOVE; player.face = 1; }
    player.vx = ax;
    if (keys.jump && player.ground) { player.vy = -JUMP; player.ground = false; ping(520); keys.jump = false; }
    player.vy = Math.min(player.vy + GRAV, MAXFALL);
    player.ground = false;
    moveAxis(player, player.vx, 0);
    moveAxis(player, 0, player.vy);

    // fell off the world
    if (player.y > H + 40) { loseLife(); }

    // goombas
    goombas.forEach(function (g) {
      if (!g.alive) return;
      g.vy = Math.min((g.vy || 0) + GRAV, MAXFALL);
      g.ground = false;
      // turn at walls / ledges
      var aheadC = Math.floor((g.x + (g.vx < 0 ? -1 : g.w + 1)) / TILE);
      var footR = Math.floor((g.y + g.h + 2) / TILE);
      moveAxis(g, g.vx, 0);
      if (g.x <= 0 || solidAt(aheadC, Math.floor((g.y + g.h / 2) / TILE)) ||
          !solidAt(aheadC, footR)) g.vx = -g.vx;
      moveAxis(g, 0, g.vy);
      if (rectsHit(player, g)) {
        if (player.vy > 1 && player.y + player.h - g.y < 16) { // stomp
          g.alive = false; player.vy = -JUMP * 0.6; score += 2; ping(720);
        } else if (blink <= 0) { loseLife(); }
      }
    });

    // coins
    coins.forEach(function (co) {
      if (co.got) return;
      if (rectsHit(player, { x: co.x, y: co.y, w: 16, h: 18 })) { co.got = true; score += 1; ping(1040); }
    });

    // flag / win
    for (var r = 0; r < ROWS; r++) {
      var fc = MAP[r].indexOf("F");
      if (fc >= 0 && rectsHit(player, { x: fc * TILE, y: r * TILE, w: TILE, h: TILE })) won = true;
    }

    // camera
    camX = Math.max(0, Math.min(player.x - canvas.clientWidth / 3, W - canvas.clientWidth));
  }

  // ---- tiny WebAudio blips (no assets) ----
  var actx;
  function ping(freq) {
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      var o = actx.createOscillator(), g = actx.createGain();
      o.type = "square"; o.frequency.value = freq;
      g.gain.value = 0.03; o.connect(g); g.connect(actx.destination);
      o.start(); g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + 0.12);
      o.stop(actx.currentTime + 0.13);
    } catch (e) { /* audio optional */ }
  }

  function px(x) { return Math.round(x - camX); }

  function draw() {
    var vw = canvas.width, vh = canvas.height;
    // sky gradient from theme
    var grd = ctx.createLinearGradient(0, 0, 0, vh);
    grd.addColorStop(0, C.bg);
    grd.addColorStop(1, C.surface);
    ctx.fillStyle = grd; ctx.fillRect(0, 0, vw, vh);

    // parallax hills
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    for (var i = 0; i < 6; i++) {
      var hx = px(i * 320 - (camX * 0.3)) % (vw + 320);
      ctx.beginPath(); ctx.arc(((i * 320) - camX * 0.4) % (vw + 320), vh - 40, 90, Math.PI, 0); ctx.fill();
    }

    var c0 = Math.floor(camX / TILE), c1 = c0 + Math.ceil(vw / TILE) + 1;
    for (var r = 0; r < ROWS; r++) {
      for (var c = c0; c <= c1; c++) {
        if (c < 0 || c >= COLS) continue;
        var t = MAP[r][c], X = px(c * TILE), Y = r * TILE;
        if (t === "X") { ctx.fillStyle = C.surface; ctx.fillRect(X, Y, TILE, TILE); ctx.fillStyle = C.accent2; ctx.fillRect(X, Y, TILE, 4); }
        else if (t === "B") { ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fillRect(X + 1, Y + 1, TILE - 2, TILE - 2); }
        else if (t === "?") { ctx.fillStyle = C.accent2; ctx.fillRect(X + 1, Y + 1, TILE - 2, TILE - 2); ctx.fillStyle = C.bg; ctx.font = "bold 15px monospace"; ctx.fillText("?", X + 7, Y + 17); }
        else if (t === "=") { ctx.fillStyle = C.accent3; ctx.fillRect(X, Y + 6, TILE, TILE - 10); }
        else if (t === "F") {
          ctx.strokeStyle = C.fg; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(X + 12, Y); ctx.lineTo(X + 12, Y + TILE); ctx.stroke();
          ctx.fillStyle = C.accent; ctx.beginPath(); ctx.moveTo(X + 12, Y + 2); ctx.lineTo(X + 26, Y + 8); ctx.lineTo(X + 12, Y + 14); ctx.fill();
        }
      }
    }

    // coins
    coins.forEach(function (co) {
      if (co.got) return;
      var wob = 5 + 3 * Math.sin(Date.now() / 150 + co.x);
      ctx.fillStyle = C.accent2;
      ctx.beginPath(); ctx.ellipse(px(co.x + 8), co.y + 9, wob, 9, 0, 0, Math.PI * 2); ctx.fill();
    });

    // goombas
    goombas.forEach(function (g) {
      if (!g.alive) return;
      ctx.fillStyle = "#8a5a2b"; ctx.fillRect(px(g.x), g.y + 6, g.w, g.h - 6);
      ctx.fillStyle = "#5c3a1a"; ctx.fillRect(px(g.x), g.y + g.h - 5, g.w, 5);
      ctx.fillStyle = "#fff"; ctx.fillRect(px(g.x) + 4, g.y + 10, 4, 5); ctx.fillRect(px(g.x) + 12, g.y + 10, 4, 5);
      ctx.fillStyle = "#000"; ctx.fillRect(px(g.x) + 5, g.y + 12, 2, 3); ctx.fillRect(px(g.x) + 13, g.y + 12, 2, 3);
    });

    // player (little hacker-plumber)
    if (!(blink > 0 && Math.floor(blink / 5) % 2)) {
      var X = px(player.x), Y = player.y;
      ctx.fillStyle = C.accent;               // cap + shirt
      ctx.fillRect(X, Y, player.w, 8);
      ctx.fillRect(X + 2, Y + 8, player.w - 4, 8);
      ctx.fillStyle = "#f0c8a0";              // face
      ctx.fillRect(X + 4, Y + 6, player.w - 6, 6);
      ctx.fillStyle = C.accent3;              // overalls
      ctx.fillRect(X + 2, Y + 14, player.w - 4, player.h - 14);
      ctx.fillStyle = "#000";                 // eye, faces direction
      ctx.fillRect(X + (player.face > 0 ? player.w - 7 : 4), Y + 7, 2, 3);
    }

    // HUD
    ctx.fillStyle = C.fg; ctx.font = "bold 14px monospace";
    ctx.fillText("SCORE " + score, 14, 22);
    ctx.fillText("LIVES " + Math.max(lives, 0), vw - 92, 22);

    if (won || dead) {
      ctx.fillStyle = "rgba(0,0,0,0.66)"; ctx.fillRect(0, 0, vw, vh);
      ctx.fillStyle = won ? C.ok : C.accent;
      ctx.font = "bold 30px monospace"; ctx.textAlign = "center";
      ctx.fillText(won ? "WORLD CLEAR!" : "GAME OVER", vw / 2, vh / 2 - 6);
      ctx.fillStyle = C.fg; ctx.font = "14px monospace";
      ctx.fillText("score " + score + "  ·  press  R  to retry  ·  Esc to exit", vw / 2, vh / 2 + 26);
      ctx.textAlign = "left";
    }
  }

  function loop() {
    if (!running) return;
    step(); draw();
    raf = requestAnimationFrame(loop);
  }

  function sizeCanvas() {
    if (!canvas) return;
    var box = overlay.querySelector(".pwn-game-stage");
    var w = box.clientWidth, h = box.clientHeight;
    canvas.width = w; canvas.height = h;
  }

  function open() {
    if (running) return;
    C = themeColors();
    overlay = document.createElement("div");
    overlay.className = "pwn-game-overlay";
    overlay.innerHTML =
      '<div class="pwn-game-modal">' +
      '  <div class="pwn-game-bar">' +
      '    <span class="pwn-game-title">🍄 warp zone</span>' +
      '    <span class="pwn-game-hint">← → move · space jump · R retry · Esc exit</span>' +
      '    <button class="pwn-game-x" aria-label="Close game">✕</button>' +
      '  </div>' +
      '  <div class="pwn-game-stage"><canvas></canvas></div>' +
      '</div>';
    document.body.appendChild(overlay);
    document.body.classList.add("pwn-search-open"); // reuse: locks page scroll
    canvas = overlay.querySelector("canvas");
    ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    sizeCanvas();
    window.addEventListener("resize", sizeCanvas);
    keys = { left: false, right: false, jump: false };
    reset();
    running = true;
    overlay.querySelector(".pwn-game-x").addEventListener("click", close);
    overlay.addEventListener("mousedown", function (e) { if (e.target === overlay) close(); });
    loop();
  }

  function close() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    window.removeEventListener("resize", sizeCanvas);
    if (overlay) overlay.remove();
    overlay = canvas = ctx = null;
    document.body.classList.remove("pwn-search-open");
  }

  function onKeyDown(e) {
    if (!running) return;
    switch (e.key) {
      case "ArrowLeft": case "a": case "A": keys.left = true; e.preventDefault(); break;
      case "ArrowRight": case "d": case "D": keys.right = true; e.preventDefault(); break;
      case "ArrowUp": case "w": case "W": case " ": keys.jump = true; e.preventDefault(); break;
      case "Escape": close(); break;
      case "r": case "R": if (won || dead) reset(); break;
    }
  }
  function onKeyUp(e) {
    if (!running) return;
    switch (e.key) {
      case "ArrowLeft": case "a": case "A": keys.left = false; break;
      case "ArrowRight": case "d": case "D": keys.right = false; break;
      case "ArrowUp": case "w": case "W": case " ": keys.jump = false; break;
    }
  }

  // ---- secret trigger: type "mario" ----
  var SECRET = "mario", buf = "";
  document.addEventListener("keydown", function (e) {
    if (running) return;                       // game handles its own keys
    if (e.key && e.key.length === 1) {
      buf = (buf + e.key.toLowerCase()).slice(-SECRET.length);
      if (buf === SECRET) { buf = ""; open(); }
    }
  });
  document.addEventListener("pwn:warp", open);   // programmatic / clickable trigger
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);

  // Expose so a themed element (e.g. the homepage mushroom) can launch it.
  window.pwnWarp = open;
})();
