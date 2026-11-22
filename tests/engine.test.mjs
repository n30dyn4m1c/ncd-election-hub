// F1: golden baseline for the Count Lab engine. Any change to a seat's
// simulated output fails this test. Recorded 2026-11-15 in the implementation
// plan (section 7) and re-run unchanged before the engine was touched.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { renderPages } from "../build.mjs";

const GOLDEN = [
  "nw C=27 winner=1 rounds=25 exhausted=253 live=1359",
  "ne C=76 winner=1 rounds=75 exhausted=924 live=703",
  "south C=8 winner=1 rounds=1 exhausted=0 live=1563",
  "reg C=29 winner=1 rounds=28 exhausted=515 live=1058",
  "mk C=6 winner=1 rounds=5 exhausted=245 live=1370",
];

export function loadEngine(html) {
  const m = html.match(/<script id="engine">([\s\S]*?)<\/script>/);
  assert.ok(m, 'no <script id="engine"> block');
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(m[1] + ";globalThis.LPV=LPV;", ctx);
  return ctx.LPV;
}

function run(LPV) {
  return ["nw", "ne", "south", "reg", "mk"].map((id) => {
    const profile = { seat: id, homeBloc: 3, homeArea: 0 };
    const opts = { ...profile, commit: LPV.commitFromProfile(profile, 0.07), fieldSize: LPV.SEATS[id].field2022, frontScale: 1 };
    const sc = LPV.buildScenario(opts);
    const eff = LPV.planEffects(sc, LPV.styleToPlan(sc, LPV.STYLES[4], 250000, {}));
    const s = LPV.simulate(sc, eff, 1000, 2000, true);
    return `${id} C=${sc.C} winner=${s.winner} rounds=${s.rounds.length} exhausted=${s.exhausted} live=${s.live}`;
  });
}

test("engine golden: source page", () => {
  const html = readFileSync(new URL("../src/count-lab/index.html", import.meta.url), "utf8");
  assert.deepEqual(run(loadEngine(html)), GOLDEN);
});

test("engine golden: built page", () => {
  const html = renderPages().get("count-lab/index.html");
  assert.deepEqual(run(loadEngine(html)), GOLDEN);
});
