// Usable rate on the eval set (50 prompts x 4 answers) every 25 RL steps, copied
// from runs/rl_20261016/{sft180,base}_masked/evals.json in the training engine.
// low/high are the middle 90% range the eval script reports for each checkpoint.
const STEPS = [0, 25, 50, 75, 100, 125, 150, 175, 200, 225, 250, 275, 300];
const SERIES = [
  {
    name: "SFT adapter",
    key: "s1",
    rate: [35.0, 43.0, 53.0, 55.5, 51.0, 58.5, 60.0, 56.5, 60.5, 61.5, 61.5, 59.0, 60.5],
    low: [27.0, 34.0, 44.5, 47.0, 42.0, 50.0, 52.0, 47.5, 52.0, 53.0, 53.5, 50.0, 51.0],
    high: [43.5, 52.5, 62.0, 64.5, 60.0, 68.0, 68.0, 65.5, 70.0, 70.0, 69.5, 68.0, 69.5],
  },
  {
    name: "Masked",
    key: "s2",
    rate: [26.0, 28.0, 34.0, 39.5, 44.0, 44.0, 35.0, 38.0, 39.0, 36.5, 40.0, 40.0, 43.0],
    low: [19.0, 20.5, 25.5, 31.0, 35.5, 34.0, 26.5, 29.0, 30.0, 28.0, 32.0, 31.5, 34.5],
    high: [33.0, 36.0, 43.0, 48.5, 53.0, 53.0, 44.0, 48.0, 47.0, 45.0, 48.0, 48.0, 51.5],
  },
];
const X_MAX = 300;
const Y_MAX = 80;
// where both runs stop improving, called out in the text
const LEVEL_OFF_STEP = 125;
const NS = "http://www.w3.org/2000/svg";

const figure = document.getElementById("rl-chart");
const plot = figure.querySelector(".chart-plot");
const tip = figure.querySelector(".chart-tooltip");

let svg = null;
let layout = null;
let active = null;
let lastWidth = 0;

const num = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
const pct = (v) => `${num(v)}%`;

function svgEl(name, attrs, parent) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  parent.appendChild(node);
  return node;
}

function text(parent, attrs, content) {
  const node = svgEl("text", attrs, parent);
  node.textContent = content;
  return node;
}

function draw() {
  const width = plot.clientWidth;
  if (!width || width === lastWidth) return;
  lastWidth = width;

  // below this width the end labels drop the series name; the legend still has it
  const narrow = width < 480;
  const height = narrow ? 240 : 290;
  const m = { top: 12, right: narrow ? 52 : 134, bottom: 44, left: 40 };
  const w = width - m.left - m.right;
  const h = height - m.top - m.bottom;
  const x = (step) => m.left + (step / X_MAX) * w;
  const y = (v) => m.top + (1 - v / Y_MAX) * h;

  if (svg) svg.remove();
  svg = document.createElementNS(NS, "svg");
  for (const [k, v] of Object.entries({ width, height, viewBox: `0 0 ${width} ${height}`, "aria-hidden": "true" })) {
    svg.setAttribute(k, v);
  }
  plot.prepend(svg);

  for (let v = 0; v <= Y_MAX; v += 20) {
    svgEl("line", { class: v === 0 ? "axis" : "grid", x1: m.left, x2: m.left + w, y1: y(v), y2: y(v) }, svg);
    text(svg, { x: m.left - 8, y: y(v), "text-anchor": "end", "dominant-baseline": "middle" }, `${v}%`);
  }
  for (let step = 0; step <= X_MAX; step += narrow ? 100 : 50) {
    text(svg, { x: x(step), y: m.top + h + 18, "text-anchor": "middle" }, String(step));
  }
  text(svg, { x: m.left + w / 2, y: height - 6, "text-anchor": "middle" }, "RL step");

  svgEl("line", { class: "marker-line", x1: x(LEVEL_OFF_STEP), x2: x(LEVEL_OFF_STEP), y1: m.top, y2: m.top + h }, svg);
  text(svg, { x: x(LEVEL_OFF_STEP) + 6, y: m.top + 10 }, "levels off");

  for (const s of SERIES) {
    const top = STEPS.map((step, i) => `${x(step)},${y(s.high[i])}`);
    const bottom = STEPS.map((step, i) => `${x(step)},${y(s.low[i])}`).reverse();
    svgEl("polygon", { class: `band ${s.key}`, points: [...top, ...bottom].join(" ") }, svg);
  }
  for (const s of SERIES) {
    const points = STEPS.map((step, i) => `${x(step)},${y(s.rate[i])}`).join(" ");
    svgEl("polyline", { class: `line ${s.key}`, points }, svg);
  }

  const last = STEPS.length - 1;
  for (const s of SERIES) {
    const cy = y(s.rate[last]);
    svgEl("circle", { class: `dot ${s.key}`, cx: x(X_MAX), cy, r: 4 }, svg);
    const label = svgEl("text", { x: x(X_MAX) + 10, y: cy, "dominant-baseline": "middle" }, svg);
    if (!narrow) {
      const name = svgEl("tspan", {}, label);
      name.textContent = `${s.name} `;
    }
    const value = svgEl("tspan", { class: "end-value" }, label);
    value.textContent = pct(s.rate[last]);
  }

  const cross = svgEl("g", { visibility: "hidden" }, svg);
  const crossLine = svgEl("line", { class: "cross-line", y1: m.top, y2: m.top + h }, cross);
  const crossDots = SERIES.map((s) => svgEl("circle", { class: `dot ${s.key}`, r: 4 }, cross));

  layout = { x, y, m, w, width, cross, crossLine, crossDots };
  if (active !== null) show(active);
}

function show(i) {
  active = i;
  const { x, y, m, width, cross, crossLine, crossDots } = layout;
  const px = x(STEPS[i]);

  cross.setAttribute("visibility", "visible");
  crossLine.setAttribute("x1", px);
  crossLine.setAttribute("x2", px);
  crossDots.forEach((dot, k) => {
    dot.setAttribute("cx", px);
    dot.setAttribute("cy", y(SERIES[k].rate[i]));
  });

  const head = document.createElement("div");
  head.className = "tip-step";
  head.textContent = `Step ${STEPS[i]}`;
  const rows = SERIES.map((s) => {
    const row = document.createElement("div");
    row.className = "tip-row";
    const key = document.createElement("span");
    key.className = `key ${s.key}`;
    const value = document.createElement("strong");
    value.textContent = pct(s.rate[i]);
    const name = document.createElement("span");
    name.textContent = s.name;
    const range = document.createElement("span");
    range.className = "tip-range";
    range.textContent = `${num(s.low[i])} to ${pct(s.high[i])}`;
    row.append(key, value, name, range);
    return row;
  });
  tip.replaceChildren(head, ...rows);
  tip.hidden = false;

  // sit to the right of the crosshair, flipping left when it would run off the plot
  const tw = tip.offsetWidth;
  let left = px + 12;
  if (left + tw > width) left = px - 12 - tw;
  tip.style.left = `${Math.max(0, left)}px`;
  tip.style.top = `${m.top}px`;
}

function hide() {
  active = null;
  if (layout) layout.cross.setAttribute("visibility", "hidden");
  tip.hidden = true;
}

function nearestStep(clientX) {
  const { m, w } = layout;
  const offset = clientX - plot.getBoundingClientRect().left - m.left;
  const i = Math.round((offset / w) * (STEPS.length - 1));
  return Math.min(STEPS.length - 1, Math.max(0, i));
}

plot.addEventListener("pointermove", (e) => layout && show(nearestStep(e.clientX)));
plot.addEventListener("pointerdown", (e) => layout && show(nearestStep(e.clientX)));
plot.addEventListener("pointerleave", () => {
  if (document.activeElement !== plot) hide();
});
plot.addEventListener("focus", () => layout && show(active ?? STEPS.length - 1));
plot.addEventListener("blur", hide);
plot.addEventListener("keydown", (e) => {
  if (!layout) return;
  const i = active ?? STEPS.length - 1;
  const moves = { ArrowLeft: i - 1, ArrowRight: i + 1, Home: 0, End: STEPS.length - 1 };
  if (e.key === "Escape") {
    hide();
  } else if (e.key in moves) {
    e.preventDefault();
    show(Math.min(STEPS.length - 1, Math.max(0, moves[e.key])));
  }
});

new ResizeObserver(draw).observe(plot);
draw();
