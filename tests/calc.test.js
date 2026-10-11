/*
 * Tests for data.js and calc.js. Runs in the browser via tests/index.html
 * (open it, or run tests/run.ps1 for a headless run).
 */
(function () {
  "use strict";

  const D = window.WINCH_DATA;
  const C = window.WINCH_CALC;
  const results = [];
  window.addEventListener("error", (e) => {
    document.getElementById("summary").textContent = "FAILED: script error: " + e.message;
  });

  function test(name, fn) {
    try {
      fn();
      results.push({ name, ok: true });
    } catch (e) {
      results.push({ name, ok: false, error: e.message });
    }
  }

  function eq(actual, expected, what) {
    if (actual !== expected) throw new Error(`${what || "value"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }

  function near(actual, expected, tol, what) {
    const rel = Math.abs(actual - expected) / Math.max(Math.abs(expected), 1e-9);
    if (!(rel <= tol)) throw new Error(`${what || "value"}: expected ${expected} within ${tol * 100}%, got ${actual}`);
  }

  // ------------------------------------------------------------ data integrity
  test("every rule has its fields and known sources", () => {
    const cats = ["method", "maker", "engineering", "calculation"];
    D.rules.forEach((r) => {
      ["id", "category", "title", "summary", "checked"].forEach((f) => {
        if (!r[f]) throw new Error(r.id + " missing " + f);
      });
      if (cats.indexOf(r.category) === -1) throw new Error(r.id + " has unknown category");
      if (!r.sources.length) throw new Error(r.id + " has no source");
      r.sources.forEach((s) => {
        if (!D.sources[s]) throw new Error(r.id + " cites unknown source " + s);
      });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(r.checked)) throw new Error(r.id + ".checked must be YYYY-MM-DD");
    });
  });

  test("rule ids are unique", () => {
    const ids = D.rules.map((r) => r.id);
    eq(new Set(ids).size, ids.length, "unique ids");
  });

  test("calculation rules cite the site's own physics", () => {
    D.rules.filter((r) => r.category === "calculation").forEach((r) => {
      if (r.sources.indexOf("physics") === -1) throw new Error(r.id + " is a calculation but doesn't cite physics");
    });
  });

  test("rock has no factor and has a gap entry; snow isn't offered", () => {
    eq(C.ground("rock").gcf, null, "rock factor");
    if (!D.gaps.find((g) => g.id === "rock")) throw new Error("no gap entry for rock");
    eq(C.ground("snow"), null, "snow not offered");
  });

  test("the short ground list uses I4WDTA's own factors", () => {
    const want = { road: 25, grass: 7, gravel: 5, sand: 4, mud: 3, clay: 2 };
    Object.keys(want).forEach((id) => eq(C.ground(id).gcf, want[id], id));
    // bogged to the axles in mud = I4WDTA's deep mud factor
    eq(C.resistance({ massKg: 3000, ground: "mud", bog: "axles" }).gcf, 2, "mud to the axles");
  });

  test("scenarios use known grounds and give a result", () => {
    D.scenarios.forEach((s) => {
      if (!C.ground(s.values.ground)) throw new Error(s.id + " unknown ground");
      const r = C.resistance(s.values);
      if (r.incomplete) throw new Error(s.id + " gives no result");
    });
  });

  // ------------------------------------------------------------ resistance
  test("I4WDTA worked example parts: 3 500 lb Jeep, soft clay, 15°", () => {
    const W = C.lbToKg(3500);
    const r = C.resistance({ massKg: W, ground: "clay", gradeDeg: 15 });
    near(C.kgToLb(r.groundKg), 1750, 1e-9, "ground");
    near(C.kgToLb(r.gradeRuleKg), 875, 1e-9, "gradient by the 1/60 rule");
    near(C.kgToLb(r.gradeKg), 875, 0.04, "gradient by sin()");
    // their example adds one damaged wheel (875 lb) for 4 375 lb in all
    near(C.kgToLb((r.sumKg + W / 4) * 1.25), 4375, 0.01, "total with a damaged wheel and 25% margin");
  });

  test("bogged to the axles subtracts 1 from the factor, never below 1", () => {
    eq(C.resistance({ massKg: 3000, ground: "sand", bog: "axles" }).gcf, 3, "sand bogged");
    eq(C.resistance({ massKg: 3000, ground: "clay", bog: "axles" }).gcf, 1, "clay bogged");
    near(C.resistance({ massKg: 3000, ground: "clay", bog: "axles" }).groundKg, 3000, 1e-9, "clay bogged = full weight");
  });

  test("bogged to the chassis: no wheel rolls, so the full weight is added", () => {
    const r = C.resistance({ massKg: 3000, ground: "clay", bog: "chassis" });
    near(r.groundKg, 1500, 1e-9, "ground");
    near(r.bogKg, 3000, 1e-9, "bogging");
    near(r.totalKg, 4500 * 1.25, 1e-9, "total");
  });

  test("deeper is always harder: none < axles < chassis", () => {
    D.grounds.filter((g) => g.gcf).forEach((g) => {
      const t = (bog) => C.resistance({ massKg: 3000, ground: g.id, bog }).totalKg;
      if (!(t("none") < t("axles") && t("axles") < t("chassis"))) throw new Error(g.id);
    });
  });

  test("downhill gravity helps; a vehicle that rolls alone needs no pull", () => {
    const r = C.resistance({ massKg: 3000, ground: "road", gradeDeg: -10 });
    eq(r.rollsAlone, true, "rolls alone");
    eq(r.totalKg, 0, "total");
  });

  test("rock needs a nearest ground before it gives a figure", () => {
    eq(C.resistance({ massKg: 3000, ground: "rock" }).incomplete, true, "no proxy");
    const r = C.resistance({ massKg: 3000, ground: "rock", proxy: "gravel" });
    eq(r.gcf, 5, "uses gravel's factor");
    eq(r.ground.isProxy, true, "flagged as the user's choice");
  });

  test("rope at an angle pulls resistance / cos, and sideways resistance x tan", () => {
    near(C.angled(1000, 0).ropeKg, 1000, 1e-12, "straight");
    near(C.angled(1000, 20).ropeKg, 1000 / Math.cos((20 * Math.PI) / 180), 1e-12, "20°");
    near(C.angled(1000, 45).sideKg, 1000, 1e-9, "45° sideways = resistance");
    near(C.angled(1000, 80).angleDeg, 45, 1e-12, "capped at the slider's 45°");
  });

  // ------------------------------------------------------------ rigging
  test("double line: winch pulls F / (1 + 0.92), anchor and block take F", () => {
    const g = C.rigging(4000, 2, [], 0.92);
    near(g.winchKg, 4000 / 1.92, 1e-9, "winch");
    near(g.anchorKg, 4000, 1e-9, "anchor");
    eq(g.points[0].at, "anchor", "block at anchor");
    near(g.points[0].loadKg, 4000, 1e-9, "block load");
    eq(g.points[1].at, "vehicle", "rope end back on the vehicle");
  });

  test("anchor always takes the full force, whatever the number of lines", () => {
    [1, 2, 3, 4].forEach((n) => near(C.rigging(5000, n, [], 0.92).anchorKg, 5000, 1e-9, n + " lines"));
  });

  test("triple line without friction is exactly a third", () => {
    near(C.rigging(3000, 3, [], 1).winchKg, 1000, 1e-9);
  });

  test("redirect block load: 2x side by side, 1.41x at 90°, 1x at 120° (no friction)", () => {
    near(C.rigging(1000, 1, [0], 1).redirectBlocks[0].loadKg, 2000, 1e-9, "0°");
    near(C.rigging(1000, 1, [90], 1).redirectBlocks[0].loadKg, 1000 * Math.SQRT2, 1e-9, "90°");
    near(C.rigging(1000, 1, [120], 1).redirectBlocks[0].loadKg, 1000, 1e-9, "120°");
  });

  test("default sheave efficiency is LEEA's 8% loss", () => near(C.sheaveEfficiency(), 0.92, 1e-12));

  // ------------------------------------------------------------ drum
  test("layer model reproduces WARN's ZEON 10 pull-by-layer table", () => {
    const z = D.zeon10;
    const dr = C.drum({ drumDiaMm: z.drumDiaMm, drumLengthMm: z.drumLengthMm, ropeDiaMm: z.ropeDiaMm, ropeLengthM: 40 });
    z.layersLb.forEach((lb, i) => near(z.ratedLb * dr.layers[i].ratio, lb, 0.005, "layer " + (i + 1)));
  });

  test("layerAt finds the outer layer", () => {
    const dr = C.drum({ drumDiaMm: 80, drumLengthMm: 229, ropeDiaMm: 9.52, ropeLengthM: 24.38 });
    eq(C.layerAt(dr, 0).n, 1, "empty drum");
    eq(C.layerAt(dr, dr.layers[0].capM + 0.1).n, 2, "just into layer 2");
    eq(C.layerAt(dr, dr.ropeLengthM).n, dr.layers.length, "full drum");
  });

  test("minimum wraps: 5 steel, 10 synthetic (WARN)", () => {
    const dr = C.drum({ drumDiaMm: 80, drumLengthMm: 229, ropeDiaMm: 9.52, ropeLengthM: 24.38 });
    eq(C.minWrapsM(dr, "steel").wraps, 5);
    eq(C.minWrapsM(dr, "synthetic").wraps, 10);
  });

  // ------------------------------------------------------------ motor and electrics
  test("chart interpolation hits the published points", () => {
    const ch = D.zeon10.chart;
    near(C.chartAt(ch, 0).amps, 62, 1e-9);
    near(C.chartAt(ch, 10000).amps, 409, 1e-9);
    near(C.chartAt(ch, 5000).amps, (215 + 280) / 2, 1e-9);
  });

  test("same rope pull on a higher layer draws more current and runs faster", () => {
    const dr = C.drum({ drumDiaMm: 80, drumLengthMm: 229, ropeDiaMm: 9.52, ropeLengthM: 40 });
    const a = C.motor(2000, dr.layers[0], 10000, D.zeon10.chart, 10000);
    const b = C.motor(2000, dr.layers[2], 10000, D.zeon10.chart, 10000);
    if (!(b.amps > a.amps)) throw new Error("amps should rise");
    near(b.lineSpeedMMin / C.chartAt(D.zeon10.chart, C.kgToLb(2000) / dr.layers[2].ratio).speedMMin, 1 / dr.layers[2].ratio, 1e-9, "speed scales with radius");
  });

  // ------------------------------------------------------------ sizing and gear
  test("WARN sizing: 1.5 x GVM", () => near(C.winchSizing(3000, 0).warnKg, 4500, 1e-12));

  test("shackle picks the smallest Crosby size whose WLL covers the load", () => {
    eq(C.shackleFor(3250).size, '5/8"');
    eq(C.shackleFor(4000).size, '3/4"');
    eq(C.shackleFor(4000).mbsT, 28.5, "MBS 6 x WLL");
    eq(C.shackleFor(9000), null, "beyond the table");
  });

  // ------------------------------------------------------------ winch rating as typed
  test("winch ratings read the way people write them", () => {
    const lb = (t) => Math.round(C.parseRating(t).lb);
    const kg = (t) => Math.round(C.parseRating(t).kg);
    eq(lb("EW9500"), 9500, "EW9500");
    eq(lb("Zeon 10-S"), 10000, "Zeon 10-S");
    eq(lb("Runva 11XP"), 11000, "11XP");
    eq(lb("12000"), 12000, "bare 12000");
    eq(lb("12 000 lb"), 12000, "spaced thousands with lb");
    eq(lb("9.5k"), 9500, "9.5k");
    eq(kg("4.5 t"), 4500, "4.5 t");
    eq(kg("4.T"), 4000, "4.T");
    eq(kg("4.5T"), 4500, "4.5T");
    eq(kg("5443 kg"), 5443, "kg");
    eq(kg("4.5"), 4500, "bare 4.5 = tonnes");
    eq(kg("EW9500 4.T"), 4000, "a unit wins");
    eq(C.parseRating("").ok, false, "empty");
    eq(C.parseRating("big one").ok, false, "no number");
    eq(C.parseRating("450").ok, false, "unclear without a unit");
  });

  // ------------------------------------------------------------ the whole pull
  test("simulated pull: layers fill as rope winds in, time and charge add up", () => {
    const dr = C.drum({ drumDiaMm: 80, drumLengthMm: 229, ropeDiaMm: 9.52, ropeLengthM: 24.38 });
    const s = C.simulate({
      drum: dr, ropeOutM: 20, moveM: 15, parts: 1, winchKg: 1500, ratedLb: 10000,
      chart: D.zeon10.chart, chartRatedLb: 10000,
    });
    eq(s.startLayer, 1, "start layer");
    if (!(s.endLayer > s.startLayer)) throw new Error("should end on a higher layer");
    if (!(s.timeS > 0 && s.ah > 0)) throw new Error("time and amp-hours should be positive");
    eq(s.failsAtM, null, "1.5 t is within a 10 000 lb winch all the way");
  });

  // ------------------------------------------------------------ report
  const failed = results.filter((r) => !r.ok);
  const list = document.getElementById("results");
  results.forEach((r) => {
    const li = document.createElement("li");
    li.className = r.ok ? "ok" : "bad";
    li.textContent = (r.ok ? "PASS  " : "FAIL  ") + r.name + (r.ok ? "" : "  -> " + r.error);
    list.appendChild(li);
  });
  document.getElementById("summary").textContent = failed.length
    ? `FAILED: ${failed.length} of ${results.length} tests`
    : `ALL PASSED: ${results.length} tests`;
})();
