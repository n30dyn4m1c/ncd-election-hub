import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkSite } from "../scripts/check-site.mjs";
import { buildSite, INDEPENDENCE } from "../build.mjs";

const page = ({ lang = "en", h1 = "<h1>T</h1>", footer = `<footer><p>${INDEPENDENCE}</p></footer>`, head = "", body = "" } = {}) =>
  `<!doctype html><html lang="${lang}"><head><title>T</title><meta name="description" content="D">${head}</head><body>${h1}${body}${footer}</body></html>`;

function site(files) {
  const dir = mkdtempSync(join(tmpdir(), "check-site-"));
  for (const [p, body] of Object.entries(files)) {
    mkdirSync(join(dir, p, ".."), { recursive: true });
    writeFileSync(join(dir, p), body);
  }
  return dir;
}

const errors = (dir) => {
  try { return Object.values(checkSite(dir)).flat().join("\n"); } finally { rmSync(dir, { recursive: true, force: true }); }
};

test("check-site: the built site passes", () => {
  const dir = mkdtempSync(join(tmpdir(), "built-"));
  buildSite(dir);
  assert.equal(errors(dir), "");
});

test("check-site: a clean fixture passes", () => {
  assert.equal(errors(site({ "index.html": page({ body: '<a href="a/">a</a> <a href="https://example.com/x">src</a>' }), "a/index.html": page() })), "");
});

test("check-site: flags structural problems", () => {
  const e = errors(site({ "index.html": page({ lang: "", h1: "<h1>a</h1><h1>b</h1>", footer: "<footer>hi</footer>" }) }));
  for (const re of [/no lang/, /2 <h1>/, /independence statement/, /pngec\.gov\.pg link/]) assert.match(e, re);
});

test("check-site: flags broken internal links", () => {
  assert.match(errors(site({ "index.html": page({ body: '<a href="missing/">x</a>' }) })), /broken internal link "missing\/"/);
});

test("check-site: flags third-party resources but not source links", () => {
  const e = errors(site({
    "index.html": page({
      head: '<link rel="preconnect" href="https://fonts.gstatic.com"><script src="https://cdn.example/x.js"></script>',
      body: '<a href="https://fonts.google.com">a link is fine</a>',
    }),
  }));
  assert.match(e, /fonts\.gstatic\.com/);
  assert.match(e, /cdn\.example/);
  assert.doesNotMatch(e, /fonts\.google\.com/);
});

test("check-site: enforces the content gzip budget", () => {
  const noise = Array.from({ length: 60000 }, (_, i) => ((i * 2654435761) >>> 0).toString(36)).join(" ");
  assert.match(errors(site({ "index.html": page({ body: `<p>${noise}</p>` }) })), /over the content budget/);
});
