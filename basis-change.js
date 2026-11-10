(() => {
  "use strict";

  // Basiswechsel in 2D.
  // Der Vektor v bleibt als Pfeil fest; nur seine Beschreibung ändert sich.
  // B = (b₁ b₂) hat die neuen Basisvektoren als Spalten:
  //   [v]_E = B·[v]_B   und   [v]_B = B⁻¹·[v]_E
  // Matrizen sind als [a, b, c, d] für ((a, b), (c, d)) gespeichert.

  const root = document.getElementById("linlab-app");
  const panel = root.querySelector('[data-application-panel="basis"]');
  const canvas = root.querySelector("#basis-canvas");
  const ctx = canvas.getContext("2d");
  const storageKey = "linlab-basis-v1";

  const defaults = () => ({ b1: [2, 1], b2: [-1, 1], v: [3, 3], describe: "b" });
  const state = defaults();

  const LIMIT = 6;             // Vektorspitzen bleiben in ±LIMIT
  const MIN_LEN = 0.25;        // kürzeste erlaubte Basisvektorlänge
  const IDENTITY = [1, 0, 0, 1];

  const isPair = p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (saved) {
      ["b1", "b2", "v"].forEach(key => { if (isPair(saved[key])) state[key] = saved[key].map(n => Math.max(-LIMIT, Math.min(LIMIT, n))); });
      if (["e", "b"].includes(saved.describe)) state.describe = saved.describe;
    }
  } catch (_) { /* Speichern ist optional. */ }

  // ---------- Lineare Algebra ----------
  const basisMatrix = () => [state.b1[0], state.b2[0], state.b1[1], state.b2[1]];
  const det = m => m[0] * m[3] - m[1] * m[2];
  const apply = (m, p) => [m[0] * p[0] + m[1] * p[1], m[2] * p[0] + m[3] * p[1]];
  const inverse = m => {
    const d = det(m);
    if (Math.abs(d) < 1e-9) return null;
    return [m[3] / d, -m[1] / d, -m[2] / d, m[0] / d];
  };
  const len = p => Math.hypot(p[0], p[1]);
  // «Keine Basis», sobald der Winkel zwischen b₁ und b₂ unter ca. 2° fällt.
  const isSingular = () => Math.abs(det(basisMatrix())) <= 0.035 * len(state.b1) * len(state.b2) + 1e-9;
  // Gewählte Basis: ε (kariertes Gitter) oder B (Gitter entlang b₁, b₂)
  const showsE = () => state.describe === "e";
  const showsB = () => state.describe === "b";
  // Waagrechte Referenz in B: der Basisvektor, der näher an der x-Achse liegt.
  const reference = () => {
    const flat = b => (len(b) ? Math.abs(b[0]) / len(b) : 0);
    return flat(state.b1) >= flat(state.b2) ? "b1" : "b2";
  };
  const componentsB = () => {
    if (isSingular()) return null;
    return apply(inverse(basisMatrix()), state.v);
  };

  const fmt = (value, digits = 2) => {
    const f = 10 ** digits;
    let v = Math.round(value * f) / f;
    if (Object.is(v, -0)) v = 0;
    const text = Math.abs(v).toLocaleString("de-CH", { maximumFractionDigits: digits });
    return v < 0 ? `−${text}` : text;
  };

  // ---------- Styles ----------
  const style = document.createElement("style");
  style.textContent = `
    #linlab-app .basis-visual {
      min-width: 0;
      min-height: 0;
      overflow: hidden;
      display: grid;
      grid-template-rows: auto minmax(0, 1fr) auto;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel);
    }
    #linlab-app .basis-canvas-wrap {
      position: relative;
      min-height: 300px;
      overflow: hidden;
    }
    #linlab-app #basis-canvas {
      position: absolute;
      inset: 0;
      display: block;
      width: 100%;
      height: 100%;
      touch-action: none;
    }
    #linlab-app .basis-metrics {
      display: grid;
      grid-template-columns: 1fr 1fr;
      border-top: 1px solid var(--line);
      background: var(--panel-2);
    }
    #linlab-app .basis-metrics > div {
      min-width: 0;
      padding: 12px 16px 14px;
      display: grid;
      gap: 4px;
      border-left: 1px solid var(--line);
    }
    #linlab-app .basis-metrics > div:first-child { border-left: 0; }
    #linlab-app .basis-metrics > div > span {
      color: var(--muted);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.07em;
    }
    #linlab-app .basis-metrics strong {
      color: var(--ink);
      font: 700 clamp(17px, 1.75vw, 26px) ui-monospace, SFMono-Regular, Menlo, monospace;
      white-space: nowrap;
    }
    #linlab-app .bs-v { color: var(--violet); }
    #linlab-app .bs-b1 { color: var(--accent); }
    #linlab-app .bs-b2 { color: var(--accent-2); }
    #linlab-app .bs-e { color: var(--muted); }
    #linlab-app .basis-segment {
      display: grid;
      grid-auto-flow: column;
      grid-auto-columns: 1fr;
      gap: 6px;
    }
    #linlab-app .basis-segment button[aria-pressed="true"] {
      color: #fff;
      border-color: var(--accent);
      background: var(--accent);
    }
    #linlab-app .basis-math {
      overflow-x: auto;
      padding: 2px 0;
      color: var(--ink);
      text-align: center;
    }
    #linlab-app .basis-math math { font-size: 18px; }
    #linlab-app .basis-math math + math { margin-top: 12px; }
    #linlab-app .basis-note {
      margin: 0;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.4;
    }
    #linlab-app .basis-warning {
      margin: 0;
      padding: 9px 11px;
      border: 1px solid var(--danger);
      border-radius: 8px;
      color: var(--danger);
      font-size: 13px;
      font-weight: 600;
      line-height: 1.35;
    }
    #linlab-app .basis-warning[hidden] { display: none; }
    #linlab-app .basis-metrics > div { transition: opacity 0.2s; }
    #linlab-app .basis-metrics > div.is-dimmed { opacity: 0.28; }
    #linlab-app .basis-vectors {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 10px 6px;
    }
    #linlab-app .basis-vector {
      display: flex;
      align-items: center;
      gap: 6px;
      font: 700 16px ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    #linlab-app .basis-vector-fields {
      display: grid;
      gap: 5px;
      padding: 5px 7px;
      border: 2px solid var(--muted);
      border-top-color: transparent;
      border-bottom-color: transparent;
      border-radius: 16px;
    }
    #linlab-app .basis-vector input {
      width: 54px;
      padding: 6px 4px;
      border: 1px solid var(--line);
      border-radius: 7px;
      color: var(--ink);
      background: var(--panel);
      font: 600 15px ui-monospace, SFMono-Regular, Menlo, monospace;
      text-align: center;
    }
    #linlab-app .basis-vector input:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(0, 143, 140, 0.14);
    }
    #linlab-app .basis-vector input[aria-invalid="true"] {
      border-color: var(--danger);
      box-shadow: 0 0 0 3px rgba(185, 50, 50, 0.14);
    }
  `;
  root.prepend(style);

  // ---------- UI ----------
  const els = {
    status: root.querySelector("#basis-status"),
    lineE: root.querySelector("#basis-line-e"),
    lineB: root.querySelector("#basis-line-b"),
    matrix: root.querySelector("#basis-matrix"),
    convert: root.querySelector("#basis-convert"),
    warning: root.querySelector("#basis-warning"),
    describe: [...root.querySelectorAll("[data-basis-describe]")],
    inputs: [...root.querySelectorAll("[data-basis-input]")],
    reset: root.querySelector("#basis-reset")
  };

  let dirty = true;
  let lastNight = null;
  let size = { w: 0, h: 0 };
  let drag = null;                // "v" | "b1" | "b2"
  let hover = null;

  function persist() {
    try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch (_) { /* optional */ }
  }

  const mnum = value => {
    const text = fmt(value);
    return text.startsWith("−") ? `<mrow><mo>−</mo><mn>${text.slice(1)}</mn></mrow>` : `<mn>${text}</mn>`;
  };
  const mcol = (a, b, cls = "") => `<mrow${cls ? ` class="${cls}"` : ""}><mo>(</mo><mtable><mtr><mtd>${a}</mtd></mtr><mtr><mtd>${b}</mtd></mtr></mtable><mo>)</mo></mrow>`;
  const mmat = (m, colored) => `<mrow><mo>(</mo><mtable columnspacing="0.9em">
      <mtr><mtd${colored ? ' class="bs-b1"' : ""}>${m[0]}</mtd><mtd${colored ? ' class="bs-b2"' : ""}>${m[1]}</mtd></mtr>
      <mtr><mtd${colored ? ' class="bs-b1"' : ""}>${m[2]}</mtd><mtd${colored ? ' class="bs-b2"' : ""}>${m[3]}</mtd></mtr>
    </mtable><mo>)</mo></mrow>`;
  const coords = name => `<msub><mrow><mo>[</mo><mi class="bs-v">v</mi><mo>]</mo></mrow><mi>${name}</mi></msub>`;
  const msub = (name, i, cls) => `<msub class="${cls}"><mi>${name}</mi><mn>${i}</mn></msub>`;
  const B_INV = `<msup><mi>B</mi><mrow><mo>−</mo><mn>1</mn></mrow></msup>`;

  function syncReadout() {
    const B = basisMatrix();
    const c = componentsB();
    const v = state.v;
    const d = det(B);

    els.status.textContent = `det B = ${fmt(d)}`;
    els.warning.hidden = Boolean(c);

    els.lineE.innerHTML = `<span class="bs-v">v</span> = ${fmt(v[0])}·<span class="bs-e">e₁</span> + ${fmt(v[1])}·<span class="bs-e">e₂</span>`;
    els.lineB.innerHTML = c
      ? `<span class="bs-v">v</span> = ${fmt(c[0])}·<span class="bs-b1">b₁</span> + ${fmt(c[1])}·<span class="bs-b2">b₂</span>`
      : `<span class="bs-v">v</span> = ?`;

    els.matrix.innerHTML = `
      <math display="block">
        <mrow><mi>B</mi><mo>=</mo><mrow><mo>(</mo><mtable columnspacing="0.9em"><mtr><mtd>${msub("b", 1, "bs-b1")}</mtd><mtd>${msub("b", 2, "bs-b2")}</mtd></mtr></mtable><mo>)</mo></mrow>
        <mo>=</mo>${mmat(B.map(mnum), true)}</mrow>
      </math>`;

    const colE = mcol(mnum(v[0]), mnum(v[1]));
    if (c) {
      const colB = mcol(`<mrow class="bs-b1">${mnum(c[0])}</mrow>`, `<mrow class="bs-b2">${mnum(c[1])}</mrow>`);
      els.convert.innerHTML = `
        <math display="block">
          <mrow>${coords("ε")}<mo>=</mo><mi>B</mi><mo>·</mo>${coords("B")}</mrow>
        </math>
        <math display="block">
          <mrow>${colE}<mo>=</mo>${mmat(B.map(mnum), true)}<mo>·</mo>${colB}</mrow>
        </math>
        <math display="block" style="margin-top:20px">
          <mrow>${coords("B")}<mo>=</mo>${B_INV}<mo>·</mo>${coords("ε")}</mrow>
        </math>
        <math display="block">
          <mrow>${colB}<mo>=</mo>${mmat(inverse(B).map(mnum), false)}<mo>·</mo>${colE}</mrow>
        </math>`;
    } else {
      els.convert.innerHTML = `
        <math display="block">
          <mrow>${coords("B")}<mo>=</mo>${B_INV}<mo>·</mo>${coords("ε")}</mrow>
        </math>
        <math display="block">
          <mrow>${B_INV}<mtext>&nbsp;existiert nicht</mtext></mrow>
        </math>`;
    }
    syncInputs();
  }

  // Eingabefelder der Vektoren; das Feld, in dem gerade getippt wird, bleibt unberührt.
  const plain = value => String(Math.round(value * 1000) / 1000).replace("-", "−");
  function syncInputs() {
    els.inputs.forEach(input => {
      if (input === document.activeElement) return;
      const [key, index] = input.dataset.basisInput.split(".");
      input.value = plain(state[key][Number(index)]);
      input.removeAttribute("aria-invalid");
    });
  }
  const parseNumber = text => {
    const cleaned = text.trim().replace("−", "-").replace(",", ".");
    if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(cleaned)) return null;
    return Number(cleaned);
  };

  function syncControls() {
    els.describe.forEach(btn => btn.setAttribute("aria-pressed", String(btn.dataset.basisDescribe === state.describe)));
    els.lineE.parentElement.classList.toggle("is-dimmed", !showsE());
    els.lineB.parentElement.classList.toggle("is-dimmed", !showsB());
  }

  // ---------- Bildkoordinaten ----------
  const unit = () => Math.min(size.w, size.h) / 9;
  const toScreen = p => {
    const u = unit();
    return [size.w / 2 + p[0] * u, size.h / 2 - p[1] * u];
  };
  const toWorld = s => {
    const u = unit();
    return [(s[0] - size.w / 2) / u, (size.h / 2 - s[1]) / u];
  };

  // ---------- Zeichnen ----------
  function palette(night) {
    return night ? {
      bg0: "#202223", bg1: "#26292a", ink: "#f1f1ee", e: "#b1b4b6", eGrid: "rgba(255,255,255,0.10)", eAxis: "rgba(255,255,255,0.42)",
      b1: "#31aaa6", b2: "#e07a5f", v: "#a393e7", handle: "#202223", pillText: "#141617"
    } : {
      bg0: "#fffdfa", bg1: "#f1f3f2", ink: "#162025", e: "#5d6b70", eGrid: "rgba(22,32,37,0.11)", eAxis: "rgba(22,32,37,0.45)",
      b1: "#008f8c", b2: "#d65c3d", v: "#7258c8", handle: "#ffffff", pillText: "#ffffff"
    };
  }

  const fontScale = () => Math.max(0.9, Math.min(1.6, Math.min(size.w, size.h) / 620));
  const font = (px, weight = 600) => `${weight} ${Math.round(px * fontScale())}px Inter, ui-sans-serif, system-ui, -apple-system, sans-serif`;

  function line(a, b, color, width, dash = null, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
    ctx.restore();
  }

  // Pfeil in Bildkoordinaten
  function arrow(a, b, color, width, alpha = 1) {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const length = Math.hypot(dx, dy);
    if (length < 2) return;
    const ux = dx / length;
    const uy = dy / length;
    const head = Math.min(length, Math.max(12, width * 3.4));
    const half = head * 0.42;
    const base = [b[0] - ux * head, b[1] - uy * head];
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    if (length > head) {
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(base[0] + ux * 1, base[1] + uy * 1);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(b[0], b[1]);
    ctx.lineTo(base[0] - uy * half, base[1] + ux * half);
    ctx.lineTo(base[0] + uy * half, base[1] - ux * half);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Sichtbarer Bereich in den Koordinaten der Basis G
  function coordRange(G) {
    const Gi = inverse(G);
    if (!Gi) return null;
    const corners = [[0, 0], [size.w, 0], [0, size.h], [size.w, size.h]].map(toWorld);
    const cs = corners.map(p => apply(Gi, p));
    return {
      min1: Math.min(...cs.map(c => c[0])), max1: Math.max(...cs.map(c => c[0])),
      min2: Math.min(...cs.map(c => c[1])), max2: Math.max(...cs.map(c => c[1]))
    };
  }

  // Gitter der Basis G = (g₁ g₂). Linien parallel zu g₁ bekommen die Farbe von g₁.
  function drawGrid(G, color1, color2, alphaGrid, alphaAxis, widthAxis) {
    const r = coordRange(G);
    if (!r) return;
    const g1 = [G[0], G[2]];
    const g2 = [G[1], G[3]];
    const family = (dir, step, sMin, sMax, kMin, kMax, color) => {
      const span = kMax - kMin;
      if (!Number.isFinite(span) || !Number.isFinite(sMin) || !Number.isFinite(sMax)) return;
      const every = Math.max(1, Math.ceil(span / 90));
      for (let k = Math.ceil(kMin); k <= Math.floor(kMax); k += 1) {
        if (k % every !== 0) continue;
        const a = [k * step[0] + (sMin - 1) * dir[0], k * step[1] + (sMin - 1) * dir[1]];
        const b = [k * step[0] + (sMax + 1) * dir[0], k * step[1] + (sMax + 1) * dir[1]];
        const axis = k === 0;
        line(toScreen(a), toScreen(b), color, axis ? widthAxis : 1.3, null, axis ? alphaAxis : alphaGrid);
      }
    };
    family(g1, g2, r.min1, r.max1, r.min2, r.max2, color1);
    family(g2, g1, r.min2, r.max2, r.min1, r.max1, color2);
  }

  // Zahlen entlang einer Achse (ganzzahlige Vielfache des Basisvektors)
  // prefer: Bildrichtung, auf deren Seite die Zahlen stehen (unten bzw. links)
  function drawTicks(axis, prefer, color) {
    const o = toScreen([0, 0]);
    const a = toScreen(axis);
    const spacing = Math.hypot(a[0] - o[0], a[1] - o[1]);
    if (spacing < 3) return;
    const d = [(a[0] - o[0]) / spacing, (a[1] - o[1]) / spacing];
    let n = [-d[1], d[0]];
    if (n[0] * prefer[0] + n[1] * prefer[1] < 0) n = [-n[0], -n[1]];
    const every = Math.max(1, Math.ceil((30 * fontScale()) / spacing));
    const reach = Math.min(40, Math.ceil(Math.hypot(size.w, size.h) / spacing));
    const offset = 15 * fontScale();
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = font(13, 600);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let k = -reach; k <= reach; k += 1) {
      if (k === 0 || k % every !== 0) continue;
      const x = o[0] + d[0] * spacing * k + n[0] * offset;
      const y = o[1] + d[1] * spacing * k + n[1] * offset;
      if (x < 8 || y < 8 || x > size.w - 8 || y > size.h - 8) continue;
      ctx.fillText(fmt(k, 0), x, y);
    }
    ctx.restore();
  }

  // Bereits belegte Flächen (Vektornamen, Griffe, Beschriftungen) des aktuellen Bilds
  let occupied = [];
  const reserve = (cx, cy, w, h) => occupied.push([cx - w / 2, cy - h / 2, w, h]);
  const isFree = (x, y, w, h) => occupied.every(r => x + w < r[0] || r[0] + r[2] < x || y + h < r[1] || r[1] + r[3] < y);

  // Beschriftung an der ersten freien der vorgeschlagenen Stellen
  function pill(text, candidates, color, c) {
    ctx.save();
    ctx.font = font(15, 700);
    const padX = 8 * fontScale();
    const h = 24 * fontScale();
    const w = ctx.measureText(text).width + padX * 2;
    const boxes = candidates.map(at => [
      Math.max(4, Math.min(size.w - w - 4, at[0] - w / 2)),
      Math.max(4, Math.min(size.h - h - 4, at[1] - h / 2))
    ]);
    const [x, y] = boxes.find(box => isFree(box[0], box[1], w, h)) || boxes[0];
    occupied.push([x, y, w, h]);
    ctx.fillStyle = color;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, h / 2); else ctx.rect(x, y, w, h);
    ctx.fill();
    ctx.fillStyle = c.pillText;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + w / 2, y + h / 2 + 0.5);
    ctx.restore();
  }

  // Weg «erst c₁ Schritte entlang u₁, dann c₂ Schritte entlang u₂» bis zur Spitze von v
  function drawPath(u1, u2, c1, c2, color1, color2, names, c, opts) {
    const mid = [c1 * u1[0], c1 * u1[1]];
    const o = toScreen([0, 0]);
    const m = toScreen(mid);
    const tip = toScreen(state.v);
    const alt = toScreen([c2 * u2[0], c2 * u2[1]]);
    // Ergänzung zum Parallelogramm
    line(o, alt, color2, 1.6, [5, 6], 0.55);
    line(alt, tip, color1, 1.6, [5, 6], 0.55);
    const has1 = Math.abs(c1) > 0.005;
    const has2 = Math.abs(c2) > 0.005;
    if (has1) {
      if (opts.dash) line(o, m, color1, opts.width, opts.dash, opts.alpha); else arrow(o, m, color1, opts.width, opts.alpha);
    }
    if (has2) {
      if (opts.dash) line(m, tip, color2, opts.width, opts.dash, opts.alpha); else arrow(m, tip, color2, opts.width, opts.alpha);
    }
    // Beschriftung seitlich neben dem jeweiligen Wegstück, weg vom Rest des Wegs
    const spots = (a, b, away) => {
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const l = Math.hypot(dx, dy);
      if (l < 34 * fontScale()) return null;
      let n = [-dy / l, dx / l];
      if (n[0] * (away[0] - a[0]) + n[1] * (away[1] - a[1]) > 0) n = [-n[0], -n[1]];
      const off = opts.labelOffset * fontScale();
      const at = (t, sign) => [a[0] + dx * t + n[0] * off * sign, a[1] + dy * t + n[1] * off * sign];
      return [at(0.5, 1), at(0.72, 1), at(0.3, 1), at(0.5, -1), at(0.72, -1), at(0.3, -1), at(0.88, 1)];
    };
    if (has1) {
      const list = spots(o, m, has2 ? tip : [o[0], o[1] - 1]);
      if (list) pill(`${fmt(c1)}·${names[0]}`, list, color1, c);
    }
    if (has2) {
      const list = spots(m, tip, has1 ? o : [m[0] + 1, m[1]]);
      if (list) pill(`${fmt(c2)}·${names[1]}`, list, color2, c);
    }
  }

  const labelSpot = (from, to) => {
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const l = Math.hypot(dx, dy) || 1;
    const off = 30 * fontScale();
    return [to[0] + (dx / l) * off, to[1] + (dy / l) * off];
  };

  function vectorLabel(text, from, to, color) {
    const at = labelSpot(from, to);
    ctx.save();
    ctx.font = font(21, 800);
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, at[0], at[1]);
    ctx.restore();
  }

  function handle(at, color, c, active) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(at[0], at[1], (active ? 11 : 8.5) * fontScale(), 0, Math.PI * 2);
    ctx.fillStyle = c.handle;
    ctx.fill();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.restore();
  }

  function drawScene(night) {
    const c = palette(night);
    const B = basisMatrix();
    const singular = isSingular();
    const comps = componentsB();
    const o = toScreen([0, 0]);

    const bg = ctx.createLinearGradient(0, 0, 0, size.h);
    bg.addColorStop(0, c.bg0);
    bg.addColorStop(1, c.bg1);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size.w, size.h);

    // Gitter und Achsenzahlen der gewählten Basis
    const DOWN = [0, 1];
    const LEFT = [-1, 0];
    const ref = reference();
    if (showsE()) {
      drawGrid(IDENTITY, c.ink, c.ink, night ? 0.17 : 0.15, 0.6, 2.2);
      drawTicks([1, 0], DOWN, c.e);
      drawTicks([0, 1], LEFT, c.e);
    } else if (!singular) {
      drawGrid(B, c.b1, c.b2, 0.34, 0.9, 2.6);
      drawTicks(state.b1, ref === "b1" ? DOWN : LEFT, c.b1);
      drawTicks(state.b2, ref === "b2" ? DOWN : LEFT, c.b2);
    } else {
      [[state.b1, c.b1], [state.b2, c.b2]].forEach(([b, color]) => {
        const l = len(b) || 1;
        const far = [b[0] / l * 40, b[1] / l * 40];
        line(toScreen([-far[0], -far[1]]), toScreen(far), color, 2.6, null, 0.9);
      });
    }

    // Vektornamen und Griffe freihalten, bevor die Wege beschriftet werden
    occupied = [];
    const fs = fontScale();
    const tips = [state.b1, state.b2, state.v].concat(showsE() ? [[1, 0], [0, 1]] : []);
    tips.forEach(p => {
      const s = toScreen(p);
      const at = labelSpot(o, s);
      reserve(at[0], at[1], 38 * fs, 30 * fs);
      reserve(s[0], s[1], 26 * fs, 26 * fs);
    });

    // Weg zur Spitze von v: zuerst entlang der waagrechten Referenz, dann entlang des zweiten Vektors
    const pathStyle = { width: 7, dash: null, alpha: 0.5, labelOffset: 22 };
    if (showsE()) {
      drawPath([1, 0], [0, 1], state.v[0], state.v[1], c.e, c.e, ["e₁", "e₂"], c, pathStyle);
    } else if (comps && ref === "b1") {
      drawPath(state.b1, state.b2, comps[0], comps[1], c.b1, c.b2, ["b₁", "b₂"], c, pathStyle);
    } else if (comps) {
      drawPath(state.b2, state.b1, comps[1], comps[0], c.b2, c.b1, ["b₂", "b₁"], c, pathStyle);
    }

    // Basisvektoren
    if (showsE()) {
      const e1 = toScreen([1, 0]);
      const e2 = toScreen([0, 1]);
      arrow(o, e1, c.e, 4);
      arrow(o, e2, c.e, 4);
      const coincide = (e, b) => Math.hypot(e[0] - b[0], e[1] - b[1]) < 0.2;
      if (!coincide([1, 0], state.b1) && !coincide([1, 0], state.b2)) vectorLabel("e₁", o, e1, c.e);
      if (!coincide([0, 1], state.b1) && !coincide([0, 1], state.b2)) vectorLabel("e₂", o, e2, c.e);
    }
    const s1 = toScreen(state.b1);
    const s2 = toScreen(state.b2);
    const sv = toScreen(state.v);
    arrow(o, s1, c.b1, 5);
    arrow(o, s2, c.b2, 5);
    arrow(o, sv, c.v, 5.5);

    handle(s1, c.b1, c, drag === "b1" || hover === "b1");
    handle(s2, c.b2, c, drag === "b2" || hover === "b2");
    handle(sv, c.v, c, drag === "v" || hover === "v");
    vectorLabel("b₁", o, s1, c.b1);
    vectorLabel("b₂", o, s2, c.b2);
    vectorLabel("v", o, sv, c.v);

    // Ursprung
    ctx.beginPath();
    ctx.arc(o[0], o[1], 4.5, 0, Math.PI * 2);
    ctx.fillStyle = c.ink;
    ctx.fill();

    // Hinweis, welche Basis gerade gilt
    ctx.save();
    ctx.font = font(13, 700);
    ctx.fillStyle = c.e;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const hint = showsE() ? "Standardbasis ε" : singular ? "Keine Basis" : `Basis B · waagrechte Referenz: ${ref === "b1" ? "b₁" : "b₂"}`;
    ctx.fillText(hint, 14, 12);
    ctx.restore();
  }

  function render(now = performance.now()) {
    if (panel.hidden || !root.classList.contains("applications-active")) return;
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
    if (size.w !== rect.width || size.h !== rect.height) { size = { w: rect.width, h: rect.height }; dirty = true; }
    const night = root.classList.contains("night-mode");
    if (night !== lastNight) { lastNight = night; dirty = true; }
    if (!dirty) return;
    dirty = false;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);
    drawScene(night);
    syncReadout();
  }

  // ---------- Ziehen ----------
  const pointer = event => {
    const rect = canvas.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top];
  };

  function hit(p) {
    const radius = 24 * fontScale();
    let best = null;
    let bestDistance = radius;
    ["v", "b2", "b1"].forEach(key => {
      const s = toScreen(state[key]);
      const d = Math.hypot(p[0] - s[0], p[1] - s[1]);
      if (d < bestDistance) { best = key; bestDistance = d; }
    });
    return best;
  }

  const clampPoint = p => [Math.max(-LIMIT, Math.min(LIMIT, p[0])), Math.max(-LIMIT, Math.min(LIMIT, p[1]))];

  function moveTo(key, world) {
    // Auf Hundertstel runden, damit Bild, Eingabefelder und Anzeige dieselben Zahlen zeigen.
    const p = clampPoint(world).map(n => Math.round(n * 100) / 100);
    if (key !== "v" && len(p) < MIN_LEN) return;
    state[key] = p;
    dirty = true;
  }

  canvas.addEventListener("pointerdown", event => {
    const key = hit(pointer(event));
    if (!key) return;
    drag = key;
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = "grabbing";
    dirty = true;
    event.preventDefault();
  });

  canvas.addEventListener("pointermove", event => {
    const p = pointer(event);
    if (!drag) {
      const next = hit(p);
      if (next !== hover) { hover = next; canvas.style.cursor = hover ? "grab" : "default"; dirty = true; }
      return;
    }
    moveTo(drag, toWorld(p));
  });

  function release(event) {
    if (!drag) return;
    drag = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    canvas.style.cursor = hover ? "grab" : "default";
    persist();
    dirty = true;
  }
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);
  canvas.addEventListener("pointerleave", () => { if (!drag && hover) { hover = null; canvas.style.cursor = "default"; dirty = true; } });

  // ---------- Knöpfe ----------
  els.describe.forEach(btn => btn.addEventListener("click", () => {
    state.describe = btn.dataset.basisDescribe;
    syncControls();
    dirty = true;
    persist();
  }));

  // Vektoren von Hand eintragen
  els.inputs.forEach(input => {
    const [key, index] = input.dataset.basisInput.split(".");
    input.addEventListener("input", () => {
      const value = parseNumber(input.value);
      if (value === null) { input.setAttribute("aria-invalid", "true"); return; }
      input.removeAttribute("aria-invalid");
      const next = state[key].slice();
      next[Number(index)] = Math.max(-LIMIT, Math.min(LIMIT, value));
      state[key] = next;
      dirty = true;
      persist();
    });
    input.addEventListener("blur", () => { dirty = true; syncInputs(); });
    input.addEventListener("keydown", event => { if (event.key === "Enter") input.blur(); });
  });

  els.reset.addEventListener("click", () => {
    Object.assign(state, defaults());
    syncControls();
    persist();
    dirty = true;
  });

  syncControls();
  syncReadout();
  window.LinlabBasis = { render };
})();
