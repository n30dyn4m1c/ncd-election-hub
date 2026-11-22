// Builds the static site into _site/ from src/ and data/.
// Node built-ins only. Pages are HTML files with {{@token}} placeholders that
// are filled from data/; an unknown or unfilled token fails the build.
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadData } from "./scripts/validate-data.mjs";
import { INDEPENDENCE, THEME_HEAD, footer, esc } from "./src/layout.mjs";
import { formatDate, formatSpan } from "./src/dates.mjs";
import { aboutPages } from "./src/about.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));

export { INDEPENDENCE } from "./src/layout.mjs";
export { formatDate, formatSpan } from "./src/dates.mjs";

const dateSpans = (dates, opts, indent) =>
  dates.map((d) => `${indent}<span>${esc(d.label)}<b>${formatSpan(d, opts)}</b></span>`).join("\n");

const seatCard = (s) => {
  const tag = s.boundary_status === "pending" ? '<span class="tag">Boundaries pending</span>' : "";
  return `    <div class="card"><h3>${esc(s.name)}</h3><p>${esc(s.blurb)}</p>${tag}</div>`;
};

/** Fill {{@token}} placeholders. Throws on any token it does not know. */
export function fill(template, data, file, path = "index.html") {
  const byId = new Map(data.dates.map((d) => [d.id, d]));
  const out = template.replace(/\{\{@([^}]*)\}\}/g, (_, token) => {
    const [name, arg, style] = token.split(":");
    switch (name) {
      case "independence":
        return `<p>${INDEPENDENCE}</p>`;
      case "footer":
        return footer(path);
      case "theme-head":
        return THEME_HEAD;
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
  pages.set("index.html", fill(read("home.html"), data, "src/home.html", "index.html"));
  pages.set("count-lab/index.html", fill(read("count-lab/index.html"), data, "src/count-lab/index.html", "count-lab/index.html"));
  for (const [path, html] of aboutPages(data)) pages.set(path, html);
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
