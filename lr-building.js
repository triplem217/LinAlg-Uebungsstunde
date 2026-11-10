(() => {
  "use strict";

  // Zwei Federn in Serie: Boden – Feder k₁ – Platte 1 – Feder k₂ – Platte 2.
  // Modell: A·x = b mit A = [[k1+k2, -k2], [-k2, k2]], gelöst über A = L·R (x nach unten positiv).
  // Der Stoss ist temporär: Die Platten sinken bis x (Maximum) und kehren danach in die Ruhelage zurück.

  const root = document.getElementById("linlab-app");
  const panel = root.querySelector('[data-application-panel="lr"]');
  const canvas = root.querySelector("#lr-building-canvas");
  const ctx = canvas.getContext("2d");
  const storageKey = "linlab-lr-building-v2";

  // Federkonstanten in kN/cm (fest).
  const k1 = 30;
  const k2 = 20;
  const A = [[k1 + k2, -k2], [-k2, k2]];
  const B_MAX = 100;
  const defaults = { b1: 40, b2: 40, speed: 1 };
  const state = { ...defaults };

  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved) {
      state.b1 = clamp(Number(saved.b1), -B_MAX, B_MAX, defaults.b1);
      state.b2 = clamp(Number(saved.b2), -B_MAX, B_MAX, defaults.b2);
      state.speed = [1, 0.5, 0.25].includes(saved.speed) ? saved.speed : 1;
    }
  } catch (_) { /* Speichern ist optional. */ }

  // LR-Zerlegung von A (einmalig, A ist fest).
  const l21 = A[1][0] / A[0][0];
  const R = [[A[0][0], A[0][1]], [0, A[1][1] - l21 * A[0][1]]];

  function solve(b1, b2) {
    const y1 = b1;                              // L·y = b (vorwärts)
    const y2 = b2 - l21 * y1;
    const x2 = y2 / R[1][1];                    // R·x = y (rückwärts)
    const x1 = (y1 - R[0][1] * x2) / R[0][0];
    return [x1, x2];
  }

  function loadsFrom(x) {
    return [A[0][0] * x[0] + A[0][1] * x[1], A[1][0] * x[0] + A[1][1] * x[1]];
  }

  function clamp(value, min, max, fallback) {
    return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
  }

  const fmt = (value, digits = 1) => {
    const v = Math.abs(value) < 0.5 * 10 ** -digits ? 0 : value;
    return v.toLocaleString("de-CH", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  };

  // Virtuelle Zeichenfläche: oben die Federn, unten der Zeitverlauf
  const W = 900;
  const H = 760;
  const SCALE = 16;            // Pixel pro cm Verschiebung (überhöht)
  const P = { x0: 78, x1: 860, y0: 560, y1: 728 };

  // Zeitplan des Stosses (Simulationszeit in ms)
  const T_STAND = 600;
  const T_RISE = 800;
  const T_HOLD = 600;
  const T_WIND_OFF = 600;      // Kraft fällt in 0.6 s ab → Stoss dauert total 2 s
  const T_FALL = 900;          // Kraft fällt ab, Platten kehren fast direkt in die Ruhelage zurück
  const T_PEAK = T_STAND + T_RISE;
  const T_RELEASE = T_PEAK + T_HOLD;
  const T_END = T_RELEASE + T_FALL;

  let displayX = [0, 0];
  let maxX = null;             // grösste Auslenkung des letzten Stosses
  let history = [];            // [{t, x1, x2}]
  let wind = 0;                // 0..1, momentane Stärke der Kräfte im Bild
  let preview = true;          // Kraftpfeile gestrichelt (noch nicht gestartet)
  let anim = null;             // {t, target, mode}
  let lastNow = null;
  let drag = null;
  let scrub = false;           // Zeitmarke im Diagramm wird gezogen
  let dirty = true;
  let lastNight = null;
  let view = { s: 1, ox: 0, oy: 0 };

  const style = document.createElement("style");
  style.textContent = `
    #linlab-app .lr-visual {
      min-width: 0;
      min-height: 0;
      overflow: hidden;
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel);
    }
    #linlab-app .lr-canvas-wrap {
      position: relative;
      min-height: 460px;
      overflow: hidden;
      background: linear-gradient(180deg, var(--panel) 0%, var(--panel-2) 100%);
    }
    #linlab-app #lr-building-canvas {
      position: absolute;
      inset: 0;
      display: block;
      width: 100%;
      height: 100%;
      touch-action: none;
    }
    #linlab-app .lr-hint {
      margin: 10px 0 0;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.4;
    }
    #linlab-app .lr-transport {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 8px;
    }
    #linlab-app .lr-transport button {
      display: grid;
      place-items: center;
      min-height: 38px;
    }
    #linlab-app .lr-speed {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
    }
    #linlab-app .lr-speed button[aria-pressed="true"] {
      color: #fff;
      border-color: var(--accent);
      background: var(--accent);
    }
    #linlab-app .lr-system {
      overflow-x: auto;
      padding: 4px 0 2px;
      color: var(--ink);
      text-align: center;
    }
    #linlab-app .lr-system math { font-size: 19px; }
    #linlab-app .lr-system .lr-b { color: #c46335; }
    #linlab-app .lr-system .lr-x { color: var(--accent); }
    #linlab-app.night-mode .lr-system .lr-b { color: #f0b07d; }
    #linlab-app .lr-readout {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    #linlab-app .lr-readout > div {
      padding: 9px 10px;
      border: 1px solid var(--line);
      border-radius: 8px;
      color: var(--muted);
      font-size: 12px;
    }
    #linlab-app .lr-readout strong {
      display: block;
      margin-top: 3px;
      color: var(--ink);
      font: 600 18px ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    #linlab-app .lr-readout small {
      display: block;
      margin-top: 2px;
      color: var(--accent);
      font: 600 11px ui-monospace, SFMono-Regular, Menlo, monospace;
    }
  `;
  root.prepend(style);

  // ---------- UI ----------
  const els = {
    b1: root.querySelector("#lr-b1"),
    b2: root.querySelector("#lr-b2"),
    b1Out: root.querySelector("#lr-b1-value"),
    b2Out: root.querySelector("#lr-b2-value"),
    x1Out: root.querySelector("#lr-x1"),
    x2Out: root.querySelector("#lr-x2"),
    x1Max: root.querySelector("#lr-x1-max"),
    x2Max: root.querySelector("#lr-x2-max"),
    system: root.querySelector("#lr-system"),
    speed: [...root.querySelectorAll("[data-lr-speed]")],
    play: root.querySelector("#lr-play"),
    skip: root.querySelector("#lr-skip"),
  };

  function loadLabel(value) {
    const v = Math.round(value);
    if (v === 0) return "0 kN";
    return `${Math.abs(v)} kN ${v > 0 ? "↓" : "↑"}`;
  }

  const num = value => {
    const v = Math.round(value * 10) / 10;
    const text = fmt(Math.abs(v), Number.isInteger(v) ? 0 : 1);
    return v < 0 ? `<mrow><mo>−</mo><mn>${text}</mn></mrow>` : `<mn>${text}</mn>`;
  };
  const col = (a, b, cls = "") => `<mrow${cls ? ` class="${cls}"` : ""}><mo>(</mo><mtable><mtr><mtd>${a}</mtd></mtr><mtr><mtd>${b}</mtd></mtr></mtable><mo>)</mo></mrow>`;
  const sub = (name, i) => `<msub><mi>${name}</mi><mn>${i}</mn></msub>`;

  function syncSystem() {
    const x = solve(state.b1, state.b2);
    const matrix = `<mrow><mo>(</mo><mtable columnspacing="0.9em">
      <mtr><mtd>${num(A[0][0])}</mtd><mtd>${num(A[0][1])}</mtd></mtr>
      <mtr><mtd>${num(A[1][0])}</mtd><mtd>${num(A[1][1])}</mtd></mtr>
    </mtable><mo>)</mo></mrow>`;
    els.system.innerHTML = `
      <math display="block">
        <mrow>${matrix}<mo>·</mo>${col(sub("x", 1), sub("x", 2), "lr-x")}<mo>=</mo>${col(num(state.b1), num(state.b2), "lr-b")}</mrow>
      </math>
      <math display="block" style="margin-top:12px">
        <mrow>${col(sub("x", 1), sub("x", 2), "lr-x")}<mo>=</mo>${col(num(x[0]), num(x[1]), "lr-x")}</mrow>
      </math>`;
  }

  function syncControls() {
    els.b1.value = String(Math.round(state.b1));
    els.b2.value = String(Math.round(state.b2));
    els.b1Out.textContent = loadLabel(state.b1);
    els.b2Out.textContent = loadLabel(state.b2);
    els.speed.forEach(btn => btn.setAttribute("aria-pressed", String(Number(btn.dataset.lrSpeed) === state.speed)));
    syncSystem();
    syncReadout();
  }

  function syncReadout() {
    els.x1Out.textContent = `${fmt(displayX[0])} cm`;
    els.x2Out.textContent = `${fmt(displayX[1])} cm`;
    els.x1Max.textContent = maxX ? `max ${fmt(maxX[0])} cm` : "max –";
    els.x2Max.textContent = maxX ? `max ${fmt(maxX[1])} cm` : "max –";
  }

  function persist() {
    try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch (_) { /* optional */ }
  }

  const ICON_PLAY = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z" fill="currentColor"/></svg>';
  const ICON_PAUSE = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="6" y="5" width="4.2" height="14" rx="1" fill="currentColor"/><rect x="13.8" y="5" width="4.2" height="14" rx="1" fill="currentColor"/></svg>';

  function setPlayIcon(running) {
    els.play.innerHTML = running ? ICON_PAUSE : ICON_PLAY;
    els.play.setAttribute("aria-label", running ? "Anhalten" : "Abspielen");
    els.play.title = running ? "Anhalten" : "Abspielen";
  }

  function setPlayIdle() { setPlayIcon(false); }

  function toRest() {
    anim = null;
    displayX = [0, 0];
    maxX = null;
    history = [];
    wind = 0;
    preview = true;
    setPlayIdle();
    syncReadout();
    dirty = true;
  }

  function startAnimation() {
    anim = { t: 0, target: solve(state.b1, state.b2), mode: "gust" };
    lastNow = null;
    displayX = [0, 0];
    maxX = [0, 0];
    history = [];
    wind = 0;
    preview = false;
    setPlayIcon(true);
    dirty = true;
  }

  const smooth = t => t * t * (3 - 2 * t);
  // Nach dem Stoss: kurzes Zurückschwingen in die Ruhelage
  const swayBack = u => (1 - u) * (1 - u) * Math.cos(0.9 * Math.PI * u);

  function sample(t, target) {
    let factor = 0;
    let w = 0;
    if (t < T_STAND) {
      factor = 0; w = 0;
    } else if (t < T_PEAK) {
      factor = smooth((t - T_STAND) / T_RISE); w = factor;
    } else if (t < T_RELEASE) {
      factor = 1; w = 1;
    } else {
      const u = Math.min(1, (t - T_RELEASE) / T_FALL);
      factor = u >= 1 ? 0 : swayBack(u);
      w = 1 - smooth(Math.min(1, (t - T_RELEASE) / T_WIND_OFF));
    }
    return { x: target.map(v => v * factor), w };
  }

  function updateAnimation(now) {
    const dt = lastNow === null ? 0 : Math.min(50, Math.max(0, now - lastNow));
    lastNow = now;
    if (!anim || drag || anim.paused) return;
    anim.t = Math.min(T_END, anim.t + dt * state.speed);
    const { x, w } = sample(anim.t, anim.target);
    displayX = x;
    wind = w;
    if (anim.mode === "gust" && !anim.full) {
      history.push({ t: anim.t, x1: x[0], x2: x[1] });
      maxX = maxX.map((m, i) => Math.abs(x[i]) > Math.abs(m) ? x[i] : m);
    }
    if (anim.t >= T_END) {
      anim = null;
      displayX = [0, 0];
      wind = 0;
      setPlayIdle();
    }
    syncReadout();
    dirty = true;
  }

  // ---------- Zeichnen ----------
  function palette(night) {
    return night ? {
      ink: "#e4e8e9", muted: "#8f999c", grid: "rgba(255,255,255,.08)", spring: "#aab6ba",
      slab: "#8c999d", slabText: "#172023", ground: "#6d777a",
      wind: "#f0b07d", windBand: "rgba(240,176,125,.10)", f1: "#73c5bc", f2: "#9fb6f0", chip: "#1f2527"
    } : {
      ink: "#25333b", muted: "#718086", grid: "rgba(37,51,59,.08)", spring: "#53646b",
      slab: "#53646b", slabText: "#ffffff", ground: "#8a969a",
      wind: "#c46335", windBand: "rgba(196,99,53,.08)", f1: "#008f8c", f2: "#3f63b8", chip: "#ffffff"
    };
  }

  // Zeitverlauf x₁(t), x₂(t) mit markiertem Maximum
  function drawPlot(c) {
    const { x0, x1, y0, y1 } = P;
    const mid = (y0 + y1) / 2;
    const target = anim ? anim.target : solve(state.b1, state.b2);
    const range = Math.max(1, Math.abs(target[0]), Math.abs(target[1]), ...(maxX || [0]).map(Math.abs)) * 1.2;
    const tx = t => x0 + (x1 - x0) * t / T_END;
    // x ist nach unten positiv, also im Diagramm auch nach unten auftragen
    const ty = v => mid + (v / range) * (y1 - y0) / 2;

    // Stoss-Bereich
    ctx.fillStyle = c.windBand;
    ctx.fillRect(tx(T_STAND), y0, tx(T_RELEASE + T_WIND_OFF) - tx(T_STAND), y1 - y0);
    ctx.fillStyle = c.wind;
    ctx.font = "600 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Stoss", tx(T_STAND) + 6, y0 + 5);

    // Achsen
    ctx.strokeStyle = c.grid;
    ctx.lineWidth = 1;
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    const tick = Math.max(1, Math.round(range * 0.8));
    ctx.fillStyle = c.muted;
    ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    [tick, -tick].forEach(v => {
      ctx.fillText(`${v} cm`, x0 - 8, ty(v));
      ctx.strokeStyle = c.grid;
      ctx.beginPath(); ctx.moveTo(x0, ty(v)); ctx.lineTo(x1, ty(v)); ctx.stroke();
    });
    ctx.fillText("0", x0 - 8, mid);
    ctx.strokeStyle = c.muted;
    ctx.beginPath(); ctx.moveTo(x0, mid); ctx.lineTo(x1, mid); ctx.stroke();
    ctx.textBaseline = "top";
    ctx.fillText("Zeit →", x1, y1 + 6);

    // Legende
    ctx.font = "600 12px system-ui, sans-serif";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    [[c.f1, "Platte 1 · x₁"], [c.f2, "Platte 2 · x₂"]].forEach(([color, text], k) => {
      const lx = x0 + k * 120;
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(lx, y0 - 14); ctx.lineTo(lx + 18, y0 - 14); ctx.stroke();
      ctx.fillStyle = c.ink;
      ctx.fillText(text, lx + 24, y0 - 14);
    });

    if (history.length) {
      [["x1", c.f1], ["x2", c.f2]].forEach(([key, color]) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.lineJoin = "round";
        ctx.beginPath();
        history.forEach((p, k) => k ? ctx.lineTo(tx(p.t), ty(p[key])) : ctx.moveTo(tx(p.t), ty(p[key])));
        ctx.stroke();
      });

      // Maxima markieren
      [[0, c.f1], [1, c.f2]].forEach(([i, color]) => {
        if (!maxX || Math.abs(maxX[i]) < 0.05) return;
        const key = i ? "x2" : "x1";
        const peak = history.find(p => Math.abs(p[key] - maxX[i]) < 1e-9) || history[history.length - 1];
        const px = tx(peak.t);
        const py = ty(peak[key]);
        ctx.setLineDash([3, 4]);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(x0, py); ctx.lineTo(px, py); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fill();
        // Beschriftung am linken Rand über der gestrichelten Linie
        const outward = maxX[i] >= 0 ? 1 : -1;
        const other = maxX[1 - i];
        const inner = Math.abs(other) > Math.abs(maxX[i]) && Math.sign(other) === Math.sign(maxX[i]);
        const dy = (inner ? -outward : outward) * 9;
        ctx.font = "700 13px ui-monospace, SFMono-Regular, Menlo, monospace";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(`max ${fmt(maxX[i])} cm`, x0 + 6, py + dy);
      });
    }

    // Zeitmarke (verschiebbar)
    const cursorT = anim && anim.mode === "gust" ? anim.t : (history.length ? T_END : null);
    if (cursorT !== null) {
      const cx = tx(cursorT);
      ctx.strokeStyle = c.ink;
      ctx.globalAlpha = scrub ? 0.85 : 0.55;
      ctx.lineWidth = scrub ? 2.5 : 1.8;
      ctx.beginPath(); ctx.moveTo(cx, y0); ctx.lineTo(cx, y1); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = c.ink;
      ctx.beginPath();
      ctx.moveTo(cx - 7, y1 + 1); ctx.lineTo(cx + 7, y1 + 1); ctx.lineTo(cx, y1 - 8);
      ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(cx, y0, 5, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ---------- Federmodell: Boden – Feder k₁ – Platte 1 – Feder k₂ – Platte 2 ----------
  const S = { cx: 450, groundY: 470, restY: [300, 130], half: 120, thick: 18, coil: 44 };
  const plateY = level => S.restY[level] + displayX[level] * SCALE;   // nach unten positiv

  function arrowV(x, y1, y2, color, width, head = 16) {
    const dir = Math.sign(y2 - y1) || 1;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, y1);
    ctx.lineTo(x, y2 - dir * head * 0.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y2);
    ctx.lineTo(x - head * 0.6, y2 - dir * head);
    ctx.lineTo(x + head * 0.6, y2 - dir * head);
    ctx.closePath();
    ctx.fill();
  }

  function drawCoil(yBottom, yTop, c) {
    const turns = 14;
    const lead = 8;
    const a = yBottom - lead;
    const b = yTop + lead;
    ctx.strokeStyle = c.spring;
    ctx.lineWidth = 3.5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(S.cx, yBottom);
    ctx.lineTo(S.cx, a);
    for (let i = 1; i <= turns; i++) {
      const y = a + (b - a) * (i - 0.5) / turns;
      ctx.lineTo(S.cx + (i % 2 ? S.coil : -S.coil), y);
    }
    ctx.lineTo(S.cx, b);
    ctx.lineTo(S.cx, yTop);
    ctx.stroke();
  }

  function drawPlate(level, c) {
    const y = plateY(level);
    ctx.fillStyle = c.slab;
    ctx.fillRect(S.cx - S.half, y - S.thick / 2, S.half * 2, S.thick);
    ctx.fillStyle = c.slabText;
    ctx.font = "700 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`Platte ${level + 1}`, S.cx, y + 1);
  }

  function drawForce(level, load, c) {
    if (Math.abs(load) < 0.5) return;
    const strength = preview ? 1 : wind;
    if (strength < 0.02) return;
    const top = plateY(level) - S.thick / 2;
    const room = level === 0 ? top - (plateY(1) + S.thick / 2) - 16 : top - 24;
    const length = Math.max(12, Math.min(40 + Math.abs(load) * 1.2, room)) * strength;
    const dir = Math.sign(load);
    // Druck: Pfeil endet auf der Platte. Zug: Pfeil startet an der Platte und zeigt nach oben.
    // b₁ greift mittig an Platte 1 an und wird deshalb durch die obere Feder hindurch gezeichnet.
    const from = dir > 0 ? top - 4 - length : top - 4;
    const to = dir > 0 ? top - 4 : top - 4 - length;
    ctx.save();
    if (preview) {
      ctx.globalAlpha = 0.35;
      ctx.setLineDash([10, 8]);
    }
    arrowV(S.cx, from, to, c.wind, 7, 18);
    ctx.restore();
    ctx.save();
    ctx.fillStyle = c.wind;
    ctx.globalAlpha = preview ? 0.6 : Math.min(1, strength * 1.5);
    ctx.font = "700 17px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(`b${level ? "₂" : "₁"} = ${Math.round(Math.abs(load))} kN`, S.cx - S.coil - 18, (from + to) / 2);
    ctx.restore();
  }

  function drawDimensionV(level, value, color, c, prefix) {
    const dy = value * SCALE;
    if (Math.abs(dy) < 3) return;
    const x = S.cx + S.half + 30 + level * 34;
    const rest = S.restY[level] - S.thick / 2;
    const end = rest + dy;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(S.cx + S.half + 6, rest); ctx.lineTo(x + 8, rest);
    ctx.moveTo(S.cx + S.half + 6, end); ctx.lineTo(x + 8, end);
    ctx.stroke();
    ctx.setLineDash([6, 4]);
    arrowV(x, rest, end, color, 2.5, Math.min(11, Math.abs(dy) * 0.6));
    ctx.setLineDash([]);
    ctx.font = "700 16px ui-monospace, SFMono-Regular, Menlo, monospace";
    const label = `${prefix} = ${fmt(value)} cm`;
    const w = ctx.measureText(label).width;
    const left = x + 14;
    const ty = (rest + end) / 2;
    ctx.fillStyle = c.chip;
    ctx.fillRect(left - 5, ty - 11, w + 10, 22);
    ctx.fillStyle = color;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(label, left, ty);
  }

  function drawSprings(c) {
    // Boden
    ctx.fillStyle = c.ground;
    ctx.fillRect(S.cx - 170, S.groundY, 340, 6);
    ctx.strokeStyle = c.ground;
    ctx.lineWidth = 2;
    for (let x = S.cx - 160; x <= S.cx + 170; x += 26) {
      ctx.beginPath();
      ctx.moveTo(x, S.groundY + 6);
      ctx.lineTo(x - 14, S.groundY + 20);
      ctx.stroke();
    }
    drawCoil(S.groundY, plateY(0) + S.thick / 2, c);
    drawCoil(plateY(0) - S.thick / 2, plateY(1) + S.thick / 2, c);
    ctx.fillStyle = c.muted;
    ctx.font = "600 15px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("k₁", S.cx + S.coil + 14, (S.groundY + plateY(0)) / 2);
    ctx.fillText("k₂", S.cx + S.coil + 14, (plateY(0) + plateY(1)) / 2);
    drawPlate(0, c);
    drawPlate(1, c);
    drawForce(0, state.b1, c);
    drawForce(1, state.b2, c);
    const live = drag || anim || !maxX;
    const shown = live ? displayX : maxX;
    drawDimensionV(0, shown[0], c.f1, c, live ? "x₁" : "x₁,max");
    drawDimensionV(1, shown[1], c.f2, c, live ? "x₂" : "x₂,max");
  }

  function drawScene(night) {
    const c = palette(night);
    drawSprings(c);
    drawPlot(c);
  }

  function render(now = performance.now()) {
    if (panel.hidden || !root.classList.contains("applications-active")) { lastNow = null; return; }
    updateAnimation(now);
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pw = Math.round(rect.width * dpr);
    const ph = Math.round(rect.height * dpr);
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
      dirty = true;
    }
    const night = root.classList.contains("night-mode");
    if (night !== lastNight) { lastNight = night; dirty = true; }
    if (!dirty) return;
    dirty = false;
    const s = Math.min(rect.width / W, rect.height / H);
    view = { s, ox: (rect.width - W * s) / 2, oy: (rect.height - H * s) / 2 };
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, pw, ph);
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * view.ox, dpr * view.oy);
    drawScene(night);
  }

  // ---------- Platten von Hand verschieben ----------
  function pointer(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left - view.ox) / view.s,
      y: (event.clientY - rect.top - view.oy) / view.s
    };
  }

  function hitPlate(p) {
    const hits = [0, 1]
      .map(level => ({ level, y: plateY(level) }))
      .filter(h => Math.abs(p.y - h.y) <= 30 && Math.abs(p.x - S.cx) <= S.half + 20);
    return hits.sort((a, b) => Math.abs(p.y - a.y) - Math.abs(p.y - b.y))[0] || null;
  }

  // ---------- In der Zeit vor- und zurückspringen ----------
  function inPlot(p) {
    return p.x >= P.x0 - 12 && p.x <= P.x1 + 12 && p.y >= P.y0 - 8 && p.y <= P.y1 + 12;
  }

  function scrubTo(px) {
    const t = clamp((px - P.x0) / (P.x1 - P.x0) * T_END, 0, T_END, 0);
    if (!anim || anim.mode !== "gust") {
      anim = { t, target: solve(state.b1, state.b2), mode: "gust" };
      preview = false;
    }
    if (!anim.full) {
      // ganzen Verlauf vorausberechnen, damit man frei hin- und herfahren kann
      history = [];
      maxX = [0, 0];
      for (let s = 0; s <= T_END; s += 16) {
        const { x } = sample(Math.min(s, T_END), anim.target);
        history.push({ t: s, x1: x[0], x2: x[1] });
        maxX = maxX.map((m, i) => Math.abs(x[i]) > Math.abs(m) ? x[i] : m);
      }
      anim.full = true;
    }
    anim.paused = true;
    anim.t = t;
    setPlayIcon(false);
    const { x, w } = sample(t, anim.target);
    displayX = x;
    wind = w;
    syncReadout();
    dirty = true;
  }

  canvas.addEventListener("pointerdown", event => {
    const p = pointer(event);
    if (inPlot(p)) {
      scrub = true;
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor = "ew-resize";
      scrubTo(p.x);
      return;
    }
    const hit = hitPlate(p);
    if (!hit) return;
    anim = null;
    preview = false;
    wind = 1;
    maxX = null;
    history = [];
    setPlayIdle();
    drag = { level: hit.level, offset: p.y - hit.y };
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = "grabbing";
  });

  canvas.addEventListener("pointermove", event => {
    const p = pointer(event);
    if (scrub) {
      scrubTo(p.x);
      return;
    }
    if (!drag) {
      canvas.style.cursor = inPlot(p) ? "ew-resize" : hitPlate(p) ? "grab" : "default";
      return;
    }
    const next = [...displayX];
    next[drag.level] = (p.y - drag.offset - S.restY[drag.level]) / SCALE;
    // Lasten, die zu dieser Verschiebung gehören: b = A·x (auf Reglerbereich begrenzt)
    const raw = loadsFrom(next);
    const largest = Math.max(Math.abs(raw[0]), Math.abs(raw[1]));
    const factor = largest > B_MAX ? B_MAX / largest : 1;
    displayX = next.map(v => v * factor);
    const b = loadsFrom(displayX);
    state.b1 = Math.round(b[0]);
    state.b2 = Math.round(b[1]);
    syncControls();
    dirty = true;
  });

  function release(event) {
    if (scrub) {
      scrub = false;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      dirty = true;
      return;
    }
    if (!drag) return;
    drag = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    canvas.style.cursor = "grab";
    // Loslassen: Platten federn aus der gezogenen Lage zurück
    const target = solve(state.b1, state.b2);
    maxX = [...target];
    anim = { t: T_RELEASE, target, mode: "release" };
    lastNow = null;
    setPlayIcon(true);
    persist();
    syncReadout();
    dirty = true;
  }
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);

  // ---------- Regler & Knöpfe ----------
  ["b1", "b2"].forEach(key => {
    els[key].addEventListener("input", event => {
      state[key] = Number(event.currentTarget.value);
      syncControls();
      persist();
      toRest();
      render();
    });
  });

  els.speed.forEach(btn => btn.addEventListener("click", () => {
    state.speed = Number(btn.dataset.lrSpeed);
    syncControls();
    persist();
  }));

  // Play/Stopp in einem Knopf
  els.play.addEventListener("click", () => {
    if (!anim) startAnimation();
    else {
      anim.paused = !anim.paused;   // anhalten bzw. an derselben Stelle weiterlaufen
      lastNow = null;
      setPlayIcon(!anim.paused);
    }
    render();
  });

  // Vorspulen: Animation sofort zu Ende rechnen (Verlauf und Maximum bleiben sichtbar)
  els.skip.addEventListener("click", () => {
    if (!anim) startAnimation();
    anim.paused = false;
    setPlayIcon(true);
    for (let t = anim.t; t < T_END; t += 16) {
      const { x } = sample(t, anim.target);
      if (anim.mode === "gust" && !anim.full) {
        history.push({ t, x1: x[0], x2: x[1] });
        maxX = maxX.map((m, i) => Math.abs(x[i]) > Math.abs(m) ? x[i] : m);
      }
    }
    anim.t = T_END - 1e-6;
    lastNow = performance.now();
    render();
  });

  new ResizeObserver(() => { dirty = true; render(); }).observe(canvas.parentElement);
  syncControls();
  toRest();
  window.LinlabLR = { render, start: startAnimation };
})();
