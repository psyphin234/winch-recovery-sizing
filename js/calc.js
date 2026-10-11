/*
 * calc.js: pure calculations, no DOM. Every sourced number is read from
 * data.js (a rule's params); this file only holds the maths.
 * Masses and forces are in kg (kilogram-force, as winch and shackle ratings
 * are labelled); convert with kgToLb() / kgToKn() for display.
 */
(function (root) {
  "use strict";

  const D = root.WINCH_DATA;
  const LB = D.units.lbToKg;
  const G = D.units.g;
  const DEG = Math.PI / 180;

  const kgToLb = (kg) => kg / LB;
  const lbToKg = (lb) => lb * LB;
  const kgToKn = (kg) => (kg * G) / 1000;
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const num = (x, fallback) => (typeof x === "number" && isFinite(x) ? x : fallback);

  // ------------------------------------------------------------ resistance (I4WDTA)
  function ground(id) {
    return D.grounds.find((g) => g.id === id) || null;
  }

  // The ground whose factor is used: the chosen one, or for snow and rock
  // (no published factor) the published ground the user picked as nearest.
  function groundUsed(id, proxyId) {
    const g = ground(id);
    if (!g) return { chosen: null, used: null, isProxy: false };
    if (!g.proxy) return { chosen: g, used: g, isProxy: false };
    const p = ground(proxyId);
    return { chosen: g, used: p && !p.proxy ? p : null, isProxy: true };
  }

  /*
   * Total resistance = ground + gradient + wheels that can't roll, plus the
   * 25% safety margin (I4WDTA). i: { massKg, ground, proxy, bogged, gradeDeg,
   * stuckWheels, wheels }
   */
  function resistance(i) {
    const W = num(i.massKg, 0);
    const g = groundUsed(i.ground, i.proxy);
    if (!(W > 0)) return { incomplete: true, reason: "mass" };
    if (!g.used) return { incomplete: true, reason: g.chosen ? "proxy" : "ground", ground: g };

    const bog = D.rule("bogged-axles").params;
    const gcf = i.bogged ? Math.max(g.used.gcf - bog.subtract, bog.minFactor) : g.used.gcf;
    const deg = clamp(num(i.gradeDeg, 0), -89, 89);
    const wheels = Math.max(1, Math.round(num(i.wheels, 4)));
    const stuck = clamp(Math.round(num(i.stuckWheels, 0)), 0, wheels);

    const groundKg = W / gcf;
    const gradeKg = W * Math.sin(deg * DEG);
    const gradeRuleKg = (W * deg * D.rule("gradient").params.perDegreeFraction);
    const damageKg = (W * stuck) / wheels;
    const sumKg = groundKg + gradeKg + damageKg;
    const base = Math.max(sumKg, 0);
    const marginKg = base * D.rule("safety-margin").params.fraction;

    return {
      incomplete: false,
      massKg: W,
      ground: g,
      gcf,
      bogged: !!i.bogged,
      gradeDeg: deg,
      wheels,
      stuckWheels: stuck,
      groundKg,
      gradeKg,
      gradeRuleKg,
      damageKg,
      sumKg: base,
      marginKg,
      totalKg: base + marginKg,
      rollsAlone: sumKg <= 0,
      beyondMethod: Math.abs(deg) > D.rule("gradient").params.methodLimitDeg,
    };
  }

  // Rope pulling at an angle to the way the vehicle must move.
  function angled(forceKg, angleDeg) {
    const a = clamp(num(angleDeg, 0), 0, D.rule("line-angle").params.maxDeg) * DEG;
    return { ropeKg: forceKg / Math.cos(a), sideKg: forceKg * Math.tan(a) };
  }

  // ------------------------------------------------------------ rigging
  function sheaveEfficiency() {
    return 1 - D.rule("sheave-friction").params.lossPerSheave;
  }

  /*
   * parts: lengths of rope pulling on the vehicle (1 = single line, 2 = double
   * through one block at the anchor, 3 = triple, 4 = quadruple). Rope runs
   * winch -> anchor -> vehicle -> anchor ...; each length leaving a block
   * carries eta x the length going in (LEEA). forceKg is the pull needed on the
   * vehicle. redirects: angles (degrees between the two legs, 0 = rope doubles
   * back) of blocks that only change direction, between winch and system.
   */
  function rigging(forceKg, parts, redirects, eta) {
    const n = clamp(Math.round(num(parts, 1)), 1, 4);
    const e = num(eta, sheaveEfficiency());
    const reds = (redirects || []).filter((a) => typeof a === "number" && isFinite(a));
    let sumEta = 0;
    for (let k = 0; k < n; k++) sumEta += Math.pow(e, k);

    const systemKg = forceKg / sumEta; // first length of rope, after any redirects
    const winchKg = systemKg / Math.pow(e, reds.length); // at the drum
    const segments = [];
    for (let k = 0; k < n; k++) segments.push(systemKg * Math.pow(e, k));

    const points = [];
    for (let j = 1; j < n; j++) {
      points.push({
        id: "block" + j,
        kind: "block",
        at: j % 2 === 1 ? "anchor" : "vehicle",
        loadKg: segments[j - 1] + segments[j],
      });
    }
    points.push({ id: "end", kind: "end", at: n % 2 === 1 ? "anchor" : "vehicle", loadKg: segments[n - 1] });

    const redirectBlocks = reds.map((angle, i) => {
      const tin = winchKg * Math.pow(e, i);
      const tout = tin * e;
      const th = clamp(angle, 0, 180) * DEG;
      return { id: "redirect" + (i + 1), angleDeg: angle, inKg: tin, outKg: tout, loadKg: Math.sqrt(tin * tin + tout * tout + 2 * tin * tout * Math.cos(th)) };
    });

    const anchorKg = points.filter((p) => p.at === "anchor").reduce((s, p) => s + p.loadKg, 0);
    return {
      parts: n,
      eta: e,
      sumEta,
      advantage: sumEta * Math.pow(e, reds.length), // force on vehicle / rope pull at the drum
      winchKg,
      systemKg,
      segments,
      points,
      anchorKg,
      redirectBlocks,
    };
  }

  // ------------------------------------------------------------ drum and layers
  /*
   * Layer n's rope centre sits at drum radius + rope radius + (n - 1) rope
   * diameters (this reproduces WARN's ZEON 10 layer table exactly). Each layer
   * holds floor(drum length / rope diameter) wraps.
   */
  function drum(d) {
    const D0 = num(d.drumDiaMm, 0);
    const L = num(d.drumLengthMm, 0);
    const rd = num(d.ropeDiaMm, 0);
    const rope = num(d.ropeLengthM, 0);
    if (!(D0 > 0 && L > 0 && rd > 0 && rope > 0)) return null;
    const pitch = D.rule("layer-pull").params.layerPitchRopeDia * rd;
    const wraps = Math.max(1, Math.floor(L / rd));
    const layers = [];
    let cum = 0;
    for (let n = 1; cum < rope - 1e-9 && n <= 30; n++) {
      const rMm = D0 / 2 + rd / 2 + (n - 1) * pitch;
      const capM = (wraps * 2 * Math.PI * rMm) / 1000;
      layers.push({ n, rMm, capM, startM: cum, endM: cum + capM, ratio: layers.length ? layers[0].rMm / rMm : 1 });
      cum += capM;
    }
    layers.forEach((l) => (l.ratio = layers[0].rMm / l.rMm));
    return { drumDiaMm: D0, drumLengthMm: L, ropeDiaMm: rd, ropeLengthM: rope, wraps, layers, capacityM: cum };
  }

  // The layer the outermost wrap is on, with onDrumM metres of rope wound in.
  function layerAt(dr, onDrumM) {
    const s = Math.max(0, onDrumM);
    for (const l of dr.layers) if (s <= l.endM + 1e-9) return l;
    return dr.layers[dr.layers.length - 1];
  }

  // Rope length in the minimum wraps the maker says to leave on the drum.
  function minWrapsM(dr, ropeType) {
    const wraps = D.rule("min-wraps").params[ropeType === "synthetic" ? "synthetic" : "steel"];
    return { wraps, m: (wraps * 2 * Math.PI * dr.layers[0].rMm) / 1000 };
  }

  // ------------------------------------------------------------ performance chart
  // Interpolate the first-layer chart at a line pull (lb). Beyond the chart,
  // extend the last segment (flagged by the caller as over the rating).
  function chartAt(chart, pullLb) {
    const pts = chart.slice().sort((a, b) => a.pullLb - b.pullLb);
    let a = pts[0];
    let b = pts[1];
    for (let i = 1; i < pts.length; i++) {
      a = pts[i - 1];
      b = pts[i];
      if (pullLb <= b.pullLb) break;
    }
    const t = b.pullLb === a.pullLb ? 0 : (pullLb - a.pullLb) / (b.pullLb - a.pullLb);
    const amps = a.amps + t * (b.amps - a.amps);
    const speed = a.speedFtMin + t * (b.speedFtMin - a.speedFtMin);
    return { amps: Math.max(amps, 0), speedMMin: Math.max(speed, 0.05) * D.units.ftToM };
  }

  /*
   * Motor state for a rope tension on a layer. On layer n the drum's working
   * radius is r_n, so the motor sees the torque of (tension x r_n / r_1) on
   * layer 1, and the rope moves r_n / r_1 times faster. chartRatedLb is the
   * rating the chart belongs to: the chart is scaled by fraction of rating.
   */
  function motor(tensionKg, layer, ratedLb, chart, chartRatedLb) {
    const eqLb = kgToLb(tensionKg) / layer.ratio;
    const frac = eqLb / ratedLb;
    const c = chartAt(chart, frac * chartRatedLb);
    return { amps: c.amps, lineSpeedMMin: c.speedMMin / layer.ratio, fractionOfRating: frac };
  }

  // ------------------------------------------------------------ electrics
  function electrics(e, amps) {
    const cca = D.rule("cca-resistance").params;
    const rho = D.rule("cable-drop").params.ohmMm2PerM;
    const rCable = num(e.cableMm2, 0) > 0 ? (2 * num(e.cableM, 0) * rho) / e.cableMm2 : 0;
    let rBatt = null;
    if (e.type === "lead" && num(e.cca, 0) > 0) rBatt = (cca.restVolts - cca.ccaEndVolts) / e.cca;
    if (e.type === "lithium" && num(e.rIntMohm, 0) > 0) rBatt = e.rIntMohm / 1000;
    const battVolts = rBatt === null ? null : cca.restVolts - amps * rBatt;
    const cableDrop = amps * rCable;
    return {
      rCable,
      rBatt,
      cableDrop,
      battVolts,
      winchVolts: battVolts === null ? null : battVolts - cableDrop,
      netBattAmps: Math.max(0, amps - Math.max(0, num(e.altAmps, 0))),
    };
  }

  // ------------------------------------------------------------ the whole pull
  /*
   * Steps the vehicle from where it is to moveM along, winding rope onto the
   * drum (parts x distance), and tracks the layer, pull available, current,
   * speed, time and charge used. The needed rope pull is held constant (a
   * conservative choice: in reality it usually drops once the vehicle is free).
   */
  function simulate(p) {
    const dr = p.drum;
    const steps = 60;
    const move = Math.max(0, num(p.moveM, 0));
    const dx = move / steps || 0;
    const startOnDrum = dr.ropeLengthM - p.ropeOutM;
    const ratedKg = lbToKg(p.ratedLb);
    const points = [];
    let timeS = 0;
    let ah = 0;
    let failsAtM = null;
    for (let i = 0; i <= steps; i++) {
      const x = i * dx;
      const onDrum = startOnDrum + p.parts * x;
      const layer = layerAt(dr, onDrum);
      const availKg = ratedKg * layer.ratio;
      const m = motor(p.winchKg, layer, p.ratedLb, p.chart, p.chartRatedLb);
      const el = electrics(p.elec, m.amps);
      const vehicleMs = m.lineSpeedMMin / 60 / p.parts;
      if (i > 0) {
        const dt = dx / vehicleMs;
        timeS += dt;
        ah += (el.netBattAmps * dt) / 3600;
      }
      if (failsAtM === null && availKg < p.winchKg) failsAtM = x;
      points.push({ x, layer: layer.n, availKg, neededKg: p.winchKg, amps: m.amps, lineSpeedMMin: m.lineSpeedMMin, winchVolts: el.winchVolts, battVolts: el.battVolts });
    }
    const peak = points.reduce((a, b) => (b.amps > a.amps ? b : a), points[0]);
    const minMargin = points.reduce((m, pt) => Math.min(m, pt.availKg / pt.neededKg), Infinity);
    return {
      points,
      timeS,
      ah,
      peakAmps: peak.amps,
      peakPoint: peak,
      minVolts: points.reduce((m, pt) => (pt.winchVolts === null ? m : Math.min(m, pt.winchVolts)), Infinity),
      startLayer: points[0].layer,
      endLayer: points[points.length - 1].layer,
      minMargin,
      failsAtM,
    };
  }

  // ------------------------------------------------------------ sizing
  function winchSizing(massKg, neededFirstLayerKg) {
    const warnKg = massKg * D.rule("winch-size").params.factor;
    return { warnKg, neededKg: neededFirstLayerKg, recommendedKg: Math.max(warnKg, neededFirstLayerKg || 0) };
  }

  // Smallest listed shackle whose WLL covers the load, or null if none does.
  function shackleFor(loadKg) {
    const s = D.rule("shackle-ratings").params;
    const pick = s.shackles.find((x) => x.wllT * 1000 >= loadKg);
    return pick ? Object.assign({ mbsT: pick.wllT * s.designFactor }, pick) : null;
  }

  function strapRange(lighterGvmKg) {
    const p = D.rule("strap-mbs").params;
    return { minKg: lighterGvmKg * p.min, maxKg: lighterGvmKg * p.max };
  }

  /*
   * Kinetic recovery, idealised: the rope is a linear spring reaching its MBS
   * at its rated stretch, the stuck vehicle doesn't move, and all the moving
   * vehicle's energy goes into the rope. k: { massKg, speedKmh, mbsKg,
   * lengthM, stretchPct }
   */
  function kinetic(k) {
    const m = num(k.massKg, 0);
    const L = num(k.lengthM, 0);
    const s = num(k.stretchPct, 0) / 100;
    const mbsN = num(k.mbsKg, 0) * G;
    if (!(m > 0 && L > 0 && s > 0 && mbsN > 0)) return null;
    const stiff = mbsN / (L * s); // N per metre of stretch
    const at = (kmh) => {
      const v = kmh / 3.6;
      const energyJ = 0.5 * m * v * v;
      const forceN = Math.sqrt(2 * energyJ * stiff);
      return { kmh, energyJ, peakKg: forceN / G, stretchM: forceN / stiff, fractionOfMbs: forceN / mbsN };
    };
    // speed at which the idealised peak force reaches a given force
    const speedFor = (forceKg) => ((forceKg * G) / Math.sqrt(m * stiff)) * 3.6;
    return { stiffNPerM: stiff, at, speedFor, current: at(num(k.speedKmh, 0)) };
  }

  root.WINCH_CALC = {
    kgToLb,
    lbToKg,
    kgToKn,
    ground,
    groundUsed,
    resistance,
    angled,
    sheaveEfficiency,
    rigging,
    drum,
    layerAt,
    minWrapsM,
    chartAt,
    motor,
    electrics,
    simulate,
    winchSizing,
    shackleFor,
    strapRange,
    kinetic,
  };
})(window);
