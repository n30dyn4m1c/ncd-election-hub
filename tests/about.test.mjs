import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { aboutPages } from "../src/about.mjs";
import { rel, footer, TRUST_LINKS } from "../src/layout.mjs";
import { renderPages } from "../build.mjs";
import { loadData } from "../scripts/validate-data.mjs";

const data = () => structuredClone(loadData(fileURLToPath(new URL("../data", import.meta.url))));

test("trust pages: relative root prefixes", () => {
  assert.equal(rel("index.html"), "");
  assert.equal(rel("count-lab/index.html"), "../");
  assert.equal(rel("about/funding/index.html"), "../../");
});

test("trust pages: every built page's footer links all five trust pages", () => {
  for (const [path, html] of renderPages()) {
    if (!path.endsWith(".html")) continue;
    for (const [href] of TRUST_LINKS) assert.ok(html.includes(`href="${rel(path)}${href}"`), `${path} → ${href}`);
    assert.match(html, /id="themeBtn" hidden/, path);
    assert.match(html, /localStorage\.getItem\("theme"\)/, path); // applied before first paint
  }
});

test("trust pages: charter lists the six rules and the two money rules", () => {
  const html = aboutPages(data()).get("about/index.html");
  const rules = html.match(/<ol class="rules">([\s\S]*?)<\/ol>/)[1];
  assert.equal((rules.match(/<li>/g) || []).length, 6);
  assert.match(html, /No political advertising/);
  assert.match(html, /Readers never pay/);
});

test("trust pages: error reports offer email once contact_email is set", () => {
  const d = data();
  d.config.contact_email = null;
  let p = aboutPages(d);
  assert.doesNotMatch(p.get("about/corrections/index.html"), /mailto:/);
  d.config.contact_email = "errors@example.org";
  p = aboutPages(d);
  assert.match(p.get("about/corrections/index.html"), /href="mailto:errors@example\.org"/);
  assert.match(p.get("about/privacy/index.html"), /sent by email are read only/);
});

test("trust pages: empty ledger and log say so", () => {
  const pages = aboutPages(data());
  assert.match(pages.get("about/funding/index.html"), /Nothing has been recorded in this ledger yet/);
  assert.match(pages.get("about/corrections/index.html"), /No corrections have been published yet/);
});

test("trust pages: ledger renders entries newest first, escaped", () => {
  const d = data();
  d.funding = [
    { id: "a", date: "2027-01-05", payer: "Old <Co>", kind: "test", amount_kina: 1, purpose: "Test payment" },
    { id: "b", date: "2027-02-01", payer: "New Co", kind: "sponsorship", amount_kina: 2500, purpose: "Sponsor slot, February" },
  ];
  const html = aboutPages(d).get("about/funding/index.html");
  assert.ok(html.indexOf("New Co") < html.indexOf("Old &lt;Co&gt;"));
  assert.match(html, /K2,500/);
  assert.match(html, /<td data-label="Type">Sponsorship<\/td>/);
  assert.doesNotMatch(html, /Nothing has been recorded/);
});

test("trust pages: methodology shows each date's status and source", () => {
  const d = data();
  const html = aboutPages(d).get("about/methodology/index.html");
  for (const date of d.dates) assert.ok(html.includes(`<td data-label="Event">${date.label}</td>`), date.label);
  assert.equal((html.match(/<td data-label="Status">Unconfirmed<\/td>/g) || []).length, d.dates.filter((x) => x.status === "unconfirmed").length);
  for (const s of d.sources) assert.ok(html.includes(s.url.replace(/&/g, "&amp;")), s.id);
});
