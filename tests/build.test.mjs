import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { renderPages, fill, formatSpan, formatDate } from "../build.mjs";
import { loadData } from "../scripts/validate-data.mjs";

const data = loadData(fileURLToPath(new URL("../data", import.meta.url)));

test("build: date formats", () => {
  assert.equal(formatSpan({ start: "2027-04-29", end: "2027-05-06" }), "29 Apr – 6 May 2027");
  assert.equal(formatSpan({ start: "2027-04-29", end: "2027-05-06" }, { withYear: false }), "29 Apr – 6 May");
  assert.equal(formatSpan({ start: "2027-07-30", end: null }, { withYear: false }), "30 Jul 2027");
  assert.equal(formatSpan({ start: "2027-12-30", end: "2028-01-02" }, { withYear: false }), "30 Dec 2027 – 2 Jan 2028");
  assert.equal(formatDate("2027-05-06"), "6 May 2027");
  assert.equal(formatDate("2027-06-26", "daymonth"), "26 June");
});

test("build: unknown tokens fail the build", () => {
  assert.throws(() => fill("{{@nope}}", data, "t.html"), /unknown or unfillable token/);
  assert.throws(() => fill("{{@date:missing.start}}", data, "t.html"), /unfillable/);
  assert.throws(() => fill("{{@date:writs.end}}", data, "t.html"), /unfillable/); // writs has no end date
});

test("build: home and Count Lab dates come from data/dates.json", () => {
  const pages = renderPages();
  const home = pages.get("index.html");
  const lab = pages.get("count-lab/index.html");
  for (const html of [home, lab]) assert.doesNotMatch(html, /\{\{@/);
  assert.match(home, /<span>Nominations<b>29 Apr – 6 May 2027<\/b><\/span>/);
  assert.match(home, /<span>Writs return<b>30 Jul 2027<\/b><\/span>/);
  assert.match(lab, /<span>Polling<b>26 Jun – 9 Jul<\/b><\/span>/);
  assert.match(lab, /close of nominations \(6 May 2027\) to polling \(26 June\)/);
});

test("build: home lists every seat from data/seats.json", () => {
  const home = renderPages().get("index.html");
  for (const s of data.seats) assert.ok(home.includes(`<h3>${s.name}</h3>`), s.name);
  assert.equal((home.match(/Boundaries pending/g) || []).length, data.seats.filter((s) => s.boundary_status === "pending").length);
});
