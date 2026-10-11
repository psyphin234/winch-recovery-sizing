/*
 * app.js: one page, one state. The inputs live on the pictures (mass on the
 * vehicle, winch on the winch, distance on the rope, rope length on the drum);
 * the pictures are built once and updated in place so changes animate.
 * State is kept in this browser's localStorage only.
 */
(function () {
  "use strict";

  const D = window.WINCH_DATA;
  const C = window.WINCH_CALC;
  const U = window.WINCH_UI;
  const V = window.WINCH_DIAGRAMS;
  const { el } = U;
  const $ = (id) => document.getElementById(id);
  const STORE = "winch-calc-v2";
  const Z = D.zeon10;
  const MARGIN = D.rule("safety-margin").params.fraction;
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let S = Object.assign({}, D.defaults, load());
  // grounds that are no longer offered (an older visit's saved choice) fall back to the default
  if (!C.ground(S.ground)) S.ground = D.defaults.ground;
  if (S.proxy && !C.ground(S.proxy)) S.proxy = "";
  let R = null; // latest results
  let sceneView = null;
  let drumView = null;
  let drumKey = "";
  let gaugeView = null;
  let angleView = null;
  let charts = [];
  let live = {}; // the readouts that count up as the pull plays
  const play = { raf: 0, x: null };

  // ------------------------------------------------------------ state
  function load() {
    try {
      return JSON.parse(localStorage.getItem(STORE) || "{}") || {};
    } catch (e) {
      return {};
    }
  }
  function save() {
    try {
      localStorage.setItem(STORE, JSON.stringify(S));
    } catch (e) { /* storage blocked: the page still works, it just won't remember */ }
  }
  function set(patch) {
    Object.assign(S, patch);
    save();
    update();
  }
  const numOr = (v, d) => (typeof v === "number" && isFinite(v) ? v : d);

  // ------------------------------------------------------------ results
  function compute() {
    const res = C.resistance({ massKg: S.massKg, ground: S.ground, proxy: S.proxy, bog: S.bog, gradeDeg: numOr(S.gradeDeg, 0) * (S.slopeDir === "down" ? -1 : 1) });
    const rating = C.parseRating(S.winch);
    const dr = C.drum({ drumDiaMm: Z.drumDiaMm, drumLengthMm: Z.drumLengthMm, ropeDiaMm: Z.ropeDiaMm, ropeLengthM: numOr(S.ropeLengthM, Z.ropeLengthM) });
    if (res.incomplete || !dr) return { res, rating, dr };
    const mw = C.minWrapsM(dr, S.ropeType);
    const anchorM = Math.max(1, numOr(S.anchorM, 15));
    const moveM = Math.max(0.5, Math.min(numOr(S.moveM, 6), anchorM));
    const ang = C.angled(res.totalKg, numOr(S.ropeAngleDeg, 0));
    const runFor = (parts) => {
      const rig = C.rigging(ang.ropeKg, parts, []);
      const ropeOutM = parts * anchorM;
      const spareM = dr.ropeLengthM - mw.m - ropeOutM;
      const startLayer = C.layerAt(dr, dr.ropeLengthM - Math.min(ropeOutM, dr.ropeLengthM));
      let sim = null;
      if (rating.ok && !res.rollsAlone) {
        sim = C.simulate({ drum: dr, ropeOutM: Math.min(ropeOutM, dr.ropeLengthM), moveM, parts, winchKg: rig.winchKg, ratedLb: rating.lb, chart: Z.chart, chartRatedLb: Z.ratedLb });
      }
      let status = "idle";
      if (res.rollsAlone) status = "rolls";
      else if (sim && spareM < 0) status = "rope";
      else if (sim) {
        const minAvail = Math.min(...sim.points.map((p) => p.availKg));
        status = sim.failsAtM === null ? "ok" : minAvail >= rig.winchKg / (1 + MARGIN) ? "close" : "short";
      }
      return { parts, rig, ropeOutM, spareM, startLayer, sim, status };
    };
    const alts = [1, 2, 3].map(runFor);
    const cur = alts[S.parts - 1];
    const sizing = C.winchSizing(res.massKg, cur.rig.winchKg / cur.startLayer.ratio);
    return { res, ang, rating, dr, mw, anchorM, moveM, alts, cur, sizing };
  }

  // ------------------------------------------------------------ build once
  const NS = "http://www.w3.org/2000/svg";
  function svgEl(tag, attrs, ...kids) {
    const n = document.createElementNS(NS, tag);
    Object.entries(attrs || {}).forEach(([k, v]) => n.setAttribute(k, v));
    kids.forEach((k) => n.appendChild(k));
    return n;
  }

  function build() {
    // examples
    D.scenarios.forEach((sc) => {
      const b = el("button", { type: "button", class: "try-chip" }, sc.label);
      b.addEventListener("click", () => {
        stopPlay();
        set(Object.assign({ proxy: "", ropeAngleDeg: 0 }, sc.values));
        syncInputs();
        play.x = 0;
        if (!reduceMotion) startPlay();
      });
      $("try").appendChild(b);
    });

    // the scene
    sceneView = V.scene();
    $("scene-pic").prepend(sceneView.el);
    placeFields();

    // ground chips
    D.grounds.forEach((g) => {
      const L = V.LOOKS[g.look];
      const b = el("button", { type: "button", role: "radio", class: "chip", "data-ground": g.id, "aria-checked": "false" },
        el("span", { class: "chip-swatch", style: `background:${L.base};border-color:${L.edge}`, "aria-hidden": "true" }),
        g.label, g.gcf ? null : el("sup", { title: "No published factor" }, "*"));
      b.addEventListener("click", () => set({ ground: g.id }));
      $("ground-chips").appendChild(b);
    });
    $("proxy").appendChild(el("option", { value: "" }, "Choose…"));
    D.grounds.filter((g) => !g.proxy).forEach((g) => $("proxy").appendChild(el("option", { value: g.id }, g.label)));
    $("proxy").addEventListener("change", (e) => set({ proxy: e.target.value }));

    // how deep: little pictures of a vehicle sunk into the ground
    D.bogLevels.forEach((b) => {
      const depth = { none: 0, axles: 9, chassis: 15 }[b.id];
      const icon = svgEl("svg", { viewBox: "0 0 44 34", class: "bog-icon", "aria-hidden": "true" },
        svgEl("rect", { x: 3, y: 4 + depth, width: 38, height: 9, rx: 3, class: "bi-body" }),
        svgEl("circle", { cx: 13, cy: 17 + depth, r: 6.5, class: "bi-wheel" }),
        svgEl("circle", { cx: 31, cy: 17 + depth, r: 6.5, class: "bi-wheel" }),
        svgEl("rect", { x: 0, y: 23.5, width: 44, height: 11, class: "bi-ground" }));
      const btn = el("button", { type: "button", role: "radio", class: "chip chip--icon", "data-bog": b.id, "aria-checked": "false" }, icon, el("span", null, b.label));
      btn.addEventListener("click", () => set({ bog: b.id }));
      $("bog-chips").appendChild(btn);
    });

    // slope
    document.querySelectorAll("#slope-dir button").forEach((b) => b.addEventListener("click", () => set({ slopeDir: b.dataset.dir })));
    $("gradeDeg").max = D.rule("gradient").params.sliderMaxDeg;
    $("gradeDeg").addEventListener("input", (e) => set({ gradeDeg: +e.target.value }));

    // rope angle, with a little top view that swings with the slider
    angleView = V.angleView();
    $("angle-view").appendChild(angleView.el);
    $("ropeAngleDeg").max = D.rule("line-angle").params.sliderMaxDeg;
    $("ropeAngleDeg").addEventListener("input", (e) => set({ ropeAngleDeg: +e.target.value }));

    // typed fields
    const bindNum = (id, key) => $(id).addEventListener("input", (e) => {
      const v = parseFloat(e.target.value);
      if (isFinite(v) && v > 0) set({ [key]: v });
    });
    bindNum("massKg", "massKg");
    bindNum("anchorM", "anchorM");
    bindNum("anchorScene", "anchorM");
    bindNum("moveM", "moveM");
    bindNum("ropeLengthM", "ropeLengthM");
    $("winch").addEventListener("input", (e) => set({ winch: e.target.value }));
    document.querySelectorAll("#rope-type button").forEach((b) => b.addEventListener("click", () => set({ ropeType: b.dataset.rope })));

    // rope picker
    [1, 2, 3].forEach((n) => {
      const b = el("button", { type: "button", role: "radio", class: "pick", "data-parts": n, "aria-checked": "false" },
        V.lineThumb(n),
        el("span", { class: "pick-name" }, ["Single line", "Double line", "Triple line"][n - 1]),
        el("span", { class: "pick-sub" }, ""));
      b.addEventListener("click", () => set({ parts: n }));
      $("picker").appendChild(b);
    });

    gaugeView = V.gauge();
    $("gauge").appendChild(gaugeView.el);
    $("play").addEventListener("click", () => {
      if (play.raf) return stopPlay();
      if (play.x === null || play.x >= R.moveM - 1e-6) play.x = 0;
      startPlay();
    });

    renderExplainers();
    syncInputs();

    let lastW = 0;
    let timer = null;
    window.addEventListener("resize", () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if ($("stage").clientWidth !== lastW) {
          lastW = $("stage").clientWidth;
          placeFields();
          update();
        }
      }, 150);
    });
    $("year").textContent = new Date().getFullYear();
  }

  // Wide screens: the mass and winch fields sit on the picture. Phones: under it,
  // so the picture's labels are placed against the picture alone.
  function placeFields() {
    const fields = document.querySelector(".scene-fields");
    const narrow = window.matchMedia("(max-width: 860px)").matches;
    const home = narrow ? $("scene") : $("scene-pic");
    if (fields.parentNode !== home) home.appendChild(fields);
  }

  // put stored values back in the typed fields (after loading or an example)
  function syncInputs() {
    $("massKg").value = S.massKg || "";
    $("winch").value = S.winch || "";
    $("anchorM").value = S.anchorM || "";
    $("anchorScene").value = S.anchorM || "";
    $("moveM").value = S.moveM || "";
    $("ropeLengthM").value = S.ropeLengthM || "";
    $("gradeDeg").value = S.gradeDeg || 0;
    $("ropeAngleDeg").value = S.ropeAngleDeg || 0;
    $("proxy").value = S.proxy || "";
  }

  // ------------------------------------------------------------ update
  function update() {
    R = compute();
    const { res } = R;

    document.querySelectorAll("#ground-chips .chip").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.ground === S.ground)));
    document.querySelectorAll("#bog-chips .chip").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.bog === S.bog)));
    document.querySelectorAll("#slope-dir button").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.dir === S.slopeDir)));
    document.querySelectorAll("#rope-type button").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.rope === S.ropeType)));
    document.querySelectorAll("#picker .pick").forEach((b) => b.setAttribute("aria-checked", String(+b.dataset.parts === S.parts)));
    const g = C.ground(S.ground);
    $("proxy-wrap").hidden = !(g && g.proxy);
    if (g && g.proxy) $("proxy-name").textContent = g.label.toLowerCase();
    const deg = numOr(S.gradeDeg, 0);
    $("grade-out").textContent = deg ? `${deg}° · ${U.n(Math.tan((deg * Math.PI) / 180) * 100, 1)}%` : "Flat";
    ["anchorM", "anchorScene"].forEach((id) => {
      if (document.activeElement !== $(id) && +$(id).value !== S.anchorM) $(id).value = S.anchorM || "";
    });
    const ra = numOr(S.ropeAngleDeg, 0);
    angleView.set(ra);
    $("angle-out").textContent = ra ? `${ra}° · +${U.n((1 / Math.cos((ra * Math.PI) / 180) - 1) * 100, 1)}%` : "Straight";
    $("winch-read").textContent = ratingText(R.rating);
    $("f-winch").classList.toggle("is-unclear", !R.rating.ok);

    if (res.incomplete) {
      const pos = sceneView.update({ look: g ? g.look : "mud", bog: S.bog, slopeDir: S.slopeDir, gradeDeg: deg, parts: S.parts, anchorM: S.anchorM, status: "idle" });
      place($("f-mass"), pos.massField);
      place($("f-winch"), pos.winchField);
      place($("f-anchor-scene"), pos.anchorField);
      const v = $("verdict");
      v.className = "verdict verdict--info";
      v.replaceChildren(el("div", { class: "verdict-top" }, U.statusIcon("incomplete"), el("p", { class: "verdict-head" },
        res.reason === "mass" ? "Type the vehicle's mass on the vehicle." : res.reason === "ground" ? "Pick the ground it's on." : `Pick the ground ${g.label.toLowerCase()} behaves most like.`)));
      ["gear", "readouts", "sizes", "stage-sources"].forEach((id) => $(id).replaceChildren());
      return;
    }
    renderScene(g, deg);
    renderVerdict();
    renderRig();
    renderPlay();
    renderSizes();
    renderRopes();
    $("stage-sources").replaceChildren(U.sourcesLine(["ground-factor", "bogged-axles", "bogged-chassis", "gradient", "line-angle", "safety-margin", "mechanical-advantage", "sheave-friction", "layer-pull", "min-wraps", "winch-chart", "power", "engine-running", "winch-size", "shackle-ratings"]));
  }

  function ratingText(r) {
    if (r.ok) {
      const lbTxt = U.n(Math.round(r.lb / 50) * 50, 1) + " lb";
      const kgTxt = U.kg(r.kg);
      if (r.how === "model-thousands") return `Read as ${lbTxt} (${kgTxt}): model numbers like this are thousands of lb. Check the label.`;
      if (r.how === "t-assumed") return `Read as ${U.n(r.kg / 1000, 0.01)} t: ${kgTxt}, ${lbTxt}`;
      if (r.how === "lb-assumed") return `Read as ${lbTxt} (${kgTxt})`;
      return `= ${lbTxt} · ${kgTxt}`;
    }
    if (r.how === "empty") return "Type the rating or model";
    return "Add a unit: 4.5 t, 9500 lb or 4300 kg";
  }

  // ------------------------------------------------------------ the scene
  function renderScene(g, deg) {
    const { res, cur } = R;
    const pos = sceneView.update({
      look: (res.ground.used || g).look,
      bog: S.bog,
      slopeDir: S.slopeDir,
      gradeDeg: deg,
      parts: S.parts,
      anchorM: R.anchorM,
      status: { ok: "ok", close: "close", short: "short", rope: "short", rolls: "rolls", idle: "idle" }[cur.status],
    });
    place($("f-mass"), pos.massField);
    place($("f-winch"), pos.winchField);
    place($("f-anchor-scene"), pos.anchorField);
  }
  function place(node, p) {
    node.style.left = p.left + "%";
    node.style.top = p.top + "%";
  }

  // ------------------------------------------------------------ verdict and balance
  function renderVerdict() {
    const { res, ang, cur, alts, rating, dr, mw, anchorM } = R;
    const name = winchName();
    const need = cur.rig.winchKg;
    const lineWord = ["", " with a double line", " with a triple line"][S.parts - 1];
    const status = cur.status;
    const p0 = cur.sim && cur.sim.points[0];
    const pEnd = cur.sim && cur.sim.points[cur.sim.points.length - 1];
    let head;
    let detail;
    let fix = null;
    if (status === "rolls") {
      head = "It would roll toward the anchor by itself";
      detail = "Downhill and steep enough that gravity beats the ground resistance. The winch's job is to control it, not pull it.";
    } else if (status === "idle") {
      head = `Pull needed in the rope: ${U.kg(need)}${lineWord}`;
      detail = `Type your winch on the picture to check it. WARN's rule for this vehicle: a winch rated at least ${U.lbMin(R.sizing.warnKg)}.`;
    } else if (status === "rope") {
      const maxAnchor = Math.floor((dr.ropeLengthM - mw.m) / S.parts);
      head = "The rope doesn't reach";
      detail = `${S.parts} line${S.parts > 1 ? "s" : ""} to an anchor ${U.n(anchorM, 0.1)} m away needs ${U.n(cur.ropeOutM, 0.1)} m of rope, but only ${U.n(dr.ropeLengthM - mw.m, 0.1)} m can leave the drum: ${mw.wraps} wraps must stay on (WARN).`;
      if (maxAnchor >= 1) fix = { text: `Use an anchor within ${maxAnchor} m`, patch: { anchorM: maxAnchor } };
    } else if (status === "ok") {
      head = `${name} can do it${lineWord}`;
      detail = `It keeps at least ${Math.round((cur.sim.minMargin - 1) * 100)}% more pull than needed, 25% margin included, from layer ${cur.sim.startLayer} to layer ${cur.sim.endLayer}.`;
    } else {
      const firstShort = cur.sim.points.find((p) => p.availKg < need);
      head = status === "close" ? "Close" : "Not enough winch";
      detail = status === "close"
        ? `${name} covers the estimate, but not all of the 25% margin${firstShort && firstShort.x > 0 ? ` once the rope builds up to layer ${firstShort.layer}` : ""}.`
        : `It needs ${U.kg(need)} in the rope; ${name} gives ${U.kg(firstShort.availKg)} on layer ${firstShort.layer}${firstShort.x > 0 ? `, after ${U.n(firstShort.x, 0.1)} m` : ""}.`;
      const better = alts.find((a) => a.parts > S.parts && a.status === "ok");
      if (better) fix = { text: `A ${["", "double", "triple"][better.parts - 1]} line would do it (${U.kg(better.rig.winchKg)} in the rope)`, patch: { parts: better.parts } };
      else if (S.parts < 3) fix = { text: "Even a triple line falls short here: cut the resistance first (I4WDTA: clear the wheels' path, use recovery boards, check tyre pressures, unload)", patch: null };
    }

    // balance: the rope pull needed, made of the load's parts, against what the winch gives
    const share = 1 / cur.rig.advantage;
    const parts = [
      { label: "Ground", kg: res.groundKg * share, cls: "seg-1" },
      { label: "Slope", kg: Math.max(res.gradeKg, 0) * share, cls: "seg-2" },
      { label: "Bogged to the chassis", kg: res.bogKg * share, cls: "seg-3" },
      { label: `Rope angle ${U.n(ang.angleDeg, 1)}°`, kg: (ang.ropeKg - res.totalKg) * share, cls: "seg-4" },
      { label: "25% margin", kg: res.marginKg * share, cls: "seg-margin" },
    ].filter((p) => p.kg > 0.5);
    const avail = p0 ? p0.availKg : 0;
    const max = Math.max(need, avail, 1) * 1.04;
    const segTotal = parts.reduce((s, p) => s + p.kg, 0) || 1;
    const needBar = el("div", { class: "bal-bar" },
      parts.map((p) => el("span", { class: "bal-seg " + p.cls, style: `width:${((p.kg / segTotal) * need / max) * 100}%`, title: `${p.label}: ${U.kg(p.kg)}` })),
      el("span", { class: "bal-tick", style: `left:${(need / (1 + MARGIN) / max) * 100}%`, title: "Without the 25% margin" }));
    const rows = [el("div", { class: "bal-row" }, el("span", { class: "bal-name" }, `Rope pull needed${lineWord}`), needBar, el("strong", { class: "bal-val" }, U.kg(need)))];
    if (avail) {
      rows.push(el("div", { class: "bal-row" }, el("span", { class: "bal-name" }, `${name}, layer ${p0.layer}`),
        el("div", { class: "bal-bar" }, el("span", { class: "bal-seg bal-winch", style: `width:${(avail / max) * 100}%` }),
          pEnd.layer !== p0.layer ? el("span", { class: "bal-end", style: `left:${(pEnd.availKg / max) * 100}%`, title: `Layer ${pEnd.layer} at the end: ${U.kg(pEnd.availKg)}` }) : null),
        el("strong", { class: "bal-val" }, U.kg(avail))));
    }
    const legend = el("ul", { class: "bal-legend" },
      parts.map((p) => el("li", null, el("span", { class: "swatch " + p.cls, "aria-hidden": "true" }), `${p.label} ${U.kg(p.kg)}`)),
      res.gradeKg < -0.5 ? el("li", null, `Downhill helps by ${U.kg(-res.gradeKg * share)}`) : null,
      pEnd && pEnd.layer !== p0.layer ? el("li", null, el("span", { class: "swatch swatch--end", "aria-hidden": "true" }), `Winch at the end, layer ${pEnd.layer}: ${U.kg(pEnd.availKg)}`) : null);

    const total = el("p", { class: "verdict-sub" },
      `To move it takes ${U.kg(res.totalKg)}, ${Math.round((res.totalKg / res.massKg) * 100)}% of its ${U.kg(res.massKg)}${S.parts > 1 ? `; ${S.parts} lengths of rope share that, less 8% friction per block` : ""}.`,
      ang.angleDeg > 0.5 ? ` With the rope ${U.n(ang.angleDeg, 1)}° off its path, the rope must pull ${U.kg(ang.ropeKg)} to move it, and pulls it ${U.kg(ang.sideKg)} sideways: that load goes into the tyres, the fairlead and the winch mount.` : "",
      res.ground.isProxy ? ` ${res.ground.chosen.label} is worked out as ${res.ground.used.label.toLowerCase()}: your choice, not a source.` : "",
      res.beyondMethod ? " Steeper than 45° is beyond I4WDTA's method." : "");

    let fixEl = null;
    if (fix && fix.patch) {
      fixEl = el("button", { type: "button", class: "fix" }, fix.text, " →");
      fixEl.addEventListener("click", () => {
        set(fix.patch);
        syncInputs();
      });
    } else if (fix) fixEl = el("p", { class: "fix fix--note" }, fix.text);
    const icon = { ok: "pass", close: "warn", short: "fail", rope: "fail", rolls: "info", idle: "info" }[status];
    const v = $("verdict");
    v.className = "verdict verdict--" + icon;
    v.replaceChildren(
      el("div", { class: "verdict-top" }, U.statusIcon(icon), el("div", null, el("p", { class: "verdict-head" }, head), el("p", { class: "verdict-detail" }, detail), fixEl)),
      el("div", { class: "balance" }, rows, legend),
      total);
  }

  // ------------------------------------------------------------ rigging
  function renderRig() {
    const { alts, cur, rating } = R;
    document.querySelectorAll("#picker .pick").forEach((b) => {
      const a = alts[+b.dataset.parts - 1];
      const st = a.status === "ok" ? "pass" : a.status === "close" ? "warn" : a.status === "short" || a.status === "rope" ? "fail" : null;
      // a ✕ next to a smaller pull would puzzle: say when it's the rope's length that fails
      b.querySelector(".pick-sub").replaceChildren(st ? U.statusIcon(st) : null, a.status === "rope" ? `rope too short at ${U.n(R.anchorM, 1)} m` : `winch pulls ${U.kg(a.rig.winchKg)}`);
      b.className = "pick" + (st ? " pick--" + st : "");
    });
    const box = $("rig");
    const d = V.rigging(cur.rig, box.clientWidth || 640, R.ang.angleDeg);
    const old = box.querySelector(".rigging-svg");
    if (old) old.replaceWith(d.el);
    else box.prepend(d.el);
    box.classList.toggle("is-moving", cur.status === "ok" || cur.status === "close");
    $("f-anchor").style.left = d.inputAt.x + "px";
    $("f-anchor").style.top = d.inputAt.y + "px";

    // what each piece of rigging must hold: now, and if the winch pulls its full rating
    const fullKg = rating.ok ? rating.kg : R.sizing.recommendedKg;
    const scale = fullKg / cur.rig.winchKg;
    const items = [];
    cur.rig.points.forEach((p, i) => {
      if (p.kind === "block") items.push({ name: `Block ${i + 1}`, where: p.at === "anchor" ? "at the anchor" : "on the vehicle", kg: p.loadKg });
    });
    items.push({ name: "Tree protector", where: "and the anchor", kg: cur.rig.anchorKg });
    const end = cur.rig.points[cur.rig.points.length - 1];
    if (end.at === "vehicle") items.push({ name: "Rope end", where: "on a recovery point", kg: end.loadKg });
    $("gear").replaceChildren(...items.map((it) => {
      const full = it.kg * scale;
      const sh = C.shackleFor(full);
      return el("li", { class: "gear-item" },
        el("span", { class: "gear-name" }, it.name, el("small", null, it.where)),
        el("span", { class: "gear-load" }, U.kg(it.kg), el("small", null, `${U.kg(full)} at full winch pull`)),
        el("span", { class: "gear-shackle" + (sh ? "" : " is-over") }, sh ? `${sh.size} shackle` : "Over 8.5 t", el("small", null, sh ? `${U.tonnes(sh.wllT)} WLL (Crosby)` : "rated rigging only")));
    }));
  }

  // ------------------------------------------------------------ the pull, metre by metre
  function renderPlay() {
    const { cur, dr, mw } = R;
    const key = dr.ropeLengthM + "|" + S.ropeType;
    if (key !== drumKey) {
      drumView = V.drum(dr, mw.m);
      $("drum").replaceChildren(drumView.el);
      drumKey = key;
    }
    const sim = cur.sim;
    $("play-part").classList.toggle("is-empty", !sim);
    if (!sim) {
      stopPlay();
      const startOn = dr.ropeLengthM - Math.min(cur.ropeOutM, dr.ropeLengthM);
      drumView.set(startOn, startOn);
      $("drum-layer").textContent = `Starts on layer ${cur.startLayer.n}: ${Math.round(cur.startLayer.ratio * 100)}% of rated pull`;
      gaugeView.setScale(400);
      gaugeView.set(0);
      $("amps-now").textContent = "– A";
      $("chart-pull").replaceChildren(el("p", { class: "muted play-empty" }, cur.status === "rolls" ? "Downhill: nothing to pull." : "Type your winch on the picture above to play the pull."));
      $("power-now").replaceChildren();
      $("readouts").replaceChildren();
      charts = [];
      return;
    }
    gaugeView.setScale(sim.peakAmps);
    const w = $("chart-pull").clientWidth || 600;
    const tipLines = (p) => [`${U.n(p.x, 0.1)} m moved · layer ${p.layer}`, `Winch can pull ${U.kg(p.availKg)}`, `Needed ${U.kg(p.neededKg)}`, `${U.n(p.amps, 1)} A · rope ${U.n(p.lineSpeedMMin, 0.1)} m/min`, `${U.n(p.elecKw, 0.1)} kW drawn · ${U.n(p.ropeKw, 0.01)} kW at the rope`];
    const pullChart = V.lineChart({
      width: w, height: 200, points: sim.points, yUnit: "kg", xLabel: "Metres the vehicle has moved", labelEnds: true, tip: tipLines,
      series: [
        { key: "availKg", cls: "ch-line--avail", step: true, label: "Winch can pull", short: "Winch" },
        { key: "neededKg", cls: "ch-line--need", label: "Pull needed", short: "Needed" },
      ],
      aria: "Pull the winch can give, layer by layer, against the rope pull needed, over the distance pulled",
    });
    $("chart-pull").replaceChildren(el("p", { class: "chart-title" }, el("span", { class: "key key--avail" }), "Winch can pull ", el("span", { class: "key key--need" }), "Pull needed"), pullChart.el);
    charts = [pullChart];
    play.peakKw = sim.peakKw;

    live = {};
    const tile = (key, label) => {
      live[key] = { value: el("strong", { class: "readout-value" }), sub: el("span", { class: "readout-sub" }) };
      return el("div", { class: "readout readout--live" }, el("span", { class: "readout-label" }, label), live[key].value, live[key].sub);
    };
    $("readouts").replaceChildren(
      tile("amps", "Amps drawn now"),
      tile("ah", "Drawn so far"),
      tile("kw", "Power now"),
      tile("time", "Winching time"),
      tile("moved", "Vehicle moved"),
      el("p", { class: "readout-note" }, "These count up as the pull plays. Current and speed from WARN's published ZEON 10 chart, scaled to your winch's rating, at its 12 V; the drum and rope drawn are the ZEON 10's. Yours will be similar, not identical. The pull needed is held steady all the way, which is cautious: it usually drops once the vehicle is free. Run the engine while winching (WARN), and check your manual's duty cycle.")
    );
    if (!play.raf) frame(play.x === null ? R.moveM : Math.min(play.x, R.moveM));
  }

  // live power: what the winch draws, what reaches the rope, and the difference lost as heat
  function renderPower(p) {
    const max = Math.max(play.peakKw || p.elecKw, 0.1);
    const lost = Math.max(p.elecKw - p.ropeKw, 0);
    const row = (cls, label, kw) => el("div", { class: "pw-row" },
      el("span", { class: "pw-label" }, label),
      el("span", { class: "pw-bar" }, el("span", { class: "pw-fill " + cls, style: `width:${(kw / max) * 100}%` })),
      el("strong", { class: "pw-val" }, `${U.n(kw, kw < 1 ? 0.01 : 0.1)} kW`));
    $("power-now").replaceChildren(
      el("p", { class: "box-title pw-title" }, "Power"),
      row("pw-fill--elec", "Drawn", p.elecKw),
      row("pw-fill--rope", "At the rope", p.ropeKw),
      el("p", { class: "pw-note" }, `${U.n(lost, 0.1)} kW lost as heat (${p.elecKw > 0 ? Math.round((p.ropeKw / p.elecKw) * 100) : 0}% reaches the rope)`));
  }

  function readout(label, value, sub) {
    return el("div", { class: "readout" }, el("span", { class: "readout-label" }, label), el("strong", { class: "readout-value" }, value), el("span", { class: "readout-sub" }, sub));
  }

  // show the pull at distance x
  function frame(x) {
    const sim = R && R.cur && R.cur.sim;
    if (!sim) return;
    const pts = sim.points;
    let i = 0;
    while (i < pts.length - 1 && pts[i + 1].x <= x) i++;
    const p = pts[i];
    const onDrum = pts[0].onDrumM + S.parts * x;
    drumView.set(onDrum, pts[0].onDrumM);
    const layer = C.layerAt(R.dr, onDrum);
    $("drum-layer").textContent = `Layer ${layer.n}: ${Math.round(layer.ratio * 100)}% of rated pull`;
    gaugeView.set(p.amps);
    $("amps-now").textContent = `${U.n(p.amps, 1)} A`;
    renderPower(p);
    // time and charge add up between steps, so interpolate them
    const q = pts[Math.min(i + 1, pts.length - 1)];
    const f = q.x === p.x ? 0 : Math.max(0, Math.min(1, (x - p.x) / (q.x - p.x)));
    const t = p.t + f * (q.t - p.t);
    const ah = p.ah + f * (q.ah - p.ah);
    const volts = D.rule("power").params.volts;
    const setLive = (k, v, sub) => {
      if (!live[k]) return;
      live[k].value.textContent = v;
      live[k].sub.textContent = sub;
    };
    setLive("amps", `${U.n(p.amps, 1)} A`, `peak ${U.n(sim.peakAmps, 1)} A, on layer ${sim.peakPoint.layer}`);
    setLive("ah", `${U.n(ah, 0.1)} Ah`, `${U.n(ah * volts, 1)} Wh, of ${U.n(sim.ah, 0.1)} Ah for the whole pull`);
    setLive("kw", `${U.n(p.elecKw, 0.1)} kW`, `${U.n(p.ropeKw, 0.01)} kW reaches the rope`);
    setLive("time", `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`, `of ${Math.floor(sim.timeS / 60)}:${String(Math.round(sim.timeS % 60)).padStart(2, "0")} min`);
    setLive("moved", `${U.n(x, 0.1)} m`, `of ${U.n(R.moveM, 0.1)} m · ${U.n(S.parts * x, 0.1)} m of rope wound in`);
    charts.forEach((c) => c.setPlayhead(x));
    play.x = x;
  }

  function startPlay() {
    const sim = R && R.cur && R.cur.sim;
    if (!sim) return;
    if (play.raf) cancelAnimationFrame(play.raf);
    const dur = 6000;
    const from = play.x === null || play.x >= R.moveM - 1e-6 ? 0 : play.x;
    const t0 = performance.now() - (from / R.moveM) * dur;
    $("play").textContent = "❚❚ Pause";
    $("play-part").classList.add("is-playing");
    const step = (now) => {
      const f = Math.min(1, (now - t0) / dur);
      frame(f * R.moveM);
      if (f < 1) play.raf = requestAnimationFrame(step);
      else stopPlay();
    };
    play.raf = requestAnimationFrame(step);
  }
  function stopPlay() {
    if (play.raf) cancelAnimationFrame(play.raf);
    play.raf = 0;
    $("play").textContent = play.x !== null && R && play.x < R.moveM - 1e-6 ? "▶ Carry on" : "▶ Play the pull";
    $("play-part").classList.remove("is-playing");
  }

  // ------------------------------------------------------------ winch size, layer by layer
  function winchName() {
    // a model name reads as itself ("EW9500"); a bare rating as "A 4.5 t winch"
    const typed = (S.winch || "").trim();
    if (!R.rating.ok) return "Your winch";
    return /[a-z]{2,}/i.test(typed.replace(/\b(lbs?|kgs?|kn|tonnes?|tons?)\b/gi, "")) ? typed : `A ${typed} winch`;
  }

  function renderSizes() {
    const { sizing, rating, dr, cur } = R;
    const need = cur.rig.winchKg;
    const from = cur.sim ? cur.sim.startLayer : cur.startLayer.n;
    const to = cur.sim ? cur.sim.endLayer : cur.startLayer.n;
    const used = (n) => n >= from && n <= to;
    const lineWord = ["single line", "double line", "triple line"][S.parts - 1];
    const usedText = from === to ? `layer ${from}` : `layers ${from} to ${to}`;

    // the minimum rating, and where it comes from
    const rule = el("div", { class: "size-rule" },
      el("div", { class: "size-fig" }, el("span", { class: "size-big" }, U.lbMin(sizing.recommendedKg)), el("span", { class: "size-unit" }, `minimum rating · ${U.kgMin(sizing.recommendedKg)}`)),
      el("p", null, `The bigger of two figures: WARN's rule of 1.5 × the vehicle's mass (${U.lbMin(sizing.warnKg)}), and what this pull needs (${U.lbMin(sizing.neededKg)}: the ${U.kg(need)} rope pull on layer ${cur.startLayer.n}, where a winch gives ${Math.round(cur.startLayer.ratio * 100)}% of its rating).`));

    // your winch, layer by layer, against the pull needed
    let mine = null;
    if (rating.ok) {
      const max = Math.max(rating.kg, need) * 1.06;
      mine = el("div", { class: "layers" },
        el("p", { class: "layers-title" }, `${winchName()}, layer by layer`),
        dr.layers.map((l) => {
          const kg = rating.kg * l.ratio;
          const ok = kg >= need;
          return el("div", { class: "layer-row" + (used(l.n) ? " is-used" : "") },
            el("span", { class: "layer-name" }, `Layer ${l.n}`, el("small", null, l.n === 1 ? "bare drum" : `${l.n - 1} under it`)),
            el("div", { class: "layer-bar" },
              el("span", { class: "layer-fill " + (ok ? "is-ok" : "is-short"), style: `width:${(kg / max) * 100}%` }),
              el("span", { class: "layer-need", style: `left:${(need / max) * 100}%` })),
            el("span", { class: "layer-val layer-val--" + (ok ? "pass" : "fail") }, U.statusIcon(ok ? "pass" : "fail"), U.kg(kg)),
            el("span", { class: "layer-tag" }, used(l.n) ? "used in this pull" : ""));
        }),
        el("p", { class: "hint" }, `The white line is the ${U.kg(need)} this pull needs in the rope (${lineWord}, 25% margin included). A winch is rated on layer 1, the bare drum; every layer of rope wound on top makes the drum fatter and the pull weaker. This pull uses ${usedText}: the rope starts there and winds on as the vehicle comes out.`));
    }

    // common sizes: a box per layer, outlined where this pull happens
    const sizesLb = D.commonWinchesLb.slice();
    if (rating.ok && !sizesLb.some((lb) => Math.abs(rating.lb - lb) < 1)) sizesLb.push(Math.round(rating.lb));
    sizesLb.sort((x, y) => x - y);
    const chips = sizesLb.map((lb) => {
      const kg = C.lbToKg(lb);
      const boxes = dr.layers.map((l) => {
        const ok = kg * l.ratio >= need;
        return el("span", { class: "layer-box layer-box--" + (ok ? "pass" : "fail") + (used(l.n) ? " is-used" : ""), title: `Layer ${l.n}: ${U.kg(kg * l.ratio)} ${ok ? "≥" : "<"} ${U.kg(need)}` }, String(l.n));
      });
      const copes = dr.layers.filter((l) => used(l.n)).every((l) => kg * l.ratio >= need);
      const mineChip = rating.ok && Math.abs(rating.lb - lb) < 1;
      return el("li", { class: "size" + (copes ? " size--ok" : " size--no") + (mineChip ? " size--mine" : "") },
        el("span", { class: "size-head" }, el("strong", null, U.n(lb, 1) + " lb"), el("span", { class: "size-say" }, copes ? "copes" : "too small")),
        el("small", null, U.kg(kg) + (kg >= sizing.warnKg ? " · meets WARN's rule" : "")),
        el("span", { class: "layer-boxes" }, boxes));
    });

    // your winch, first: what it is, whether it copes, and how it compares with the minimum
    let yours;
    if (rating.ok) {
      const tone = { ok: "pass", close: "warn", short: "fail", rope: "fail", rolls: "info", idle: "info" }[cur.status];
      const say = {
        ok: `Copes with this pull (${lineWord})`,
        close: "Close: covers the estimate, not the full 25% margin",
        short: `Too small for this pull with a ${lineWord}`,
        rope: "Strong enough, but the rope doesn't reach the anchor",
        rolls: "Nothing to pull: it rolls downhill by itself",
        idle: "",
      }[cur.status];
      const diffLb = rating.lb - C.kgToLb(sizing.recommendedKg);
      yours = el("div", { class: "your-winch your-winch--" + tone },
        el("div", { class: "yw-id" },
          el("span", { class: "yw-label" }, "Your winch"),
          el("strong", { class: "yw-name" }, (S.winch || "").trim()),
          el("span", { class: "yw-rating" }, `${U.n(Math.round(rating.lb / 50) * 50, 1)} lb · ${U.kg(rating.kg)}`)),
        el("div", { class: "yw-says" },
          el("p", { class: "yw-verdict" }, U.statusIcon(tone), say),
          el("p", { class: "yw-vs" }, diffLb >= -0.5
            ? `Meets the ${U.lbMin(sizing.recommendedKg)} minimum rating below.`
            : `${U.n(Math.ceil(-diffLb / 50) * 50, 1)} lb under the ${U.lbMin(sizing.recommendedKg)} minimum rating below.`)));
    } else {
      yours = el("div", { class: "your-winch your-winch--info" },
        el("div", { class: "yw-id" }, el("span", { class: "yw-label" }, "Your winch"), el("strong", { class: "yw-name" }, "Not filled in")),
        el("div", { class: "yw-says" }, el("p", { class: "yw-verdict" }, "Type your winch's model or rating on the picture at the top (\"EW9500\", \"4.5 t\") to check it here.")));
    }

    $("sizes").replaceChildren(
      yours,
      rule,
      mine,
      el("p", { class: "layers-title" }, `Common winch sizes, ${lineWord}`),
      el("ul", { class: "sizes" }, chips),
      el("p", { class: "hint" }, `Each numbered box is a layer of rope on the drum: green has enough pull for this ${lineWord}, red doesn't. Outlined boxes are the layers this pull uses (${usedText}). A winch copes when all of them are green.`)
    );
  }

  // ------------------------------------------------------------ synthetic winch rope, side by side
  function renderRopes() {
    const { rating, cur } = R;
    const T = D.synthRopes;
    const factor = D.rule("rope-wll").params.factor;
    const winchKg = rating.ok ? rating.kg : null; // the most the winch can put in the rope: its rating, layer 1
    const needKg = cur.rig.winchKg;
    const maxKg = Math.max(...T.ropes.flatMap((r) => T.sizesMm.map((mm) => (r.t[mm] || 0) * 1000)), winchKg || 0) * 1.04;
    const pct = (kg) => (kg / maxKg) * 100;
    const marks = [
      winchKg ? el("span", { class: "rp-mark rp-mark--winch", style: `left:${pct(winchKg)}%`, title: `Your winch's full pull: ${U.kg(winchKg)}` }) : null,
      el("span", { class: "rp-mark rp-mark--need", style: `left:${pct(needKg)}%`, title: `This pull: ${U.kg(needKg)} in the rope` }),
    ];

    const rows = T.sizesMm.map((mm) => el("div", { class: "rp-size" },
      el("span", { class: "rp-mm" }, `${mm} mm`),
      el("div", { class: "rp-bars" }, T.ropes.map((r) => {
        const t = r.t[mm];
        if (t === null) return el("div", { class: "rp-row" }, el("span", { class: "rp-name" }, r.name), el("span", { class: "rp-none" }, "not in the maker's table"));
        const kg = t * 1000;
        return el("div", { class: "rp-row" },
          el("span", { class: "rp-name" }, r.name),
          el("span", { class: "rp-track" },
            el("span", { class: "rp-fill rp-fill--" + r.id, style: `width:${pct(kg)}%` },
              el("span", { class: "rp-wll rp-wll--" + r.id, style: `width:${100 / factor}%` })),
            marks.map((m) => m && m.cloneNode(true))),
          el("span", { class: "rp-val" }, el("strong", null, U.tonnes(t)), el("small", null, `WLL ${U.tonnes(t / factor)}`)));
      }))));

    const head = el("tr", null, el("th", { scope: "col" }, "Size"),
      T.ropes.map((r) => [el("th", { scope: "col", class: "num" }, `${r.name} strength`), el("th", { scope: "col", class: "num" }, "WLL (÷ 5)"), winchKg ? el("th", { scope: "col", class: "num" }, "× your winch") : null]));
    const body = T.sizesMm.map((mm) => el("tr", null,
      el("th", { scope: "row" }, `${mm} mm`),
      T.ropes.map((r) => r.t[mm] === null
        ? [el("td", { class: "num muted" }, "–"), el("td", { class: "num muted" }, "–"), winchKg ? el("td", { class: "num muted" }, "–") : null]
        : [el("td", { class: "num" }, U.tonnes(r.t[mm])), el("td", { class: "num" }, U.tonnes(r.t[mm] / factor)), winchKg ? el("td", { class: "num" }, `${U.n((r.t[mm] * 1000) / winchKg, 0.1)}×`) : null])));

    $("ropes").replaceChildren(
      el("p", { class: "panel-intro muted" }, "Two 12-strand Dyneema-type ropes at winch sizes, as their makers publish them: Southern Ropes' GP-12 (made in Cape Town) and Samson's AmSteel-Blue. Each bar is the rope's breaking strength (spliced); the solid part is its working load limit, the strength ÷ 5, which is Samson's guidance for rope in normal use."),
      el("ul", { class: "rp-legend" },
        T.ropes.map((r) => el("li", null, el("span", { class: "swatch rp-sw--" + r.id, "aria-hidden": "true" }), `${r.name} (${r.maker}), ${r.basis}`)),
        el("li", null, el("span", { class: "swatch rp-sw--wll", "aria-hidden": "true" }), "solid: WLL, strength ÷ 5"),
        winchKg ? el("li", null, el("span", { class: "rp-key rp-key--winch", "aria-hidden": "true" }), `your winch's full pull, ${U.kg(winchKg)}`) : null,
        el("li", null, el("span", { class: "rp-key rp-key--need", "aria-hidden": "true" }), `this pull, ${U.kg(needKg)} in the rope`)),
      el("div", { class: "rp-chart" }, rows),
      el("div", { class: "table-wrap" }, el("table", { class: "limit-table rp-table" }, el("thead", null, head), el("tbody", null, body))),
      el("p", { class: "hint" }, `Your winch can put its full rated pull${winchKg ? ` (${U.kg(winchKg)})` : ""} into the rope on the first layer, so that's the most the rope should see in a steady pull. At 5:1 none of these sizes has a WLL that high; the "× your winch" columns show how many times stronger than your winch's pull each rope is. We found no rope or winch maker's published design factor specifically for winch lines. Samson says working loads don't apply after shock loading (a snatched or jerked rope), and to use a higher factor where life, limb or property are at risk. Synthetic rope needs 10 wraps left on the drum (WARN). GP-12's sheet doesn't say whether its figures are minimum or average strengths.`),
      U.sourcesLine(["synthetic-rope", "rope-wll", "min-wraps"])
    );
  }

  // ------------------------------------------------------------ explainers
  function renderExplainers() {
    const fill = (id, ...children) => document.querySelector(`#${id} .explainer-body`).replaceChildren(...children);
    fill("explain-layers",
      el("p", null, D.rule("layer-pull").summary),
      el("p", null, "Anchoring further away pays out more rope, which keeps the pull on a lower layer. On the outer layers the rope also comes in faster, and the motor draws more current for the same pull."),
      U.sourcesLine(["layer-pull", "winch-chart"]));
    fill("explain-mbs",
      el("p", null, D.rule("wll-mbs").summary),
      el("p", null, "Rig for what the winch can do, not just what this pull needs: if something snags, the winch can pull its full rating. The list under the rope diagram shows both loads."),
      U.sourcesLine(["wll-mbs", "shackle-ratings"]));
    fill("explain-gaps",
      el("p", null, "Where no engineering source, standard or maker publishes a figure, this page says so rather than filling the gap with a rule of thumb."),
      el("ul", null, D.gaps.map((x) => el("li", null, el("strong", null, x.title + ": "), x.text))));
  }

  // ------------------------------------------------------------ go
  build();
  update();
  // play the pull once when it first comes into view
  if (!reduceMotion && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        play.x = 0;
        startPlay();
      }
    }, { threshold: 0.35 });
    io.observe($("play-part"));
  }
})();
