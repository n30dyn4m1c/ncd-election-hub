import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { loadData, validate } from "../scripts/validate-data.mjs";

const DATA = fileURLToPath(new URL("../data", import.meta.url));
const fresh = () => structuredClone(loadData(DATA));
const errors = (data) => Object.values(validate(data)).flat();

test("data validation: repository data is clean", () => {
  assert.deepEqual(validate(fresh()), { sources: [], dates: [], seats: [], funding: [], corrections: [], config: [] });
});

test("data validation: a gazetted date needs an official source", () => {
  const d = fresh();
  d.dates[0].status = "gazetted"; // its source is a newspaper
  assert.match(errors(d).join("\n"), /needs an official source/);
});

test("data validation: an unconfirmed date may rest on an unofficial source", () => {
  const d = fresh();
  d.dates[0].status = "unconfirmed";
  assert.deepEqual(errors(d), []);
});

test("data validation: source ids must resolve", () => {
  const d = fresh();
  d.dates[1].source = "nope";
  d.seats[0].sources = ["missing"];
  const e = errors(d).join("\n");
  assert.match(e, /source "nope" does not resolve/);
  assert.match(e, /source "missing" does not resolve/);
});

test("data validation: a changed date must keep its previous value", () => {
  const d = fresh();
  d.sources.find((s) => s.id === d.dates[2].source).official = true;
  d.dates[2].status = "changed";
  assert.match(errors(d).join("\n"), /previous\.start/);
  d.dates[2].previous = { start: "2027-07-23", end: null };
  assert.deepEqual(errors(d), []);
});

test("data validation: bad shapes are reported, not thrown", () => {
  const d = fresh();
  d.dates[0].end = "2027-04-01"; // before start
  d.sources[0].url = "http://insecure.example";
  d.sources.push({ ...d.sources[1] }); // duplicate id
  d.seats[0].kind = "senate";
  const e = errors(d).join("\n");
  for (const re of [/end is before start/, /url must be https/, /duplicate id/, /kind must be one of/]) assert.match(e, re);
});

test("data validation: funding and corrections entries are checked", () => {
  const d = fresh();
  d.funding = [
    { id: "t1", date: "2027-01-10", payer: "Test", kind: "test", amount_kina: 1, purpose: "Test payment" },
    { id: "t1", date: "soon", payer: "", kind: "donation", amount_kina: -5, purpose: "x" },
  ];
  d.corrections = [{ id: "c1", date: "2027-01-11", page: "https://example.com", page_title: "Home", was: "a", now: "b" }];
  const e = validate(d);
  for (const re of [/duplicate id/, /date must be/, /missing payer/, /kind must be one of/, /amount_kina/]) assert.match(e.funding.join("\n"), re);
  assert.match(e.corrections.join("\n"), /page must be a site path/);
});

test("data validation: contact_email is an address or null", () => {
  const d = fresh();
  d.config.contact_email = "not an email";
  assert.match(validate(d).config.join(), /contact_email/);
  d.config.contact_email = "errors@example.org";
  assert.deepEqual(validate(d).config, []);
});
