/*
 * app.js: wires the form to calc.js and renders the results.
 * Modes: Simple (default, no hash) and Advanced (#advanced). #example loads a
 * scenario in Advanced. Elements with data-modes="advanced" show only there;
 * inputs are shared, so values carry across modes. In Simple, advanced-only
 * inputs are ignored (treated as 0 / off), never silently used.
 * Inputs are kept in this browser's localStorage only.
 */
(function () {
  "use strict";

  const D = window.WINCH_DATA;
  const C = window.WINCH_CALC;
  const U = window.WINCH_UI;
  const V = window.WINCH_DIAGRAMS;
  const { el } = U;

  const form = document.getElementById("winch-form");
  const STORE = "winch-calc-v1";
  const WINCH_SIZES_LB = [8000, 9500, 10000, 12000, 15000, 17500];
  let mode = "simple";

  // ------------------------------------------------------------ set-up
  function fillSelect(select, items, value) {
    select.replaceChildren(...items.map((it) => el("option", { value: it.value }, it.label)));
    if (value !== undefined) select.value = value;
  }

  function setWinchDefaults() {
    const z = D.zeon10;
    form.ratedLb.value = z.ratedLb;
    form.ropeDiaMm.value = z.ropeDiaMm;
    form.ropeLengthM.value = z.ropeLengthM;
    form.drumDiaMm.value = z.drumDiaMm;
    form.drumLengthMm.value = z.drumLengthMm;
    form.querySelector('input[name="ropeType"][value="steel"]').checked = true;
    setChart(z.chart);
  }

  function setChart(chart) {
    const body = document.getElementById("chart-rows");
    body.replaceChildren(
      ...chart.map((p, i) =>
        el(
          "tr",
          null,
          el("td", null, el("input", { type: "number", inputmode: "numeric", min: "0", step: "100", value: p.pullLb, "data-chart": "pullLb", "data-row": i, "aria-label": "Row " + (i + 1) + " line pull, lb" })),
          el("td", null, el("input", { type: "number", inputmode: "decimal", min: "0", step: "0.1", value: +(p.speedFtMin * D.units.ftToM).toFixed(2), "data-chart": "speed", "data-row": i, "aria-label": "Row " + (i + 1) + " line speed, m/min" })),
          el("td", null, el("input", { type: "number", inputmode: "numeric", min: "0", step: "1", value: p.amps, "data-chart": "amps", "data-row": i, "aria-label": "Row " + (i + 1) + " current, A" }))
        )
      )
    );
  }

  function readChart() {
    const rows = [];
    document.querySelectorAll("#chart-rows tr").forEach((tr) => {
      const v = (k) => parseFloat(tr.querySelector(`[data-chart="${k}"]`).value);
      const pullLb = v("pullLb");
      const speed = v("speed");
      const amps = v("amps");
      if (isFinite(pullLb) && isFinite(speed) && isFinite(amps)) rows.push({ pullLb, speedFtMin: speed / D.units.ftToM, amps });
    });
    return rows;
  }

  function chartIsDefault(chart) {
    const z = D.zeon10.chart;
    return chart.length === z.length && chart.every((p, i) => p.pullLb === z[i].pullLb && Math.abs(p.speedFtMin - z[i].speedFtMin) < 0.05 && p.amps === z[i].amps);
  }

  function init() {
    fillSelect(form.ground, [{ value: "", label: "Choose…" }].concat(D.grounds.map((g) => ({ value: g.id, label: g.label + (g.gcf ? "" : " (no published factor)") }))), "");
    fillSelect(form.proxy, [{ value: "", label: "Choose the nearest…" }].concat(D.grounds.filter((g) => !g.proxy).map((g) => ({ value: g.id, label: g.label }))), "");
    fillSelect(form.cableSize, D.cables.map((c) => ({ value: c.id, label: c.label })), "2awg");
    fillSelect(document.getElementById("scenario"), [{ value: "", label: "Choose one to fill the form…" }].concat(D.scenarios.map((s) => ({ value: s.id, label: s.label }))), "");
    setWinchDefaults();
    renderExplainers();
    restore();

    document.getElementById("year").textContent = new Date().getFullYear();
    document.querySelectorAll(".mode-button").forEach((b) => b.addEventListener("click", () => {
      history.replaceState(null, "", b.dataset.mode === "advanced" ? "#advanced" : location.pathname + location.search);
      setMode(b.dataset.mode);
    }));
    window.addEventListener("hashchange", fromHash);
    form.addEventListener("input", onChange);
    form.addEventListener("change", onChange);
    document.getElementById("scenario").addEventListener("change", (e) => {
      if (e.target.value) loadScenario(e.target.value);
    });
    document.getElementById("chart-reset").addEventListener("click", () => {
      setChart(D.zeon10.chart);
      onChange();
    });
    document.getElementById("reset-form").addEventListener("click", () => {
      form.reset();
      setWinchDefaults();
      document.getElementById("scenario").value = "";
      try {
        localStorage.removeItem(STORE);
      } catch (e) { /* storage blocked: nothing to clear */ }
      onChange();
    });
    document.querySelectorAll("[data-print]").forEach((b) => b.addEventListener("click", () => window.print()));
    let lastWidth = 0;
    let resizeTimer = null;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const w = document.getElementById("block-body").clientWidth;
        if (w !== lastWidth) {
          lastWidth = w;
          render();
        }
      }, 150);
    });
    fromHash();
  }

  function fromHash() {
    if (location.hash === "#example") {
      loadScenario("mud-axles");
      history.replaceState(null, "", "#advanced");
      setMode("advanced");
      return;
    }
    setMode(location.hash === "#advanced" ? "advanced" : "simple");
  }

  function setMode(m) {
    mode = m;
    document.querySelectorAll(".mode-button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === m)));
    document.querySelectorAll("[data-modes]").forEach((n) => (n.hidden = n.dataset.modes.split(" ").indexOf(m) === -1));
    if (m === "simple") {
      const p = form.querySelector('input[name="parts"]:checked');
      if (p && +p.value > 2) form.querySelector('input[name="parts"][value="2"]').checked = true;
    }
    document.getElementById("mode-hint").textContent = m === "simple"
      ? "Your vehicle, the ground, the slope and whether you use a snatch block. Advanced adds your winch's drum and rope, the battery, triple lines, angles and kinetic recoveries."
      : "Everything in Simple, plus your winch's drum, rope and performance chart, the battery and wiring, more rigging and a kinetic recovery.";
    render();
  }

  function loadScenario(id) {
    const s = D.scenarios.find((x) => x.id === id);
    if (!s) return;
    const v = s.values;
    form.massKg.value = v.massKg;
    form.ground.value = v.ground;
    form.proxy.value = v.proxy || "";
    form.bogged.checked = !!v.bogged;
    form.gradeDeg.value = Math.abs(v.gradeDeg);
    form.querySelector(`input[name="slopeDir"][value="${v.gradeDeg < 0 ? "down" : "up"}"]`).checked = true;
    form.stuckWheels.value = String(v.stuckWheels || 0);
    form.querySelector(`input[name="parts"][value="${v.parts}"]`).checked = true;
    form.anchorM.value = v.anchorM;
    form.moveM.value = v.moveM;
    document.getElementById("scenario").value = id;
    // Simple ignores triple lines and stuck wheels, so a scenario that uses them opens in Advanced.
    if ((v.parts > 2 || v.stuckWheels > 0) && mode === "simple") {
      history.replaceState(null, "", "#advanced");
      setMode("advanced");
    }
    onChange();
  }

  // ------------------------------------------------------------ read, save, restore
  const num = (name) => {
    const v = parseFloat(form[name].value);
    return isFinite(v) ? v : null;
  };
  const radio = (name) => (form.querySelector(`input[name="${name}"]:checked`) || {}).value;

  function read() {
    const adv = mode === "advanced";
    const chart = readChart();
    const custom = !chartIsDefault(chart);
    const cable = D.cables.find((c) => c.id === form.cableSize.value);
    return {
      massKg: num("massKg"),
      ground: form.ground.value,
      proxy: form.proxy.value,
      bogged: form.bogged.checked,
      gradeDeg: (num("gradeDeg") || 0) * (radio("slopeDir") === "down" ? -1 : 1),
      stuckWheels: adv ? +form.stuckWheels.value : 0,
      parts: Math.min(+radio("parts") || 1, adv ? 4 : 2),
      anchorM: num("anchorM"),
      moveM: num("moveM"),
      angleDeg: adv ? num("angleDeg") || 0 : 0,
      redirects: adv && form.redirect.checked && num("redirectDeg") !== null ? [num("redirectDeg")] : [],
      ratedLb: num("ratedLb"),
      ropeType: radio("ropeType"),
      ropeDiaMm: num("ropeDiaMm"),
      ropeLengthM: num("ropeLengthM"),
      drumDiaMm: num("drumDiaMm"),
      drumLengthMm: num("drumLengthMm"),
      ropeMbsKg: num("ropeMbsKg"),
      chart: chart.length >= 2 ? chart : D.zeon10.chart,
      chartCustom: custom && chart.length >= 2,
      elec: {
        type: radio("battType"),
        cca: num("cca"),
        bmsA: num("bmsA"),
        ah: num("ah"),
        cableMm2: cable ? cable.mm2 : 0,
        cableLabel: cable ? cable.label : "",
        cableM: num("cableM") || 0,
        altAmps: num("altAmps") || 0,
      },
      otherGvmKg: num("otherGvmKg"),
      kin: { mbsKg: num("kinMbsKg"), lengthM: num("kinLengthM"), stretchPct: num("kinStretchPct"), speedKmh: num("kinSpeedKmh") },
    };
  }

  function save() {
    const data = {};
    Array.from(form.elements).forEach((f) => {
      if (!f.name || f.type === "button") return;
      if (f.type === "radio") {
        if (f.checked) data[f.name] = f.value;
      } else if (f.type === "checkbox") data[f.name] = f.checked;
      else data[f.name] = f.value;
    });
    data.chart = readChart();
    try {
      localStorage.setItem(STORE, JSON.stringify(data));
    } catch (e) { /* storage blocked: the page still works, it just won't remember */ }
  }

  function restore() {
    let data = null;
    try {
      data = JSON.parse(localStorage.getItem(STORE) || "null");
    } catch (e) {
      data = null;
    }
    if (!data) return;
    Object.entries(data).forEach(([k, v]) => {
      if (k === "chart") return;
      const f = form.elements[k];
      if (!f) return;
      if (f instanceof RadioNodeList || (f.length && f[0] && f[0].type === "radio")) {
        const r = form.querySelector(`input[name="${k}"][value="${v}"]`);
        if (r) r.checked = true;
      } else if (f.type === "checkbox") f.checked = !!v;
      else f.value = v;
    });
    if (Array.isArray(data.chart) && data.chart.length >= 2) setChart(data.chart);
  }

  function onChange() {
    syncFormBits();
    save();
    render();
  }

  // Bits of the form that depend on other inputs.
  function syncFormBits() {
    const g = C.ground(form.ground.value);
    const proxyField = document.getElementById("proxy-field");
    proxyField.hidden = !(g && g.proxy);
    const gap = g && g.proxy ? D.gaps.find((x) => x.id === g.id) : null;
    document.getElementById("proxy-hint").textContent = gap ? gap.text : "";
    document.getElementById("redirect-angle-wrap").hidden = !form.redirect.checked;
    const lithium = radio("battType") === "lithium";
    document.querySelectorAll("[data-batt]").forEach((n) => (n.hidden = (n.dataset.batt === "lithium") !== lithium));
    const deg = num("gradeDeg") || 0;
    document.getElementById("grade-pct").textContent = deg > 0 ? `${U.n(Math.abs(deg), 0.1)}° is a ${U.n(Math.tan((Math.min(deg, 89) * Math.PI) / 180) * 100, 1)}% grade.` : "";
    const r = num("ratedLb");
    document.getElementById("rated-kg").textContent = r ? `${U.kg(C.lbToKg(r))} (${U.kn(C.lbToKg(r))}) on the first layer.` : "From the winch's label or manual, in lb as winches are sold.";
  }

  // ------------------------------------------------------------ helpers for results
  function panel(id, ...children) {
    document.getElementById(id).replaceChildren(...children.flat().filter(Boolean));
  }

  function note(status, text) {
    return el("p", { class: "note note--" + status }, U.statusIcon(status), el("span", null, text));
  }

  function setOverall(status, text) {
    const o = document.getElementById("overall");
    o.className = "overall overall--" + status;
    o.replaceChildren(U.statusIcon(status), el("span", null, text));
  }

  // Diagrams are drawn at the width they'll show at, so their text stays readable on phones.
  const bodyWidth = (id) => document.getElementById(id).clientWidth || 640;

  const layerWord = (n) => ["first", "second", "third", "fourth", "fifth", "sixth"][n - 1] || n + "th";

  // ------------------------------------------------------------ render
  function render() {
    const inp = read();
    const res = C.resistance(inp);
    const adv = mode === "advanced";
    document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("is-empty", res.incomplete));

    if (res.incomplete) {
      const msg = res.reason === "mass"
        ? "Enter your vehicle's mass to start, or pick a scenario."
        : res.reason === "ground"
          ? "Choose the ground the vehicle is on."
          : `${res.ground.chosen.label} has no published ground factor. Choose the nearest published ground under it.`;
      setOverall("incomplete", msg);
      ["pull-body", "size-body", "block-body", "drum-body", "elec-body", "gear-body", "kinetic-body"].forEach((id) => panel(id, el("p", { class: "muted" }, "Results appear here once the vehicle and ground are filled in.")));
      return;
    }

    const ang = C.angled(res.totalKg, inp.angleDeg);
    const rig = C.rigging(ang.ropeKg, inp.parts, inp.redirects);
    const dr = adv ? C.drum(inp) : null;
    const sizing = C.winchSizing(res.massKg, rig.winchKg);

    let sim = null;
    let reach = null;
    if (adv && dr && inp.ratedLb > 0 && inp.anchorM > 0) {
      const ropeOutM = inp.parts * inp.anchorM;
      const mw = C.minWrapsM(dr, inp.ropeType);
      reach = { ropeOutM, minWraps: mw, spareM: dr.ropeLengthM - mw.m - ropeOutM };
      const moveM = Math.min(Math.max(inp.moveM || 0, 0), inp.anchorM);
      sim = C.simulate({
        drum: dr,
        ropeOutM: Math.min(ropeOutM, dr.ropeLengthM),
        moveM,
        parts: inp.parts,
        winchKg: rig.winchKg,
        ratedLb: inp.ratedLb,
        chart: inp.chart,
        chartRatedLb: inp.chartCustom ? inp.ratedLb : D.zeon10.ratedLb,
        elec: inp.elec,
      });
      sim.moveM = moveM;
    }

    renderOverall(inp, res, rig, sizing, sim, reach);
    renderPull(inp, res, ang, rig);
    renderSize(inp, res, rig, sizing, dr, sim);
    renderBlocks(inp, res, ang);
    if (adv) {
      renderDrum(inp, rig, dr, sim, reach);
      renderElec(inp, sim);
      renderKinetic(inp, res);
    }
    renderGear(inp, res, rig, sizing);
  }

  function renderOverall(inp, res, rig, sizing, sim, reach) {
    if (res.rollsAlone) {
      setOverall("info", "Downhill and steep enough that gravity beats the ground resistance: it would roll toward the anchor by itself. The winch's job here is to control it, not pull it.");
      return;
    }
    if (mode === "simple") {
      setOverall("info", `Your winch must pull about ${U.kg(rig.winchKg)} on the rope${inp.parts === 2 ? " with a double line" : ""}. Choose a winch rated at least ${U.lbMin(sizing.recommendedKg)} (${U.kgMin(sizing.recommendedKg)}).`);
      return;
    }
    if (!sim) {
      setOverall("incomplete", "Fill in your winch's rating, rope, drum and the distance to the anchor to check your winch.");
      return;
    }
    const needNoMargin = rig.winchKg / (1 + D.rule("safety-margin").params.fraction);
    const minAvail = Math.min(...sim.points.map((p) => p.availKg));
    if (reach.spareM < 0) setOverall("fail", `The rope is too short: running ${inp.parts} line${inp.parts > 1 ? "s" : ""} to an anchor ${U.n(inp.anchorM, 0.1)} m away would pull it past the wraps that must stay on the drum.`);
    else if (sim.failsAtM === null) setOverall("pass", `Your winch can do it: it keeps at least ${Math.round((sim.minMargin - 1) * 100)}% more pull than needed, margin included, all the way.`);
    else if (minAvail >= needNoMargin) setOverall("warn", `Close: your winch covers the estimate, but not all of the 25% safety margin${sim.failsAtM > 0 ? ` once the rope reaches layer ${sim.points.find((p) => p.x >= sim.failsAtM).layer}` : ""}. A double line or an extra block would give it room.`);
    else setOverall("fail", `Not enough winch${sim.failsAtM > 0 ? ` after ${U.n(sim.failsAtM, 0.1)} m, when the rope piles up to layer ${sim.points.find((p) => p.x >= sim.failsAtM).layer}` : " from the start"}. Add a snatch block (more lines), pay out more rope so it works on a lower layer, or cut the resistance first (I4WDTA: clear the wheel path, use mats or sand ladders, check tyre pressures, unload the vehicle).`);
  }

  function renderPull(inp, res, ang, rig) {
    const ids = ["ground-factor", "gradient", "safety-margin"];
    if (res.bogged) ids.splice(1, 0, "bogged-axles");
    if (res.stuckWheels) ids.push("damage");
    if (inp.angleDeg) ids.push("line-angle");
    if (inp.parts > 1) ids.push("mechanical-advantage", "sheave-friction");
    const lineWord = ["Single line", "Double line", "Triple line", "Four lines"][inp.parts - 1];
    panel(
      "pull-body",
      el(
        "div",
        { class: "figures" },
        U.figure("Total resistance", U.kg(res.totalKg), U.kn(res.totalKg) + " · " + U.lb(res.totalKg), "figure--lead"),
        U.figure("Rope pull at the winch", U.kg(rig.winchKg), lineWord + " · " + U.kn(rig.winchKg) + " · " + U.lb(rig.winchKg))
      ),
      el("p", { class: "panel-intro muted" }, `That's ${Math.round((res.totalKg / res.massKg) * 100)}% of the vehicle's ${U.kg(res.massKg)}. The pull falls once it's free and rolling, so this is the figure to plan for.`),
      V.resistanceBar(res),
      res.ground.isProxy ? note("warn", `${res.ground.chosen.label} has no published factor. It's worked out as ${res.ground.used.label.toLowerCase()}, which is your choice, not a source.`) : null,
      res.beyondMethod ? note("warn", `Steeper than 45°: beyond the range of I4WDTA's method. The gradient part is still plain physics, but think hard before winching up anything this steep.`) : null,
      inp.angleDeg ? note("info", `The rope is ${U.n(inp.angleDeg, 1)}° off the vehicle's path, so it must pull ${U.kg(ang.ropeKg)} to move it forward, and pushes ${U.kg(ang.sideKg)} sideways on the vehicle and fairlead.`) : null,
      U.sourcesLine(ids)
    );
  }

  function renderSize(inp, res, rig, sizing, dr, sim) {
    const adv = mode === "advanced";
    const z = D.zeon10;
    const ratios = dr ? dr.layers.slice(0, 5).map((l) => l.ratio) : z.layersLb.map((lb) => lb / z.ratedLb);
    const startLayer = sim ? sim.startLayer : 1;
    const startRatio = sim ? dr.layers[startLayer - 1].ratio : 1;

    const layerRows = ratios.map((ratio, i) =>
      el("tr", { class: sim && i + 1 === startLayer ? "is-binding" : null },
        el("th", { scope: "row" }, "Layer " + (i + 1)),
        el("td", { class: "num" }, Math.round(ratio * 100) + "%"),
        el("td", { class: "num" }, U.lbMin(rig.winchKg / ratio), el("small", null, U.kgMin(rig.winchKg / ratio)))
      )
    );

    const configs = adv ? [1, 2, 3, 4] : [1, 2];
    const tensions = configs.map((n) => C.rigging(C.angled(res.totalKg, inp.angleDeg).ropeKg, n, inp.redirects).winchKg);
    const sizeRows = WINCH_SIZES_LB.map((lb) => {
      const avail = C.lbToKg(lb) * startRatio;
      return el("tr", { class: inp.ratedLb === lb && adv ? "is-binding" : null },
        el("th", { scope: "row" }, U.n(lb, 1) + " lb", el("small", null, U.kg(C.lbToKg(lb)))),
        tensions.map((t) => {
          const ok = avail >= t;
          return el("td", { class: "size-cell size-cell--" + (ok ? "pass" : "fail") }, U.statusIcon(ok ? "pass" : "fail"), ok ? "Yes" : "No");
        })
      );
    });

    panel(
      "size-body",
      el(
        "div",
        { class: "figures" },
        U.figure("Recommended minimum", U.lbMin(sizing.recommendedKg), U.kgMin(sizing.recommendedKg) + " rated pull", "figure--lead"),
        U.figure("WARN's rule: 1.5 × mass", U.lbMin(sizing.warnKg), U.kgMin(sizing.warnKg)),
        U.figure("This recovery, first layer", U.lbMin(rig.winchKg), U.kgMin(rig.winchKg))
      ),
      el("p", { class: "panel-intro muted" }, sizing.neededKg > sizing.warnKg
        ? "This recovery needs more than WARN's general rule, so the recovery sets the size. Or use a snatch block."
        : "WARN's general rule is the bigger of the two, so it sets the size. It leaves room for worse recoveries than this one."),
      el("h3", { class: "sub-head" }, "If the rope is piled up on the drum"),
      el("p", { class: "muted panel-intro" }, adv && dr
        ? `Winches are rated on the first layer. On your drum the pull drops layer by layer like this${sim ? `; your pull starts on the ${layerWord(startLayer)} layer (highlighted)` : ""}. Rating needed for this recovery on each layer:`
        : "Winches are rated on the first layer of rope. With rope piled up, the same winch pulls less (WARN's ZEON 10 figures below), so it needs a higher rating. Rating needed for this recovery on each layer:"),
      el("div", { class: "table-wrap" }, el("table", { class: "limit-table" },
        el("thead", null, el("tr", null, el("th", { scope: "col" }, "Pulling on"), el("th", { scope: "col", class: "num" }, "Pull vs rating"), el("th", { scope: "col", class: "num" }, "Rating needed"))),
        el("tbody", null, layerRows))),
      el("h3", { class: "sub-head" }, "Common winch sizes for this recovery"),
      el("p", { class: "muted panel-intro" }, sim ? `Pulling on the ${layerWord(startLayer)} layer, as yours would at the start.` : "Pulling on the first layer."),
      el("div", { class: "table-wrap" }, el("table", { class: "limit-table size-table" },
        el("thead", null, el("tr", null, el("th", { scope: "col" }, "Rated pull"), configs.map((n) => el("th", { scope: "col" }, ["Single", "Double", "Triple", "Four lines"][n - 1])))),
        el("tbody", null, sizeRows))),
      U.sourcesLine(["winch-size", "layer-pull", "mechanical-advantage", "sheave-friction"])
    );
  }

  function renderBlocks(inp, res, ang) {
    const adv = mode === "advanced";
    const configs = adv ? [1, 2, 3, 4] : [1, 2];
    const single = C.rigging(ang.ropeKg, 1, inp.redirects);
    const rows = configs.map((n) => {
      const r = C.rigging(ang.ropeKg, n, inp.redirects);
      const blocks = r.points.filter((p) => p.kind === "block");
      return el("tr", { class: n === inp.parts ? "is-binding" : null },
        el("th", { scope: "row" }, ["Single line", "Double line", "Triple line", "Four lines"][n - 1], el("small", null, n === 1 ? "no block" : `${n - 1} block${n > 2 ? "s" : ""}`)),
        el("td", { class: "num" }, U.kg(r.winchKg), el("small", null, Math.round((r.winchKg / single.winchKg) * 100) + "% of single")),
        el("td", { class: "num" }, blocks.length ? blocks.map((b) => U.kg(b.loadKg)).join(", ") : "–"),
        el("td", { class: "num" }, U.kg(r.anchorKg)),
        el("td", { class: "num" }, n === 1 ? "full" : "1/" + n),
        adv && inp.anchorM ? el("td", { class: "num" }, U.n(n * inp.anchorM, 1) + " m") : null
      );
    });
    const sel = C.rigging(ang.ropeKg, inp.parts, inp.redirects);
    const dbl = C.rigging(ang.ropeKg, 2, []);
    const red = sel.redirectBlocks[0];
    panel(
      "block-body",
      el("p", { class: "panel-intro" }, `A snatch block at the anchor, with the rope run back to the vehicle, nearly halves what the winch has to pull: ${U.kg(dbl.winchKg)} instead of ${U.kg(single.winchKg)}. Not exactly half, because each block loses about 8% to friction (LEEA). The price: twice the rope paid out, the vehicle moves at half the line speed, and the anchor and block still take the full ${U.kg(dbl.anchorKg)}.`),
      V.rigging(sel, bodyWidth("block-body")),
      el("div", { class: "table-wrap" }, el("table", { class: "limit-table block-table" },
        el("thead", null, el("tr", null,
          el("th", { scope: "col" }, "Rope run"),
          el("th", { scope: "col", class: "num" }, "Winch pulls"),
          el("th", { scope: "col", class: "num" }, "Each block takes"),
          el("th", { scope: "col", class: "num" }, "Anchor takes"),
          el("th", { scope: "col", class: "num" }, "Vehicle speed"),
          adv && inp.anchorM ? el("th", { scope: "col", class: "num" }, "Rope out") : null)),
        el("tbody", null, rows))),
      red ? note("info", `Redirect block: the two legs meet at ${U.n(red.angleDeg, 1)}°, so it takes ${U.kg(red.loadKg)} (${U.n(red.loadKg / red.inKg, 0.01)} × the rope's pull) and costs another 8% of pull. Its anchor must hold that too.`) : null,
      U.sourcesLine(["mechanical-advantage", "sheave-friction"].concat(red ? ["redirect-load"] : []))
    );
  }

  function renderDrum(inp, rig, dr, sim, reach) {
    if (!dr || !(inp.ratedLb > 0)) {
      panel("drum-body", el("p", { class: "muted" }, "Fill in your winch's rated pull, rope and drum to see how it copes through the pull."));
      return;
    }
    if (!sim) {
      panel("drum-body", el("p", { class: "muted" }, "Fill in the distance from the winch to the anchor."));
      return;
    }
    const pStart = sim.points[0];
    const pEnd = sim.points[sim.points.length - 1];
    const needNoMargin = rig.winchKg / (1 + D.rule("safety-margin").params.fraction);
    const startStatus = pStart.availKg >= rig.winchKg ? "pass" : pStart.availKg >= needNoMargin ? "warn" : "fail";
    const endStatus = pEnd.availKg >= rig.winchKg ? "pass" : pEnd.availKg >= needNoMargin ? "warn" : "fail";
    const startOnDrum = dr.ropeLengthM - Math.min(reach.ropeOutM, dr.ropeLengthM);
    const endOnDrum = startOnDrum + inp.parts * sim.moveM;

    const checks = [];
    checks.push(U.check(reach.spareM >= 0 ? "pass" : "fail", "Rope reaches the anchor",
      reach.spareM >= 0
        ? `${U.n(reach.ropeOutM, 0.1)} m paid out (${inp.parts} × ${U.n(inp.anchorM, 0.1)} m), leaving ${U.n(reach.spareM, 0.1)} m spare beyond the ${reach.minWraps.wraps} wraps (${U.n(reach.minWraps.m, 0.1)} m) that must stay on the drum.`
        : `Needs ${U.n(reach.ropeOutM, 0.1)} m out, but only ${U.n(dr.ropeLengthM - reach.minWraps.m, 0.1)} m can leave the drum: ${reach.minWraps.wraps} wraps must stay on. Extend to the anchor with a rated strap, or anchor closer.`));
    checks.push(U.check(startStatus, `At the start: ${layerWord(pStart.layer)} layer`,
      `The winch can pull ${U.kg(pStart.availKg)} here (${Math.round(dr.layers[pStart.layer - 1].ratio * 100)}% of its rating); ${U.kg(rig.winchKg)} is needed, margin included.`));
    if (pEnd.layer !== pStart.layer || endStatus !== startStatus)
      checks.push(U.check(endStatus, `At the end: ${layerWord(pEnd.layer)} layer`,
        `After ${U.n(sim.moveM, 0.1)} m, ${U.n(inp.parts * sim.moveM, 0.1)} m of rope has wound back on. The winch can pull ${U.kg(pEnd.availKg)} there.${sim.failsAtM !== null && sim.failsAtM > 0 ? ` It falls short after ${U.n(sim.failsAtM, 0.1)} m.` : ""}`));
    const overRated = sim.points.some((p) => p.neededKg / p.availKg > 1);
    if (inp.ropeMbsKg > 0) {
      const maxRope = Math.max(C.lbToKg(inp.ratedLb), rig.winchKg);
      const ratio = inp.ropeMbsKg / C.lbToKg(inp.ratedLb);
      checks.push(U.check(inp.ropeMbsKg >= maxRope ? "info" : "fail", "Rope strength",
        `MBS ${U.kg(inp.ropeMbsKg)}: ${U.n(ratio, 0.01)} × the winch's rated first-layer pull of ${U.kg(C.lbToKg(inp.ratedLb))}.` + (inp.ropeMbsKg >= maxRope ? " No winch maker's minimum ratio was found to judge it against; it's stronger than the biggest load the winch is rated to put on it." : " The rope is weaker than the pull the winch is rated for: it can break before the winch stalls.")));
    }

    panel(
      "drum-body",
      el("ul", { class: "checks" }, checks),
      overRated ? note("warn", "Above its rating, the performance chart is extended past its last point: current and speed there are rough.") : null,
      el("h3", { class: "sub-head" }, "Rope on the drum"),
      V.drum(dr, startOnDrum, endOnDrum, reach.minWraps.m, inp.ropeType, bodyWidth("drum-body")),
      el("h3", { class: "sub-head" }, "Pull along the recovery"),
      V.pullChart(sim, bodyWidth("drum-body")),
      el("div", { class: "table-wrap" }, el("table", { class: "limit-table" },
        el("thead", null, el("tr", null, el("th", { scope: "col" }, ""), el("th", { scope: "col", class: "num" }, "Layer"), el("th", { scope: "col", class: "num" }, "Can pull"), el("th", { scope: "col", class: "num" }, "Current"), el("th", { scope: "col", class: "num" }, "Rope speed"), el("th", { scope: "col", class: "num" }, "Vehicle speed"))),
        el("tbody", null, [["Start", pStart], ["End", pEnd]].map(([label, p]) =>
          el("tr", null, el("th", { scope: "row" }, label), el("td", { class: "num" }, String(p.layer)), el("td", { class: "num" }, U.kg(p.availKg)), el("td", { class: "num" }, U.n(p.amps, 1) + " A"), el("td", { class: "num" }, U.n(p.lineSpeedMMin, 0.1) + " m/min"), el("td", { class: "num" }, U.n(p.lineSpeedMMin / inp.parts, 0.1) + " m/min"))
        )))),
      el("p", { class: "hint" }, inp.chartCustom
        ? "Current and speed from your performance chart."
        : `Current and speed from WARN's ZEON 10 chart, scaled to your winch's ${U.n(inp.ratedLb, 1)} lb rating. Enter your winch's own chart (under Your winch) for real figures. The pull needed is held constant all the way, which is cautious: it usually drops once the vehicle is free.`),
      U.sourcesLine(["layer-pull", "min-wraps", "winch-chart", "mechanical-advantage"])
    );
  }

  function renderElec(inp, sim) {
    if (!sim) {
      panel("elec-body", el("p", { class: "muted" }, "Fill in your winch and the distance to the anchor first."));
      return;
    }
    const e = inp.elec;
    const peak = sim.peakPoint;
    const ec = C.electrics(e, peak.amps);
    const checks = [];
    if (e.type === "lead") {
      const min = D.rule("battery-cca").params.minCca;
      checks.push(e.cca > 0
        ? U.check(e.cca >= min ? "pass" : "warn", "Battery size", e.cca >= min ? `${U.n(e.cca, 1)} CCA meets WARN's ${min} CCA minimum for winching.` : `${U.n(e.cca, 1)} CCA is below WARN's ${min} CCA minimum for winching.`, null, e.cca >= min ? "OK" : "Below minimum")
        : U.check("incomplete", "Battery size", "Enter the battery's CCA."));
    } else {
      checks.push(U.check("warn", "Lithium battery", "WARN strongly recommends against lithium batteries for winching unless a qualified installer fits them, with extra circuit protection for the winch and battery.", null, "Caution"));
      checks.push(e.bmsA > 0
        ? U.check(peak.amps <= e.bmsA ? "pass" : "fail", "Battery's discharge limit", peak.amps <= e.bmsA ? `Peak ${U.n(peak.amps, 1)} A is within the BMS's ${U.n(e.bmsA, 1)} A.` : `Peak ${U.n(peak.amps, 1)} A is over the BMS's ${U.n(e.bmsA, 1)} A limit: expect it to cut the power mid-pull.`)
        : U.check("incomplete", "Battery's discharge limit", "Enter the BMS's maximum continuous discharge current from the battery's spec sheet."));
    }
    const nextCable = D.cables.find((c) => c.mm2 > e.cableMm2 * 1.4);
    const dropNext = nextCable ? (peak.amps * 2 * e.cableM * D.rule("cable-drop").params.ohmMm2PerM) / nextCable.mm2 : null;
    checks.push(U.check("info", "Voltage at the winch",
      (ec.winchVolts !== null ? `About ${U.n(ec.winchVolts, 0.1)} V at the peak: the battery sags to ${U.n(ec.battVolts, 0.1)} V (cold, worst case, from its CCA) and the cables lose ${U.n(ec.cableDrop, 0.01)} V.` : `The cables lose ${U.n(ec.cableDrop, 0.01)} V at the peak.`) +
      (nextCable ? ` ${nextCable.label} cable would lose ${U.n(dropNext, 0.01)} V.` : "")));
    const pct = e.ah > 0 ? (sim.ah / e.ah) * 100 : null;
    checks.push(U.check("info", "Charge used",
      `${U.n(sim.ah, 0.1)} Ah over the pull${pct !== null ? ` (${U.n(pct, 1)}% of ${U.n(e.ah, 1)} Ah)` : ""}${e.altAmps > 0 ? `, after the alternator's ${U.n(e.altAmps, 1)} A` : ", engine off"}.` +
      (e.altAmps > 0 ? "" : " WARN: with the engine off a winch only runs for a few minutes. Run the engine.")));
    checks.push(U.check("info", "How long it pulls", `About ${U.n(sim.timeS / 60, 0.1)} minutes of winching for ${U.n(sim.moveM, 0.1)} m. Duty cycle (how long before it must rest) differs by winch: check your manual.`));

    panel(
      "elec-body",
      el("div", { class: "figures" },
        U.figure("Peak current", U.n(peak.amps, 1) + " A", `on layer ${peak.layer}`, "figure--lead"),
        U.figure("At the winch", ec.winchVolts !== null ? U.n(ec.winchVolts, 0.1) + " V" : "–", ec.winchVolts !== null ? "cold battery, worst case" : "enter battery details"),
        U.figure("Charge used", U.n(sim.ah, 0.1) + " Ah", pct !== null ? `${U.n(pct, 1)}% of the battery` : null),
        U.figure("Winching time", U.n(sim.timeS / 60, 0.1) + " min", `${U.n(sim.moveM, 0.1)} m at ${U.n(sim.points[0].lineSpeedMMin / inp.parts, 0.1)}–${U.n(sim.points[sim.points.length - 1].lineSpeedMMin / inp.parts, 0.1)} m/min`)
      ),
      el("ul", { class: "checks" }, checks),
      U.sourcesLine(["winch-chart", "battery-cca", "cca-resistance", "cable-drop"])
    );
  }

  function renderGear(inp, res, rig, sizing) {
    const adv = mode === "advanced";
    const fullKg = adv && inp.ratedLb > 0 ? C.lbToKg(inp.ratedLb) : sizing.recommendedKg;
    const scale = fullKg / rig.winchKg;
    const fullLabel = adv && inp.ratedLb > 0 ? "At your winch's full pull" : "At full pull of a winch sized as above";
    const items = [];
    items.push({ item: "Winch rope", where: "between winch and first block", kg: rig.winchKg, shackle: false });
    rig.points.forEach((p, i) => {
      if (p.kind === "block") items.push({ item: `Snatch block ${i + 1}`, where: p.at === "anchor" ? "at the anchor" : "on the vehicle", kg: p.loadKg, shackle: true });
    });
    rig.redirectBlocks.forEach((b) => items.push({ item: "Redirect block", where: "and its anchor", kg: b.loadKg, shackle: true }));
    items.push({ item: "Tree protector or anchor strap", where: "the anchor", kg: rig.anchorKg, shackle: true });
    const endPt = rig.points[rig.points.length - 1];
    if (endPt.at === "vehicle") items.push({ item: "Rope end", where: "recovery point on the vehicle", kg: endPt.loadKg, shackle: true });

    const rows = items.map((it) => {
      const sh = it.shackle ? C.shackleFor(it.kg * scale) : null;
      return el("tr", null,
        el("th", { scope: "row" }, it.item, el("small", null, it.where)),
        el("td", { class: "num" }, U.kg(it.kg)),
        el("td", { class: "num" }, U.kg(it.kg * scale)),
        el("td", { class: "num" }, it.shackle ? (sh ? [sh.size, el("small", null, U.tonnes(sh.wllT) + " WLL")] : ["Over 8.5 t", el("small", null, "rated rigging only")]) : "–")
      );
    });

    const lighter = inp.otherGvmKg > 0 ? Math.min(inp.otherGvmKg, res.massKg) : res.massKg;
    const strap = C.strapRange(lighter);
    panel(
      "gear-body",
      el("p", { class: "panel-intro" }, `Rig for what the winch can do, not just what this recovery needs: a winch can pull its full rating if something snags. Every item's WLL should cover the right-hand load.`),
      el("div", { class: "table-wrap" }, el("table", { class: "limit-table gear-table" },
        el("thead", null, el("tr", null, el("th", { scope: "col" }, "Item"), el("th", { scope: "col", class: "num" }, "This recovery"), el("th", { scope: "col", class: "num" }, fullLabel), el("th", { scope: "col", class: "num" }, "Shackle"))),
        el("tbody", null, rows))),
      el("p", { class: "hint" }, "Shackle sizes from Crosby's G-209 table: the smallest whose WLL covers the full-pull load. Other brands are rated differently: read the WLL marked on yours."),
      el("h3", { class: "sub-head" }, "Snatch strap"),
      el("div", { class: "figures" },
        U.figure("Strap MBS", `${U.n(strap.minKg / 1000, 0.1)}–${U.n(strap.maxKg / 1000, 0.1)} t`, `2 to 3 × the ${inp.otherGvmKg > 0 ? "lighter vehicle's" : "vehicle's"} ${U.kg(lighter)}`, "figure--lead")
      ),
      el("p", { class: "muted panel-intro" }, `From Australia's mandatory recovery strap standard (we haven't found a South African one). Stand at least 1.5 × the stretched strap's length away, and remember a wet strap is weaker and stretches less (Bushranger's instructions). The standard doesn't cover kinetic ropes: use the vehicle mass range on the rope's label.${inp.otherGvmKg > 0 ? "" : " Add the recovery vehicle's mass under Kinetic recovery (Advanced): the standard goes by the lighter of the two."}`),
      el("h3", { class: "sub-head" }, "MBS or WLL?"),
      el("p", { class: "muted panel-intro" }, "MBS is where a new item breaks. WLL is the most it's certified for in use: MBS divided by a safety factor that depends on the standard. Straps carry only an MBS; shackles and blocks carry a WLL (Crosby shackles break at no less than 6 × WLL). Never compare one item's MBS with another's WLL. More under the explainer below."),
      U.sourcesLine(["shackle-ratings", "wll-mbs", "strap-mbs"])
    );
  }

  function renderKinetic(inp, res) {
    const k = inp.kin;
    if (!(inp.otherGvmKg > 0 && k.mbsKg > 0)) {
      panel("kinetic-body", el("p", { class: "muted" }, "Fill in the recovery vehicle's mass and the strap or rope's MBS to check a kinetic recovery."));
      return;
    }
    const lighter = Math.min(inp.otherGvmKg, res.massKg);
    const range = C.strapRange(lighter);
    const kin = C.kinetic({ massKg: inp.otherGvmKg, speedKmh: k.speedKmh || 0, mbsKg: k.mbsKg, lengthM: k.lengthM, stretchPct: k.stretchPct });
    const checks = [];
    const st = k.mbsKg < range.minKg ? "fail" : k.mbsKg > range.maxKg ? "warn" : "pass";
    checks.push(U.check(st, "Strength for these vehicles",
      st === "pass" ? `${U.kg(k.mbsKg)} MBS is within 2–3 × the lighter vehicle's ${U.kg(lighter)}.`
        : st === "fail" ? `${U.kg(k.mbsKg)} MBS is under 2 × the lighter vehicle's ${U.kg(lighter)}: too weak for it under the strap standard.`
          : `${U.kg(k.mbsKg)} MBS is over 3 × the lighter vehicle's ${U.kg(lighter)}: above the range the strap standard recommends for it.`, null, { pass: "OK", fail: "Too weak", warn: "Above range" }[st]));
    if (!kin) {
      checks.push(U.check("incomplete", "Peak force", "Fill in the length and stretch."));
      panel("kinetic-body", el("ul", { class: "checks" }, checks), U.sourcesLine(["strap-mbs"]));
      return;
    }
    const cur = kin.current;
    checks.push(U.check(cur.fractionOfMbs >= 1 ? "fail" : "info", `Peak force at ${U.n(k.speedKmh || 0, 0.1)} km/h`,
      cur.fractionOfMbs >= 1
        ? `The estimate reaches the strap's MBS (${U.kg(k.mbsKg)}) before the moving vehicle's energy is used up: it could break. Slow down.`
        : `About ${U.kg(cur.peakKg)} (${Math.round(cur.fractionOfMbs * 100)}% of the MBS), stretching it ${U.n(cur.stretchM, 0.1)} m. ${cur.peakKg >= res.totalKg ? "That's more than the estimated resistance, so it should come free." : "That's less than the estimated resistance, so it may not come free in one go."}`));
    const speeds = [5, 10, 15, 20];
    const rows = speeds.map((s) => {
      const a = kin.at(s);
      return el("tr", { class: Math.abs(s - (k.speedKmh || 0)) < 0.01 ? "is-binding" : null },
        el("th", { scope: "row" }, s + " km/h"),
        el("td", { class: "num" }, a.fractionOfMbs >= 1 ? "over MBS" : U.kg(a.peakKg)),
        el("td", { class: "num" }, Math.round(a.fractionOfMbs * 100) + "%"),
        el("td", { class: "num" }, a.fractionOfMbs >= 1 ? "–" : U.n(a.stretchM, 0.1) + " m")
      );
    });
    const sh = C.shackleFor(k.mbsKg / D.rule("shackle-ratings").params.designFactor);
    panel(
      "kinetic-body",
      el("p", { class: "panel-intro tag-line" }, U.categoryTag("calculation"), " Simplified physics, not a measurement: the rope as a spring, the stuck vehicle not moving, no energy lost in the ground."),
      el("ul", { class: "checks" }, checks),
      el("div", { class: "table-wrap" }, el("table", { class: "limit-table" },
        el("thead", null, el("tr", null, el("th", { scope: "col" }, "Speed when it tightens"), el("th", { scope: "col", class: "num" }, "Peak force"), el("th", { scope: "col", class: "num" }, "Of MBS"), el("th", { scope: "col", class: "num" }, "Stretch"))),
        el("tbody", null, rows))),
      el("p", { class: "hint" }, `Twice the speed, twice the force. In this model about ${U.n(kin.speedFor(res.totalKg), 0.1)} km/h is enough to reach the estimated resistance of ${U.kg(res.totalKg)}.`),
      el("p", { class: "muted panel-intro" }, sh
        ? `A kinetic pull can load every fitting up to the strap's MBS. A ${sh.size} Crosby G-209 (${U.tonnes(sh.wllT)} WLL) has an MBS of at least ${U.tonnes(sh.mbsT)}, more than the strap's ${U.tonnes(k.mbsKg / 1000)}, so the strap would give first.`
        : "This strap is stronger than the shackles in Crosby's table can match at 6:1: use rated soft shackles or larger rigging."),
      U.sourcesLine(["kinetic-energy", "strap-mbs", "shackle-ratings"])
    );
  }

  // ------------------------------------------------------------ explainers
  function renderExplainers() {
    const fill = (id, ...children) => document.querySelector(`#${id} .explainer-body`).replaceChildren(...children);
    const z = D.zeon10;
    fill("explain-mbs",
      el("p", null, D.rule("wll-mbs").summary),
      el("ul", null,
        el("li", null, el("strong", null, "Shackle: "), "a 3/4\" Crosby G-209 is 4.75 t WLL and breaks at no less than 28.5 t (6 ×). Comparing its 4.75 t with a strap's 8 t MBS makes the shackle look like the weak link; it isn't."),
        el("li", null, el("strong", null, "Snatch block: "), "WARN's heavy duty block: 96 000 lb MBS, 24 000 lb WLL for lifting (4:1) or 48 000 lb WLL for vehicle recovery (2:1). Same block, two WLLs."),
        el("li", null, el("strong", null, "Strap: "), "labelled with its MBS only. Pick it by vehicle mass (2–3 × GVM), not by matching it to a shackle's WLL.")
      ),
      U.sourcesLine(["wll-mbs", "shackle-ratings", "strap-mbs"])
    );
    fill("explain-layers",
      el("p", null, D.rule("layer-pull").summary),
      el("p", null, `So a ${U.n(z.ratedLb, 1)} lb winch pulls ${z.layersLb.map((x) => U.n(x, 1)).join(", ")} lb on layers 1 to 4. Paying out more rope (anchoring further away) keeps the pull on a lower layer. The rope also comes in faster on the outer layers, and the motor draws more current for the same pull.`),
      U.sourcesLine(["layer-pull", "winch-chart"])
    );
    fill("explain-gaps",
      el("p", null, "Where no engineering source, standard or maker publishes a figure, this page says so rather than filling the gap with a rule of thumb."),
      el("ul", null, D.gaps.map((g) => el("li", null, el("strong", null, g.title + ": "), g.text)))
    );
  }

  init();
})();
