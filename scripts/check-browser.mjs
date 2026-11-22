// Loads every built page in headless Chromium at 360x740 and reports, per page:
//   errs      console errors and uncaught exceptions
//   external  hosts the page made requests to (must be empty)
//   overflow  whether the page scrolls sideways
//   lang      the <html lang> value
//   indep     whether the footer carries the independence statement
//   nojs      with JavaScript off: the h1 shows and nothing scrolls sideways
//             (required for content pages; reported only for tools)
//   axe       serious or critical axe-core violations (must be none), light and dark
//   theme     the theme switch cycles Auto → Light → Dark and the choice survives a reload
// Usage: node scripts/check-browser.mjs _site
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join, extname, relative, dirname } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { INDEPENDENCE_TEXT } from "./check-site.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

const TOOL_PREFIXES = ["count-lab/", "tools/"];
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".ics": "text/calendar" };

function walk(dir, base = dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name), base) : [relative(base, join(dir, e.name)).split("\\").join("/")]);
}

function serve(dir) {
  const server = createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    let file = join(dir, p);
    if (!file.startsWith(dir)) { res.writeHead(403).end(); return; }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if (!existsSync(file)) { res.writeHead(404).end("not found"); return; }
    res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream" });
    res.end(readFileSync(file));
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok(server)));
}

async function inspect(browser, url, javaScriptEnabled) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, javaScriptEnabled });
  const page = await ctx.newPage();
  const errs = [];
  const external = new Set();
  const local = new URL(url).host;
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  page.on("pageerror", (e) => errs.push(String(e)));
  page.on("request", (r) => { const h = new URL(r.url()).host; if (h && h !== local) external.add(h); });
  await page.goto(url, { waitUntil: "load" });
  await page.waitForTimeout(javaScriptEnabled ? 600 : 0);
  // Evaluate with JS off still works: Playwright runs it in an isolated world.
  const facts = await page.evaluate((indep) => ({
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    lang: document.documentElement.lang,
    indep: !!document.querySelector("footer") && document.querySelector("footer").textContent.includes(indep),
    h1: (() => { const h = document.querySelector("h1"); if (!h) return false; const r = h.getBoundingClientRect(); return r.width > 0 && r.height > 0; })(),
  }), INDEPENDENCE_TEXT);
  let axe = [];
  if (javaScriptEnabled) {
    // Fallback fonts differ by device (Android has no condensed face), so
    // also check sideways scroll with a deliberately wide font.
    await page.addStyleTag({ content: '*{font-family:"DejaVu Sans",Verdana,sans-serif!important}' });
    await page.waitForTimeout(100);
    facts.overflow ||= await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    axe = await runAxe(page);
  }
  await ctx.close();
  return { errs, external: [...external], ...facts, axe };
}

const runAxe = async (page) => {
  await page.addScriptTag({ content: axeSource });
  const res = await page.evaluate(async () => (await window.axe.run(document, { resultTypes: ["violations"] })).violations
    .map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help })));
  return res.filter((v) => v.impact === "serious" || v.impact === "critical");
};

/** Click the theme switch through Light to Dark, reload, then run axe in dark. */
async function themeCheck(browser, url) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, colorScheme: "light" });
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: "load" });
    const btn = page.locator("#themeBtn");
    if (!(await btn.isVisible())) return { theme: "missing", axeDark: [] };
    const state = () => page.evaluate(() => [document.documentElement.dataset.theme || "auto", document.getElementById("themeBtn").textContent]);
    const seen = [await state()];
    await btn.click(); seen.push(await state());
    await btn.click(); seen.push(await state());
    await page.reload({ waitUntil: "load" });
    seen.push(await state());
    const want = [["auto", "Theme: Auto"], ["light", "Theme: Light"], ["dark", "Theme: Dark"], ["dark", "Theme: Dark"]];
    const theme = JSON.stringify(seen) === JSON.stringify(want) ? "OK" : `FAIL ${JSON.stringify(seen)}`;
    await page.waitForTimeout(300);
    return { theme, axeDark: await runAxe(page) };
  } finally {
    await ctx.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2] || join(dirname(fileURLToPath(import.meta.url)), "..", "_site");
  const pages = walk(dir).filter((f) => f.endsWith(".html"));
  const server = await serve(dir);
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch();
  let failed = false;
  try {
    for (const p of pages) {
      const path = "/" + p.replace(/(^|\/)index\.html$/, "$1");
      const tool = TOOL_PREFIXES.some((t) => p.startsWith(t));
      const on = await inspect(browser, base + p.replace(/(^|\/)index\.html$/, "$1"), true);
      const off = await inspect(browser, base + p.replace(/(^|\/)index\.html$/, "$1"), false);
      const { theme, axeDark } = await themeCheck(browser, base + p.replace(/(^|\/)index\.html$/, "$1"));
      const nojs = off.h1 && !off.overflow ? "OK" : "FAIL";
      const fmt = (list, mode) => list.map((v) => `${mode} ${v.impact} ${v.id} x${v.nodes}: ${v.help}`);
      const axe = [...fmt(on.axe, "light"), ...fmt(axeDark, "dark")];
      const report = { path, errs: on.errs, external: on.external, overflow: on.overflow, lang: on.lang, indep: on.indep, nojs, theme, axe };
      const bad = on.errs.length || on.external.length || on.overflow || !on.lang || !on.indep || axe.length || theme !== "OK" || (!tool && nojs !== "OK");
      if (bad) failed = true;
      console.log(`${bad ? "FAIL" : "OK  "} ${JSON.stringify(report)}`);
    }
  } finally {
    await browser.close();
    server.close();
  }
  process.exit(failed ? 1 : 0);
}
