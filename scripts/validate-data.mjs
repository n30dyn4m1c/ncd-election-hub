// Validates everything under data/. Prints one "<area>: OK" line per area and
// exits non-zero on any error. Import { loadData, validate } to test fixtures.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const DATE_STATUSES = ["unconfirmed", "announced", "gazetted", "changed"];
export const BOUNDARY_STATUSES = ["unchanged", "changed", "pending"];
export const SEAT_KINDS = ["open", "regional"];

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const isIso = (s) => typeof s === "string" && ISO.test(s) && !Number.isNaN(Date.parse(s + "T00:00:00Z"));
const isHttps = (s) => typeof s === "string" && /^https:\/\/[^\s]+$/.test(s);

export function loadData(dir) {
  const read = (f) => JSON.parse(readFileSync(join(dir, f), "utf8"));
  return { sources: read("sources.json"), dates: read("dates.json"), seats: read("seats.json") };
}

function checkSources(sources, err) {
  if (!Array.isArray(sources)) return err("must be an array");
  const seen = new Set();
  sources.forEach((s, i) => {
    const at = `sources[${i}]${s && s.id ? ` (${s.id})` : ""}`;
    if (!s || typeof s.id !== "string" || !s.id) return err(`${at}: missing id`);
    if (seen.has(s.id)) err(`${at}: duplicate id`);
    seen.add(s.id);
    for (const k of ["publisher", "title"]) if (typeof s[k] !== "string" || !s[k]) err(`${at}: missing ${k}`);
    if (!isHttps(s.url)) err(`${at}: url must be https`);
    if (s.archive_url !== null && !isHttps(s.archive_url)) err(`${at}: archive_url must be https or null`);
    if (s.retrieved !== null && !isIso(s.retrieved)) err(`${at}: retrieved must be YYYY-MM-DD or null`);
    if (typeof s.official !== "boolean") err(`${at}: official must be true or false`);
  });
}

function checkDates(dates, byId, err) {
  if (!Array.isArray(dates)) return err("must be an array");
  const seen = new Set();
  dates.forEach((d, i) => {
    const at = `dates[${i}]${d && d.id ? ` (${d.id})` : ""}`;
    if (!d || typeof d.id !== "string" || !d.id) return err(`${at}: missing id`);
    if (seen.has(d.id)) err(`${at}: duplicate id`);
    seen.add(d.id);
    if (typeof d.label !== "string" || !d.label) err(`${at}: missing label`);
    if (!isIso(d.start)) err(`${at}: start must be YYYY-MM-DD`);
    if (d.end !== null && !isIso(d.end)) err(`${at}: end must be YYYY-MM-DD or null`);
    if (isIso(d.start) && isIso(d.end) && d.end < d.start) err(`${at}: end is before start`);
    if (!DATE_STATUSES.includes(d.status)) err(`${at}: status must be one of ${DATE_STATUSES.join(", ")}`);
    const src = byId.get(d.source);
    if (!src) err(`${at}: source "${d.source}" does not resolve`);
    // U1 acceptance: a date is either backed by an official source or marked unconfirmed.
    else if (d.status !== "unconfirmed" && !src.official) err(`${at}: status "${d.status}" needs an official source; "${d.source}" is not`);
    if (d.status === "changed" && (!d.previous || !isIso(d.previous.start))) err(`${at}: a changed date must record previous.start`);
  });
}

function checkSeats(seats, byId, err) {
  if (!Array.isArray(seats)) return err("must be an array");
  const seen = new Set();
  seats.forEach((s, i) => {
    const at = `seats[${i}]${s && s.id ? ` (${s.id})` : ""}`;
    if (!s || typeof s.id !== "string" || !s.id) return err(`${at}: missing id`);
    if (seen.has(s.id)) err(`${at}: duplicate id`);
    seen.add(s.id);
    for (const k of ["name", "blurb"]) if (typeof s[k] !== "string" || !s[k]) err(`${at}: missing ${k}`);
    if (!SEAT_KINDS.includes(s.kind)) err(`${at}: kind must be one of ${SEAT_KINDS.join(", ")}`);
    if (!BOUNDARY_STATUSES.includes(s.boundary_status)) err(`${at}: boundary_status must be one of ${BOUNDARY_STATUSES.join(", ")}`);
    for (const k of ["enrolment", "official_candidate_count"])
      if (s[k] !== null && !(Number.isInteger(s[k]) && s[k] >= 0)) err(`${at}: ${k} must be a whole number or null`);
    if (!Array.isArray(s.sources) || !s.sources.length) err(`${at}: needs at least one source`);
    else for (const id of s.sources) if (!byId.has(id)) err(`${at}: source "${id}" does not resolve`);
  });
}

/** Returns { area: [error, ...] } for each area, in print order. */
export function validate(data) {
  const out = { sources: [], dates: [], seats: [] };
  const errFor = (area) => (msg) => out[area].push(msg);
  checkSources(data.sources, errFor("sources"));
  const byId = new Map((Array.isArray(data.sources) ? data.sources : []).filter((s) => s && s.id).map((s) => [s.id, s]));
  checkDates(data.dates, byId, errFor("dates"));
  checkSeats(data.seats, byId, errFor("seats"));
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2] || join(dirname(fileURLToPath(import.meta.url)), "..", "data");
  let failed = false;
  let result;
  try {
    result = validate(loadData(dir));
  } catch (e) {
    console.error(`data: could not load (${e.message})`);
    process.exit(1);
  }
  for (const [area, errors] of Object.entries(result)) {
    if (!errors.length) console.log(`${area}: OK`);
    else {
      failed = true;
      console.error(`${area}: ${errors.length} error(s)`);
      for (const e of errors) console.error(`  - ${e}`);
    }
  }
  process.exit(failed ? 1 : 0);
}
