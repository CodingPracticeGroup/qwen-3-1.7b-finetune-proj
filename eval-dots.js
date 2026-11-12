// Every answer in the eval set (50 prompts x 4 answers) for three setups, one dot
// each. Hovering, tapping or arrowing onto a dot shows that answer. The answers in
// eval-answers.json come from runs/short_eval_20261016/base_1.7b_instruction_only,
// runs/short_eval_20261016/base_1.7b_masked and
// runs/rl_20261016/sft180_masked/eval/step_0300 in the training repo, sorted so
// the usable ones come first.
import { markE } from "./mark-e.js";

const COLS = 20;
const ROWS = 10;
// viewBox units per dot; the grid scales with its column
const PITCH = 12;
const NS = "http://www.w3.org/2000/svg";

const figure = document.getElementById("eval-dots");
const host = figure.querySelector(".dots-grids");
const tip = figure.querySelector(".dots-tip");
const runs = await fetch(new URL("./eval-answers.json", import.meta.url)).then((r) => r.json());

const grids = [...figure.querySelectorAll(".dots-grid")].map((grid) => {
  const svg = grid.querySelector("svg");
  const answers = runs[grid.dataset.run];
  answers.forEach((answer, i) => {
    const dot = document.createElementNS(NS, "circle");
    dot.setAttribute("class", `dot-${answer.c}`);
    dot.setAttribute("cx", (i % COLS) * PITCH + PITCH / 2);
    dot.setAttribute("cy", Math.floor(i / COLS) * PITCH + PITCH / 2);
    dot.setAttribute("r", answer.c === "judge" ? 3.7 : 4.3);
    svg.append(dot);
  });
  const ring = document.createElementNS(NS, "circle");
  ring.setAttribute("class", "dot-ring");
  ring.setAttribute("r", 6.4);
  ring.setAttribute("visibility", "hidden");
  svg.append(ring);
  return { grid, svg, answers, ring, active: null };
});

function status(answer) {
  if (answer.c === "e") return `Contains ${answer.n} ‘e’${answer.n === 1 ? "" : "s"}`;
  const [coherence, responds] = answer.s;
  return `${answer.c === "ok" ? "Usable" : "Not usable"}: coherence ${coherence}, responds ${responds}`;
}

function paragraph(className, content) {
  const p = document.createElement("p");
  p.className = className;
  p.textContent = content;
  return p;
}

function show(g, i) {
  hide();
  g.active = i;
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  g.ring.setAttribute("cx", col * PITCH + PITCH / 2);
  g.ring.setAttribute("cy", row * PITCH + PITCH / 2);
  g.ring.setAttribute("visibility", "visible");

  const answer = g.answers[i];
  const text = paragraph("dots-answer", `“${answer.a}”`);
  if (answer.c === "e") markE(text);
  tip.replaceChildren(paragraph("dots-status", status(answer)), paragraph("dots-prompt", answer.p), text);
  tip.hidden = false;

  // below the dot, flipping to its left when it would run off the figure
  const box = g.svg.getBoundingClientRect();
  const scale = box.width / (COLS * PITCH);
  const origin = host.getBoundingClientRect();
  const x = box.left - origin.left + (col + 0.5) * PITCH * scale;
  const y = box.top - origin.top + (row + 1) * PITCH * scale;
  let left = x + 8;
  if (left + tip.offsetWidth > origin.width) left = x - 8 - tip.offsetWidth;
  tip.style.left = `${Math.max(0, left)}px`;
  tip.style.top = `${y + 4}px`;
}

function hide() {
  for (const g of grids) g.ring.setAttribute("visibility", "hidden");
  tip.hidden = true;
}

function dotAt(g, event) {
  const box = g.svg.getBoundingClientRect();
  const size = box.width / COLS;
  const col = Math.floor((event.clientX - box.left) / size);
  const row = Math.floor((event.clientY - box.top) / size);
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return null;
  return row * COLS + col;
}

for (const g of grids) {
  const point = (event) => {
    const i = dotAt(g, event);
    if (i === null) hide();
    else show(g, i);
  };
  g.svg.addEventListener("pointermove", point);
  g.svg.addEventListener("pointerdown", point);
  g.svg.addEventListener("pointerleave", (event) => {
    if (event.pointerType === "mouse" && document.activeElement !== g.svg) hide();
  });
  g.svg.addEventListener("focus", () => show(g, g.active ?? 0));
  g.svg.addEventListener("blur", hide);
  g.svg.addEventListener("keydown", (event) => {
    const i = g.active ?? 0;
    const moves = {
      ArrowLeft: i - 1,
      ArrowRight: i + 1,
      ArrowUp: i - COLS,
      ArrowDown: i + COLS,
      Home: 0,
      End: COLS * ROWS - 1,
    };
    if (event.key === "Escape") {
      hide();
    } else if (event.key in moves) {
      event.preventDefault();
      show(g, Math.min(COLS * ROWS - 1, Math.max(0, moves[event.key])));
    }
  });
}

// a tap anywhere else puts the answer away
document.addEventListener("pointerdown", (event) => {
  if (!grids.some((g) => g.svg.contains(event.target))) hide();
});
