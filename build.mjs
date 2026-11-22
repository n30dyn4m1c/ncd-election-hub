// Builds the static site into _site/ from src/ and data/.
// Node built-ins only. Pages are HTML files with {{@token}} placeholders that
// are filled from data/; an unknown or unfilled token fails the build.
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadData } from "./scripts/validate-data.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));

export const INDEPENDENCE =
  'This site is independent. It is not the PNG Electoral Commission. For official enrolment, polling places and results, see <a href="https://pngec.gov.pg">pngec.gov.pg</a>.';

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function parts(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m: m - 1, d };
}

/** "6 May 2027"; style "daymonth" gives "26 June". */
export function formatDate(iso, style = "full") {
  const { y, m, d } = parts(iso);
  if (style === "daymonth") return `${d} ${MONTHS_LONG[m]}`;
  if (style === "full") return `${d} ${MONTHS[m]} ${y}`;
  throw new Error(`unknown date style "${style}"`);
}

/** "29 Apr – 6 May 2027", or without the year when withYear is false. */
export function formatSpan(entry, { withYear = true } = {}) {
  const a = parts(entry.start);
  if (!entry.end) return `${a.d} ${MONTHS[a.m]} ${a.y}`;
  const b = parts(entry.end);
  const left = a.y === b.y ? `${a.d} ${MONTHS[a.m]}` : `${a.d} ${MONTHS[a.m]} ${a.y}`;
  return `${left} – ${b.d} ${MONTHS[b.m]}${withYear || a.y !== b.y ? ` ${b.y}` : ""}`;
}

const dateSpans = (dates, opts, indent) =>
  dates.map((d) => `${indent}<span>${esc(d.label)}<b>${formatSpan(d, opts)}</b></span>`).join("\n");

const seatCard = (s) => {
  const tag = s.boundary_status === "pending" ? '<span class="tag">Boundaries pending</span>' : "";
  return `    <div class="card"><h3>${esc(s.name)}</h3><p>${esc(s.blurb)}</p>${tag}</div>`;
};

/** Fill {{@token}} placeholders. Throws on any token it does not know. */
export function fill(template, data, file) {
  const byId = new Map(data.dates.map((d) => [d.id, d]));
  const out = template.replace(/\{\{@([^}]*)\}\}/g, (_, token) => {
    const [name, arg, style] = token.split(":");
    switch (name) {
      case "independence":
        return `<p>${INDEPENDENCE}</p>`;
      case "dates":
        if (arg === undefined) return dateSpans(data.dates, { withYear: true }, "    ");
        if (arg === "short") return dateSpans(data.dates, { withYear: false }, "      ");
        break;
      case "seats":
        return data.seats.map(seatCard).join("\n");
      case "date": {
        const [id, field = "start"] = (arg || "").split(".");
        const entry = byId.get(id);
        if (entry && (field === "start" || field === "end") && entry[field]) return formatDate(entry[field], style);
        break;
      }
    }
    throw new Error(`${file}: unknown or unfillable token {{@${token}}}`);
  });
  return out;
}

/** Every output file as a Map of site path to contents. */
export function renderPages(root = ROOT) {
  const data = loadData(join(root, "data"));
  const read = (p) => readFileSync(join(root, "src", p), "utf8");
  const pages = new Map();
  pages.set("index.html", fill(read("home.html"), data, "src/home.html"));
  pages.set("count-lab/index.html", fill(read("count-lab/index.html"), data, "src/count-lab/index.html"));
  pages.set("assets/site.css", read("assets/site.css"));
  return pages;
}

export function buildSite(outDir = join(ROOT, "_site"), root = ROOT) {
  const pages = renderPages(root);
  rmSync(outDir, { recursive: true, force: true });
  for (const [path, body] of pages) {
    const dest = join(outDir, path);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, body);
  }
  // GitHub Pages: serve files as-is, no Jekyll.
  copyFileSync(join(root, ".nojekyll"), join(outDir, ".nojekyll"));
  return [...pages.keys()];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const files = buildSite();
  console.log(`build: OK (${files.length} files in _site/)`);
}
