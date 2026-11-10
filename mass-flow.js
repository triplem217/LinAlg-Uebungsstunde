(() => {
  "use strict";
  const root = document.getElementById("linlab-app");
  const canvas = document.getElementById("flow-canvas");
  const context = canvas.getContext("2d");
  const storageKey = "linlab-mass-flow-v1";
  const defaults = () => ({ inflow: 100, upper: 60, cross: 15, animate: true, values: true });
  const nominalAreas = [100, 75, 65, 75, 35, 65, 100];
  let state = defaults();
  const bounded = (value, low, high, fallback) => Number.isFinite(value) ? Math.min(high, Math.max(low, value)) : fallback;
  const snapToFive = value => Math.round(value / 5) * 5;
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved) {
      state.inflow = snapToFive(bounded(saved.inflow, 0, 200, 100));
      state.upper = snapToFive(bounded(saved.upper, 0, 100, 60));
      state.cross = snapToFive(bounded(saved.cross, 0, 100, 15));
      state.animate = saved.animate !== false;
      state.values = saved.values !== false;
    }
  } catch (_) { /* Keep the example usable when browser storage is unavailable. */ }

  const paths = [
    [[45, 280], [185, 280]],
    [[185, 280], [185, 100], [450, 100]],
    [[185, 280], [185, 460], [450, 460]],
    [[450, 100], [780, 100], [780, 280]],
    [[450, 100], [450, 460]],
    [[450, 460], [780, 460], [780, 280]],
    [[780, 280], [955, 280]]
  ];
  const labels = [[105, 280, "pump"], [340, 100, "above"], [320, 460, "below"], [535, 100, "above"], [450, 330, "right"], [545, 460, "below"], [875, 280, "above"]];
  const colors = ["#3877bb", "#bc713b", "#198f86", "#bc713b", "#8c68b3", "#198f86", "#3877bb"];
  const nightColors = ["#8ab5ed", "#eab07d", "#75c5bb", "#eab07d", "#bca0e5", "#75c5bb", "#8ab5ed"];
  const offsets = paths.map(() => 0);
  const lengths = paths.map(path => path.slice(1).reduce((sum, point, i) => sum + Math.hypot(point[0] - path[i][0], point[1] - path[i][1]), 0));
  let lastTime = null;
  let dirty = true;
  let lastNight = null;
  const number = value => value.toLocaleString("de-CH", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const mass = i => `<msub><mover accent="true"><mi>m</mi><mo>˙</mo></mover><mn>${i}</mn></msub>`;
  const math = content => `<math xmlns="http://www.w3.org/1998/Math/MathML">${content}</math>`;
  const equations = [
    ["∑", mass(1), mass(7)],
    ["A", mass(1), mass(2) + "<mo>+</mo>" + mass(3)],
    ["B", mass(2), mass(4) + "<mo>+</mo>" + mass(5)],
    ["C", mass(3) + "<mo>+</mo>" + mass(5), mass(6)],
    ["α", mass(2), "<mi>α</mi><mo>·</mo>" + mass(1), "given"],
    ["β", mass(5), "<mi>β</mi><mo>·</mo>" + mass(2)]
  ];
  const meters = document.getElementById("flow-meters");
  meters.innerHTML = labels.map(([x, y, placement], i) => `<div class="flow-meter" data-placement="${placement}" style="left:${x / 10}%;top:${y / 5.8}%">${math(mass(i + 1))}<output></output></div>`).join("");
  // m1 is the prescribed inlet. These six equations determine m2 through m7.
  document.getElementById("flow-equations").insertAdjacentHTML("beforeend", equations.map(([label, left, right, kind]) => `<div class="flow-equation" data-kind="${kind || "balance"}"><span>${label}</span>${math(left + "<mo>=</mo>" + right)}</div>`).join(""));

  function slider(id, label, min, max, value) {
    return `<label class="application-range" for="${id}"><div><span>${label}</span><output></output></div><input id="${id}" type="range" min="${min}" max="${max}" step="5" value="${value}"></label>`;
  }
  document.getElementById("flow-primary-controls").innerHTML =
    slider("flow-inflow", "Zufluss · " + math(mass(1)), 0, 200, state.inflow) +
    slider("flow-upper", "Ventil α · oberer Zweig", 0, 100, state.upper) +
    slider("flow-cross", "Ventil β · Querverbindung", 0, 100, state.cross);

  function flows() {
    const m1 = state.inflow;
    const m2 = m1 * state.upper / 100;
    const m3 = m1 - m2;
    const m5 = m2 * state.cross / 100;
    return [m1, m2, m3, m2 - m5, m5, m3 + m5, m1];
  }

  function sync() {
    const values = flows();
    ["inflow", "upper", "cross"].forEach(key => {
      const input = document.getElementById(`flow-${key}`);
      input.value = state[key];
      input.parentElement.querySelector("output").textContent = key === "inflow" ? `${number(state[key])} kg/s` : `${state[key]} %`;
    });
    document.getElementById("flow-animate").checked = state.animate;
    document.getElementById("flow-values").checked = state.values;
    meters.querySelectorAll("output").forEach((output, i) => {
      output.innerHTML = `${number(values[i])} <small>kg/s</small>`;
      output.hidden = !state.values;
      output.style.display = state.values ? "block" : "none";
    });
    dirty = true;
  }

  function persist() {
    try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch (_) { /* Optional persistence. */ }
  }
  document.querySelectorAll(".flow-controls input[type=range]").forEach(input => {
    input.addEventListener("input", () => {
      state[input.id.slice(5)] = Number(input.value);
      sync();
      persist();
    });
  });
  ["animate", "values"].forEach(key => document.getElementById(`flow-${key}`).addEventListener("change", event => {
    state[key] = event.target.checked;
    lastTime = null;
    sync();
    persist();
  }));
  document.getElementById("flow-reset").addEventListener("click", () => {
    state = defaults();
    offsets.fill(0);
    lastTime = null;
    sync();
    persist();
  });

  function pointAt(path, distance) {
    for (let i = 1; i < path.length; i++) {
      const [x, y] = path[i - 1];
      const dx = path[i][0] - x, dy = path[i][1] - y;
      const length = Math.hypot(dx, dy);
      if (distance <= length || i === path.length - 1) return [x + dx * distance / length, y + dy * distance / length, Math.atan2(dy, dx)];
      distance -= length;
    }
  }

  function drawEquipment(night, palette) {
    const surface = night ? "#222729" : "#fafbfb";
    const ink = night ? "#cbd4d7" : "#45575e";
    context.save();
    context.lineWidth = 2.5;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.font = "14px system-ui";
    context.textAlign = "center";
    context.textBaseline = "middle";

    context.beginPath(); context.arc(105, 280, 22, 0, Math.PI * 2);
    context.fillStyle = surface; context.fill();
    context.strokeStyle = palette[0]; context.stroke();
    context.beginPath(); context.moveTo(96, 267); context.lineTo(96, 293); context.lineTo(121, 280); context.closePath();
    context.fillStyle = palette[0]; context.fill();
    context.fillStyle = ink; context.fillText("Pumpe P", 105, 320);

    function valve(x, y, angle, color, label, fraction) {
      context.save();
      context.translate(x, y); context.rotate(angle);
      context.beginPath();
      context.moveTo(-17, -12); context.lineTo(17, 12); context.lineTo(17, -12); context.lineTo(-17, 12); context.closePath();
      context.fillStyle = surface; context.fill(); context.strokeStyle = color; context.stroke();
      context.beginPath(); context.moveTo(0, 0); context.lineTo(0, -27); context.moveTo(-10, -27); context.lineTo(10, -27); context.stroke();
      // The valve indicator follows the prescribed split; this is not a pressure-loss simulation.
      context.beginPath(); context.arc(0, 0, 4, 0, Math.PI * 2);
      context.fillStyle = fraction > 0 ? color : ink; context.fill();
      context.restore();
      context.fillStyle = ink;
      context.fillText(label, angle ? x - 23 : x, angle ? y : y - 43);
    }
    valve(255, 100, 0, palette[1], "α", state.upper);
    valve(450, 225, Math.PI / 2, palette[4], "β", state.cross);

    function cooler(x, y, color, label) {
      context.fillStyle = surface;
      context.fillRect(x - 34, y - 22, 68, 44);
      context.strokeStyle = ink;
      context.strokeRect(x - 34, y - 22, 68, 44);
      context.strokeStyle = color;
      context.beginPath(); context.moveTo(x - 34, y);
      context.lineTo(x - 23, y); context.lineTo(x - 16, y - 12);
      context.lineTo(x - 6, y + 12); context.lineTo(x + 6, y - 12);
      context.lineTo(x + 16, y + 12); context.lineTo(x + 23, y); context.lineTo(x + 34, y); context.stroke();
      context.strokeStyle = ink;
      for (const dx of [-13, 13]) {
        context.beginPath(); context.moveTo(x + dx, y - 27); context.lineTo(x + dx, y - 42);
        context.moveTo(x + dx - 3, y - 37); context.lineTo(x + dx, y - 42); context.lineTo(x + dx + 3, y - 37); context.stroke();
      }
      context.fillStyle = ink; context.fillText(label, x, y + 40);
    }
    cooler(660, 100, palette[3], "Kühler 1");
    cooler(660, 460, palette[5], "Kühler 2");
    context.restore();
  }

  function render(now = performance.now()) {
    const panel = canvas.closest("[data-application-panel]");
    if (panel.hidden || !root.classList.contains("applications-active")) { lastTime = null; return; }
    const night = root.classList.contains("night-mode");
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(rect.width * dpr), height = Math.round(rect.height * dpr);
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; dirty = true; }
    if (night !== lastNight) { lastNight = night; dirty = true; }
    const elapsed = lastTime === null ? 0 : Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
    lastTime = now;
    if (!state.animate && !dirty) return;
    dirty = false;
    const palette = night ? nightColors : colors;
    meters.querySelectorAll(".flow-meter").forEach((meter, i) => { meter.style.color = palette[i]; });
    context.setTransform(width / 1000, 0, 0, height / 580, 0, 0);
    context.clearRect(0, 0, 1000, 580);
    const values = flows();
    paths.forEach((path, i) => {
      const thickness = 5 + Math.sqrt(nominalAreas[i]) * 0.7;
      context.lineJoin = "round";
      context.lineCap = "round";
      context.beginPath();
      path.forEach(([x, y], j) => j ? context.lineTo(x, y) : context.moveTo(x, y));
      context.strokeStyle = night ? "#3d4547" : "#dfe4e6";
      context.lineWidth = thickness + 8;
      context.stroke();
      context.strokeStyle = palette[i];
      context.lineWidth = thickness;
      context.stroke();
      // Water: rho = 1000 kg/m³; areas in cm². Particle speed follows m-dot / (rho A).
      const velocity = values[i] / (0.1 * nominalAreas[i]);
      if (state.animate) offsets[i] = (offsets[i] + elapsed * velocity * 8) % 48;
      if (values[i] > 0) {
        context.fillStyle = night ? "#172023" : "#ffffff";
        for (let distance = offsets[i]; distance < lengths[i]; distance += 48) {
          const [x, y] = pointAt(path, distance);
          context.beginPath();
          context.arc(x, y, 2.6, 0, Math.PI * 2);
          context.fill();
        }
      }
      const [x, y, angle] = pointAt(path, lengths[i] * 0.72);
      context.save();
      context.translate(x, y);
      context.rotate(angle);
      context.fillStyle = night ? "#172023" : "#34424b";
      context.beginPath();
      context.moveTo(7, 0); context.lineTo(-5, -4); context.lineTo(-5, 4); context.closePath(); context.fill();
      context.restore();
    });
    drawEquipment(night, palette);
    [[185, 280], [450, 100], [450, 460], [780, 280]].forEach(([x, y], i) => {
      context.beginPath(); context.arc(x, y, 18, 0, Math.PI * 2);
      context.fillStyle = night ? "#222526" : "#ffffff";
      context.fill(); context.lineWidth = 2.5;
      context.strokeStyle = night ? "#c5ccce" : "#48555d";
      context.stroke(); context.fillStyle = night ? "#f1f3f3" : "#25333b";
      context.font = "600 18px system-ui"; context.textAlign = "center"; context.textBaseline = "middle";
      context.fillText("ABCD"[i], x, y + 1);
    });
  }

  new ResizeObserver(() => { dirty = true; render(); }).observe(canvas.parentElement);
  sync();
  window.LinlabMassFlow = { render };
})();
