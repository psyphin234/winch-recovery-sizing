/*
 * diagrams.js: the page's pictures, built from calc.js results.
 *   scene       side view of the stuck vehicle, the winch and the anchor. Built once and
 *               updated in place, so slope, bogging and arrows animate between states.
 *   lineThumb   small picture of a single, double or triple line run (the rope picker)
 *   rigging     top view of the rope run: pull on each length, load on each block and the anchor
 *   drum        the drum in cross-section, one circle per wrap, filling as rope winds in
 *   gauge       current-draw dial
 *   lineChart   one chart (pull available vs needed, or current) with a playhead and tooltip
 * Text stays in text colours; series colours only mark identity (--series-* in style.css).
 * Ground colours in the scene are illustration, not data.
 */
(function (root) {
  "use strict";

  const U = root.WINCH_UI;
  const { el } = U;
  const NS = "http://www.w3.org/2000/svg";

  function svg(tag, attrs, ...children) {
    const node = document.createElementNS(NS, tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== false) node.setAttribute(k, v);
    });
    children.flat(Infinity).forEach((c) => {
      if (c === null || c === undefined || c === false) return;
      node.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c);
    });
    return node;
  }

  // One tooltip element shared by every chart on the page.
  let tip = null;
  function showTip(lines, clientX, clientY) {
    if (!tip) {
      tip = el("div", { class: "viz-tip", role: "presentation", hidden: true });
      document.body.appendChild(tip);
    }
    tip.replaceChildren(...lines.map((l, i) => el(i === 0 ? "strong" : "span", null, l)));
    tip.hidden = false;
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    const x = Math.min(window.innerWidth - w - 8, Math.max(8, clientX + 14));
    const y = clientY - h - 12 < 8 ? clientY + 16 : clientY - h - 12;
    tip.style.left = x + window.scrollX + "px";
    tip.style.top = y + window.scrollY + "px";
  }
  function hideTip() {
    if (tip) tip.hidden = true;
  }

  // ------------------------------------------------------------ ground looks (illustration only)
  const LOOKS = {
    road: { base: "#2b2e33", edge: "#5d636b", dots: ["#3a3e44", "#24272b"], kind: "speckle" },
    gravel: { base: "#6a6459", edge: "#9a9386", dots: ["#8b8478", "#544f46", "#a39b8d"], kind: "stones" },
    grass: { base: "#3d5b2c", edge: "#6f9a48", dots: ["#34502a", "#4a6c35"], kind: "speckle", blades: true },
    sand: { base: "#c69a5c", edge: "#e2bd84", dots: ["#b3874d"], kind: "ripple" },
    wetsand: { base: "#8b6943", edge: "#a98458", dots: ["#78593a"], kind: "ripple" },
    shingle: { base: "#76736c", edge: "#a5a29a", dots: ["#8f8c85", "#615e58", "#a8a59e"], kind: "pebbles" },
    mud: { base: "#5a4030", edge: "#7a5a44", dots: ["#4a3326", "#6a4e3b"], kind: "blobs" },
    deepmud: { base: "#3f281b", edge: "#5e4130", dots: ["#321f15", "#56392a"], kind: "blobs", gloss: true },
    clay: { base: "#94532d", edge: "#b8724a", dots: ["#7f4626", "#a5603a"], kind: "streaks" },
    snow: { base: "#d9e3ec", edge: "#f4f8fb", dots: ["#c3d1de", "#e8eef4"], kind: "speckle" },
    rock: { base: "#63666b", edge: "#8d9096", dots: ["#4d5055", "#777a80"], kind: "cracks" },
  };

  function groundPattern(id, look) {
    const L = LOOKS[look];
    const p = svg("pattern", { id, width: 48, height: 48, patternUnits: "userSpaceOnUse" }, svg("rect", { width: 48, height: 48, fill: L.base }));
    const d = L.dots;
    const add = (n) => p.appendChild(n);
    if (L.kind === "speckle") [[6, 8], [30, 4], [18, 22], [40, 30], [8, 38], [28, 42]].forEach(([x, y], i) => add(svg("circle", { cx: x, cy: y, r: 1.6, fill: d[i % d.length] })));
    if (L.kind === "stones") [[6, 8, 3], [30, 6, 2.5], [18, 22, 3.5], [40, 30, 2.6], [8, 38, 2.4], [30, 42, 3]].forEach(([x, y, r], i) => add(svg("circle", { cx: x, cy: y, r, fill: d[i % d.length] })));
    if (L.kind === "pebbles") [[8, 8], [30, 10], [18, 26], [40, 32], [8, 40], [28, 44]].forEach(([x, y], i) => add(svg("ellipse", { cx: x, cy: y, rx: 6, ry: 3.6, fill: d[i % d.length] })));
    if (L.kind === "ripple") [10, 26, 42].forEach((y) => add(svg("path", { d: `M0 ${y} q12 -5 24 0 t24 0`, fill: "none", stroke: d[0], "stroke-width": 1.6 })));
    if (L.kind === "blobs") [[10, 10, 7, 3], [34, 18, 9, 3.5], [16, 34, 8, 3], [40, 42, 6, 2.5]].forEach(([x, y, rx, ry], i) => add(svg("ellipse", { cx: x, cy: y, rx, ry, fill: d[i % d.length] })));
    if (L.kind === "streaks") [8, 24, 40].forEach((y, i) => add(svg("path", { d: `M${i * 6} ${y} h30`, stroke: d[i % d.length], "stroke-width": 2, "stroke-linecap": "round" })));
    if (L.kind === "cracks") {
      add(svg("path", { d: "M0 14 L14 18 L22 10 L36 16 L48 12 M10 48 L18 34 L30 38 L40 28", fill: "none", stroke: d[0], "stroke-width": 1.4 }));
      add(svg("path", { d: "M22 10 L30 20 L44 22 L36 16 Z", fill: d[1] }));
    }
    if (L.gloss) add(svg("path", { d: "M6 6 q6 -2 12 0", stroke: "#7a5a46", "stroke-width": 1.2, fill: "none" }));
    return p;
  }

  // ------------------------------------------------------------ the scene (side view)
  /*
   * World coordinates: viewBox 800 x 380, ground line y = 290, the world turns
   * about (420, 290) for the slope and shrinks a little on steep slopes so the
   * tree stays in view. The vehicle faces right; the anchor tree is on the right.
   * Inputs and labels are HTML overlays placed with the returned positions.
   */
  function scene() {
    const VW = 800;
    const VH = 380;
    const PX = 420;
    const PY = 290;
    const SINK = { none: 4, axles: 32, chassis: 47 };

    const defs = svg("defs", null,
      svg("linearGradient", { id: "sc-sky", x1: 0, y1: 0, x2: 0, y2: 1 },
        svg("stop", { offset: "0", "stop-color": "#0a0e13" }),
        svg("stop", { offset: "1", "stop-color": "#18212b" })),
      svg("pattern", { id: "sc-blades", width: 10, height: 10, patternUnits: "userSpaceOnUse" },
        svg("path", { d: "M1 10 L3 2 L4 10 M5 10 L7 4 L8 10", fill: "#6f9a48" })),
      Object.keys(LOOKS).map((k) => groundPattern("sc-g-" + k, k))
    );

    // far hills, so the slope reads against something fixed
    const backdrop = svg("g", { class: "sc-back" },
      svg("rect", { width: VW, height: VH, fill: "url(#sc-sky)" }),
      svg("path", { d: "M0 250 Q120 200 230 232 T470 214 T800 226 L800 380 L0 380 Z", class: "sc-hill" }),
      svg("path", { d: "M0 300 Q160 262 330 286 T800 276 L800 380 L0 380 Z", class: "sc-hill sc-hill--near" })
    );

    const tree = svg("g", { class: "sc-tree" },
      svg("rect", { x: 694, y: 122, width: 26, height: 176, rx: 6, class: "sc-trunk" }),
      svg("circle", { cx: 680, cy: 108, r: 44, class: "sc-leaf" }),
      svg("circle", { cx: 728, cy: 96, r: 40, class: "sc-leaf sc-leaf--2" }),
      svg("circle", { cx: 706, cy: 64, r: 38, class: "sc-leaf" }),
      svg("rect", { x: 690, y: 232, width: 34, height: 14, rx: 3, class: "sc-strap" })
    );

    const ropes = svg("g", { class: "sc-ropes" });

    // vehicle: outer group sinks, inner group creeps forward while winching
    const wheel = (cx) => svg("g", { class: "sc-wheel" },
      svg("circle", { cx, cy: 258, r: 32, class: "sc-tyre" }),
      svg("circle", { cx, cy: 258, r: 18, class: "sc-rim" }),
      [0, 72, 144, 216, 288].map((a) => svg("line", { x1: cx, y1: 258, x2: cx + 15 * Math.cos((a * Math.PI) / 180), y2: 258 + 15 * Math.sin((a * Math.PI) / 180), class: "sc-spoke" })),
      svg("circle", { cx, cy: 258, r: 4, class: "sc-hub" }));
    const vehicleInner = svg("g", { class: "sc-veh-inner" },
      svg("path", { class: "sc-body", d: "M186 252 L186 206 Q186 196 196 195 L292 192 L320 151 Q325 145 333 145 L400 145 Q408 145 412 151 L434 190 L450 194 Q458 196 458 206 L458 252 Q458 256 454 256 L186 256 Z" }),
      svg("path", { class: "sc-glass", d: "M302 190 L326 156 Q329 152 335 152 L362 152 L362 190 Z" }),
      svg("path", { class: "sc-glass", d: "M370 152 L398 152 Q404 152 407 157 L428 190 L370 190 Z" }),
      svg("rect", { x: 334, y: 138, width: 66, height: 5, rx: 2, class: "sc-rack" }),
      svg("rect", { x: 456, y: 226, width: 22, height: 28, rx: 4, class: "sc-bar" }),
      svg("rect", { x: 448, y: 232, width: 14, height: 18, rx: 3, class: "sc-winch" }),
      wheel(250),
      wheel(396)
    );
    const vehicle = svg("g", { class: "sc-veh" }, vehicleInner);

    // ground, drawn over the vehicle so a bogged vehicle sinks into it
    const groundFill = svg("rect", { x: -700, y: PY, width: 2200, height: 700, class: "sc-ground" });
    const groundEdge = svg("line", { x1: -700, y1: PY, x2: 1500, y2: PY, class: "sc-edge" });
    const blades = svg("rect", { x: -700, y: PY - 8, width: 2200, height: 9, fill: "url(#sc-blades)", class: "sc-blades" });
    const mounds = svg("g", { class: "sc-mounds" },
      [250, 396].map((x) => [svg("ellipse", { cx: x - 30, cy: PY, rx: 26, ry: 9 }), svg("ellipse", { cx: x + 30, cy: PY, rx: 26, ry: 9 })]));
    const ground = svg("g", { class: "sc-groundg" }, groundFill, mounds, blades, groundEdge);

    // force arrows: drawn 100 units long, stretched by a CSS transform so they animate
    const LOAD_X = 180;
    const LOAD_Y = 214;
    const WIN_X = 484;
    const WIN_Y = 192;
    const loadSegs = ["seg-1", "seg-2", "seg-3", "seg-4", "seg-margin"].map((c) => svg("rect", { y: -8, height: 16, class: "sc-seg " + c }));
    const loadBar = svg("g", { class: "sc-arrow" }, loadSegs);
    const loadHead = svg("path", { d: "M0 -14 L-18 0 L0 14 Z", class: "sc-arrow sc-head--load" });
    const winBar = svg("g", { class: "sc-arrow" }, svg("rect", { x: 0, y: -6, width: 100, height: 12, class: "sc-winbar" }));
    const winHead = svg("path", { d: "M0 -12 L16 0 L0 12 Z", class: "sc-arrow sc-head--winch" });
    const arrows = svg("g", { class: "sc-arrows" }, loadBar, loadHead, winBar, winHead);

    const world = svg("g", { class: "sc-world" }, tree, ropes, vehicle, ground, arrows);
    const node = svg("svg", { class: "scene-svg", viewBox: `0 0 ${VW} ${VH}`, role: "img", "aria-label": "Side view of the stuck vehicle, its winch and the anchor tree" }, defs, backdrop, world);

    let st = { sink: SINK.none, scale: 1, angle: 0 };

    function drawRopes(parts) {
      const ys = parts === 1 ? [241] : parts === 2 ? [237, 247] : [234, 241, 248];
      const kids = ys.map((y, i) => svg("line", { x1: 462, y1: y, x2: parts > 1 ? 676 : 690, y2: 241 + (y - 241) * 0.3, class: "sc-rope" + (i % 2 ? " sc-rope--back" : "") }));
      if (parts > 1) kids.push(svg("line", { x1: 685, y1: 241, x2: 694, y2: 239, class: "sc-blockstrap" }), svg("circle", { cx: 676, cy: 241, r: 9, class: "sc-block" }));
      if (parts > 2) kids.push(svg("circle", { cx: 470, cy: 245, r: 7, class: "sc-block" }));
      ropes.replaceChildren(...kids);
    }

    // world point -> position in the scene box, in percent
    function toPercent(x, y, onVehicle) {
      const yy = onVehicle ? y + st.sink : y;
      const dx = (x - PX) * st.scale;
      const dy = (yy - PY) * st.scale;
      const sx = PX + dx * Math.cos(st.angle) - dy * Math.sin(st.angle);
      const sy = PY + dx * Math.sin(st.angle) + dy * Math.cos(st.angle);
      return { left: (sx / VW) * 100, top: (sy / VH) * 100 };
    }

    /*
     * s: { look, bog, slopeDir, gradeDeg, parts, loadKg, segments[5], availKg, status }
     * Returns where the overlays go: the load and winch labels, the mass and winch inputs.
     */
    function update(s) {
      const deg = Math.max(0, Math.min(45, s.gradeDeg || 0));
      const sign = s.slopeDir === "down" ? 1 : -1;
      st = { sink: SINK[s.bog] || SINK.none, angle: (sign * deg * Math.PI) / 180, scale: 1 - 0.3 * (deg / 45) };
      world.style.transform = `rotate(${sign * deg}deg) scale(${st.scale})`;
      vehicle.style.transform = `translateY(${st.sink}px)`;
      const look = LOOKS[s.look] ? s.look : "mud";
      groundFill.setAttribute("fill", `url(#sc-g-${look})`);
      groundEdge.style.stroke = LOOKS[look].edge;
      mounds.setAttribute("fill", `url(#sc-g-${look})`);
      mounds.style.opacity = s.bog === "none" ? 0 : 1;
      blades.style.opacity = LOOKS[look].blades ? 1 : 0;
      drawRopes(s.parts || 1);

      // both arrows on one scale, so their lengths compare
      const total = Math.max(s.loadKg || 0, 0);
      const unit = 165 / Math.max(total, s.availKg || 0, 1); // the longest arrow stays inside the picture
      let x = 0;
      (s.segments || []).forEach((v, i) => {
        const w = total > 0 ? (Math.max(v, 0) / total) * 100 : 0;
        loadSegs[i].setAttribute("x", x);
        loadSegs[i].setAttribute("width", Math.max(w - 0.8, 0));
        x += w;
      });
      const Ll = Math.max(total * unit, 2);
      loadBar.style.transform = `translate(${LOAD_X}px, ${LOAD_Y}px) scaleX(${-Ll / 100})`;
      loadHead.style.transform = `translate(${LOAD_X - Ll}px, ${LOAD_Y}px)`;
      loadBar.style.opacity = loadHead.style.opacity = total > 0 ? 1 : 0;
      const Lw = s.availKg ? Math.max(s.availKg * unit, 2) : 0;
      winBar.style.transform = `translate(${WIN_X}px, ${WIN_Y}px) scaleX(${Lw / 100})`;
      winHead.style.transform = `translate(${WIN_X + Lw}px, ${WIN_Y}px)`;
      winBar.style.opacity = winHead.style.opacity = Lw ? 1 : 0;

      node.setAttribute("class", "scene-svg sc--" + (s.status || "idle"));
      return {
        load: toPercent(LOAD_X - Ll / 2, LOAD_Y - 30, false),
        winch: toPercent(WIN_X + Lw / 2, WIN_Y + 24, false),
        massField: toPercent(318, 98, true),
        winchField: toPercent(568, 62, false),
      };
    }

    return { el: node, update };
  }

  // ------------------------------------------------------------ rope picker thumbnails
  function lineThumb(n) {
    const ys = n === 1 ? [30] : n === 2 ? [21, 39] : [16, 30, 44];
    const g = svg("g", null,
      svg("rect", { x: 4, y: 8, width: 26, height: 44, rx: 5, class: "th-veh" }),
      svg("circle", { cx: 108, cy: 30, r: 9, class: "th-tree" }));
    ys.forEach((y, i) => g.appendChild(svg("line", { x1: i === 0 ? 30 : 34, y1: y, x2: 86, y2: y, class: "th-rope" })));
    if (n >= 2) {
      const r = (ys[1] - ys[0]) / 2;
      g.appendChild(svg("path", { d: `M86 ${ys[0]} A ${r} ${r} 0 0 1 86 ${ys[1]}`, class: "th-rope", fill: "none" }));
      g.appendChild(svg("circle", { cx: 86 + r, cy: ys[0] + r, r: 4, class: "th-block" }));
      g.appendChild(svg("line", { x1: 90 + r, y1: ys[0] + r, x2: 100, y2: 30, class: "th-strap" }));
    }
    if (n === 3) {
      const r = (ys[2] - ys[1]) / 2;
      g.appendChild(svg("path", { d: `M34 ${ys[1]} A ${r} ${r} 0 0 0 34 ${ys[2]}`, class: "th-rope", fill: "none" }));
      g.appendChild(svg("circle", { cx: 34 - r, cy: ys[1] + r, r: 4, class: "th-block" }));
      g.appendChild(svg("line", { x1: 86, y1: ys[2], x2: 100, y2: 30, class: "th-strap" }));
    }
    if (n === 1) g.appendChild(svg("line", { x1: 86, y1: 30, x2: 100, y2: 30, class: "th-rope" }));
    return svg("svg", { class: "thumb-svg", viewBox: "0 0 120 60", "aria-hidden": "true" }, g);
  }

  // ------------------------------------------------------------ rigging (top view)
  /*
   * Drawn at the panel's own width (1 SVG unit = 1 CSS px), so text stays
   * readable on phones. With a rope angle, everything from the vehicle's front
   * outwards is sheared upwards (P below), so the ropes leave at the real angle
   * while blocks stay round and text stays level. The rope is drawn shorter at
   * steep angles so the picture doesn't grow too tall; the angle is true.
   */
  function rigging(rig, width, angleDeg) {
    const n = rig.parts;
    const W = Math.max(300, Math.min(900, Math.round(width || 640)));
    const narrow = W < 480;
    const deg = Math.max(0, Math.min(45, angleDeg || 0));
    const tanA = Math.tan((deg * Math.PI) / 180);
    const gap = 46;
    const xVeh = narrow ? 92 : 150; // vehicle front
    const treeR = narrow ? 20 : 24;
    const treeOff = narrow ? 56 : 88; // anchor-side blocks to the tree
    const fullSpan = W - (narrow ? 84 : 120) - xVeh;
    const maxRise = narrow ? 150 : 200;
    const span = tanA > 0.005 ? Math.max(Math.min(fullSpan, maxRise / tanA - treeOff - treeR), 70) : fullSpan;
    const rise = (span + treeOff + treeR) * tanA;
    const angled = deg >= 0.5;
    const top = 34 + rise + (angled ? 44 : 0); // room above the tree for its label
    const xAnc = xVeh + span;
    const treeX = xAnc + treeOff;
    const yOf = (k) => top + k * gap;
    const H = top + (n - 1) * gap + 74;
    const P = (x, y) => ({ x, y: y - (x - xVeh) * tanA });

    const g = svg("g", null);
    const vy = yOf(0) - 26;
    const vh = Math.max(52, (n - 1) * gap + 52);
    const yMid = yOf(0) + ((n - 1) * gap) / 2;

    // the way the vehicle has to move, and the angle the rope makes with it,
    // measured where the bottom rope leaves the vehicle
    if (angled) {
      const x0 = xVeh + 8;
      const y0 = yOf(n - 1);
      g.appendChild(svg("line", { class: "rg-path", x1: x0, y1: y0, x2: W - 14, y2: y0 }));
      g.appendChild(svg("path", { class: "rg-path-head", d: `M ${W - 4} ${y0} l -12 -6 v 12 Z` }));
      g.appendChild(svg("text", { class: "rg-seg", x: W - 4, y: y0 + 20, "text-anchor": "end" }, narrow ? "way it moves" : "the way it must move"));
      const R = narrow ? 64 : 92;
      const a = (deg * Math.PI) / 180;
      g.appendChild(svg("path", { class: "rg-arc", d: `M ${x0 + R} ${y0} A ${R} ${R} 0 0 0 ${x0 + R * Math.cos(a)} ${y0 - R * Math.sin(a)}` }));
      g.appendChild(svg("text", { class: "rg-angle", x: x0 + R + 6, y: y0 - 6 }, `${Math.round(deg)}°`));
    }

    g.appendChild(svg("rect", { class: "rg-vehicle", x: 8, y: vy, width: xVeh - 20, height: vh, rx: 10 }));
    g.appendChild(svg("text", { class: "rg-label", x: 8 + (xVeh - 20) / 2, y: n > 2 ? vy + 22 : vy + vh / 2 + 6, "text-anchor": "middle" }, "Vehicle"));
    g.appendChild(svg("rect", { class: "rg-winch", x: xVeh - 18, y: yOf(0) - 9, width: 16, height: 18, rx: 3 }));
    const tree = P(treeX, yMid);

    for (let k = 0; k < n; k++) {
      const y = yOf(k);
      const a = P(k === 0 ? xVeh - 2 : xVeh + 8, y);
      const b = P(k === n - 1 && n % 2 === 1 ? xAnc + 10 : xAnc, y);
      // the rope runs back toward the winch: leftwards on even lengths, rightwards on odd ones
      g.appendChild(svg("line", { class: "rg-rope " + (k % 2 ? "flow-r" : "flow-l"), x1: a.x, y1: a.y, x2: b.x, y2: b.y }));
      const lab = P(xVeh + span * 0.3, y);
      g.appendChild(svg("text", { class: "rg-seg", x: lab.x, y: lab.y - 7, "text-anchor": "middle" }, U.kg(rig.segments[k])));
    }
    rig.points.forEach((p, i) => {
      if (p.kind === "block") {
        const j = i + 1;
        const x = p.at === "anchor" ? xAnc : xVeh + 8;
        const A = P(x, yOf(j - 1));
        const B = P(x, yOf(j));
        const rr = (B.y - A.y) / 2;
        const bx = p.at === "anchor" ? x + rr : x - rr;
        const cy = (A.y + B.y) / 2;
        g.appendChild(svg("path", { class: "rg-rope", d: `M ${A.x} ${A.y} A ${rr} ${rr} 0 0 ${p.at === "anchor" ? 1 : 0} ${B.x} ${B.y}`, fill: "none" }));
        if (p.at === "anchor") g.appendChild(svg("line", { class: "rg-strap", x1: bx + 9, y1: cy, x2: tree.x, y2: tree.y }));
        g.appendChild(svg("g", { class: "rg-sheave" },
          svg("circle", { class: "rg-block", cx: bx, cy, r: 9 }),
          svg("line", { class: "rg-axle", x1: bx - 5, y1: cy, x2: bx + 5, y2: cy })));
        // label: under an anchor-side block (clear of the ropes, even when they slope), over the vehicle for a vehicle-side one
        if (p.at === "anchor") g.appendChild(svg("text", { class: "rg-blocklabel", x: bx, y: B.y + 22, "text-anchor": "middle" }, (narrow ? "" : "Block " + j + ": ") + U.kg(p.loadKg)));
        else g.appendChild(svg("text", { class: "rg-blocklabel", x: bx - 16, y: cy + 5, "text-anchor": "end" }, (narrow ? "" : "Block " + j + ": ") + U.kg(p.loadKg)));
      } else if (p.at === "vehicle") {
        const e = P(xVeh + 8, yOf(n - 1));
        g.appendChild(svg("circle", { class: "rg-end", cx: e.x, cy: e.y, r: 5 }));
      } else {
        const e = P(xAnc + 10, yOf(n - 1));
        g.appendChild(svg("line", { class: "rg-strap", x1: e.x, y1: e.y, x2: tree.x, y2: tree.y }));
        g.appendChild(svg("circle", { class: "rg-end", cx: e.x, cy: e.y, r: 5 }));
      }
    });
    g.appendChild(svg("circle", { class: "rg-tree", cx: tree.x, cy: tree.y, r: treeR }));
    // anchor load: below the tree when the rope runs straight, above it when it's angled (clear of the ropes)
    const lx = Math.min(W - 4, tree.x + treeR + 6);
    const ly = angled ? tree.y - treeR - 30 : tree.y + treeR + 20;
    g.appendChild(svg("text", { class: "rg-label", x: lx, y: ly, "text-anchor": "end" }, "Anchor"));
    g.appendChild(svg("text", { class: "rg-value", x: lx, y: ly + 21, "text-anchor": "end" }, U.kg(rig.anchorKg)));
    g.appendChild(svg("text", { class: "rg-label", x: 8, y: vy + vh + 22, "text-anchor": "start" }, "Winch pulls " + U.kg(rig.winchKg)));

    const caption = (n === 1
      ? "Single line: the winch pulls the full load, and the anchor takes the same."
      : `${n} lengths of rope pull on the vehicle. Each block loses 8% to friction (LEEA), so the winch pulls ${U.kg(rig.winchKg)}, not ${U.kg(rig.anchorKg / n)}. The anchor still takes the full ${U.kg(rig.anchorKg)}.`) +
      (angled ? ` The rope is ${Math.round(deg)}° off the way the vehicle must move.` : "");
    const at = P(xVeh + span * 0.66, yOf(0));
    return {
      el: svg("svg", { class: "rigging-svg", viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", "aria-label": caption }, g),
      caption,
      // where the anchor-distance input sits: on the top rope, nearer the anchor
      inputAt: at,
      width: W,
      height: H,
    };
  }

  // ------------------------------------------------------------ the winch, cut through the drum
  /*
   * A winch seen from the front: motor, drum between its flanges, gearbox, the
   * tie bar over the top, feet below. The drum is cut through, so each wrap of
   * rope shows as a circle, stacked in layers on the drum. set() colours the
   * wraps and moves the rope's exit to the outermost wrap.
   */
  function drum(dr, minWrapsM) {
    const wraps = dr.wraps;
    const pitch = Math.max(7, Math.min(12, 300 / wraps));
    const r = pitch / 2 - 0.6;
    const layers = dr.layers.length;
    const rowH = pitch * 0.88;
    const coreH = 16;
    const motorW = 62;
    const gearW = 50;
    const fl = 9; // flange thickness
    const xMotor = 4;
    const xFlL = xMotor + motorW + 4;
    const x0 = xFlL + fl; // drum barrel starts
    const drumW = wraps * pitch + pitch / 2;
    const xFlR = x0 + drumW;
    const xGear = xFlR + fl + 4;
    const W = xGear + gearW + 4;
    const topPad = 34; // room for the rope leaving and its label
    const stackH = layers * rowH;
    const flTop = topPad + 6;
    const baseY = flTop + 10 + stackH; // top of the barrel
    const axisY = baseY + coreH / 2;
    const flH = (axisY - flTop) * 2;
    const hh = Math.max(46, coreH + 30);
    const feetY = Math.max(axisY + hh / 2, flTop + flH) + 2;
    const H = feetY + 26;

    const g = svg("g", null);
    // feet and base plate
    g.appendChild(svg("rect", { x: xMotor + 6, y: feetY, width: W - xMotor - 16, height: 5, rx: 2, class: "wn-base" }));
    // motor: a ribbed cylinder
    g.appendChild(svg("rect", { x: xMotor, y: axisY - hh / 2, width: motorW, height: hh, rx: 10, class: "wn-motor" }));
    for (let i = 1; i < 6; i++) g.appendChild(svg("line", { x1: xMotor + i * (motorW / 6), y1: axisY - hh / 2 + 6, x2: xMotor + i * (motorW / 6), y2: axisY + hh / 2 - 6, class: "wn-rib" }));
    // gearbox / clutch housing
    g.appendChild(svg("rect", { x: xGear, y: axisY - hh / 2, width: gearW, height: hh, rx: 6, class: "wn-gear" }));
    g.appendChild(svg("circle", { cx: xGear + gearW / 2, cy: axisY - hh / 2 + 11, r: 5, class: "wn-knob" }));
    // flanges (end plates) and the barrel
    g.appendChild(svg("rect", { x: xFlL, y: flTop, width: fl, height: flH, rx: 3, class: "wn-flange" }));
    g.appendChild(svg("rect", { x: xFlR, y: flTop, width: fl, height: flH, rx: 3, class: "wn-flange" }));
    g.appendChild(svg("rect", { x: x0, y: baseY, width: drumW, height: coreH, class: "wn-barrel" }));
    g.appendChild(svg("line", { x1: x0, y1: axisY, x2: x0 + drumW, y2: axisY, class: "wn-axis" }));
    // tie bar across the top, from motor to gearbox
    g.appendChild(svg("rect", { x: xMotor + 8, y: flTop - 9, width: xGear + gearW - xMotor - 16, height: 5, rx: 2.5, class: "wn-tie" }));

    const circles = [];
    let cum = 0;
    dr.layers.forEach((l, li) => {
      const wrapLen = (2 * Math.PI * l.rMm) / 1000;
      for (let k = 0; k < wraps; k++) {
        // level wind: odd layers go left to right, even layers back, nested half a wrap over
        const idx = li % 2 === 0 ? k : wraps - 1 - k;
        const cx = x0 + pitch / 2 + idx * pitch + (li % 2 ? pitch / 2 : 0);
        const cy = baseY - pitch / 2 - li * rowH;
        cum += wrapLen;
        const c = svg("circle", { cx, cy, r, class: "dm-wrap" });
        circles.push({ c, end: cum, cx, cy });
        g.appendChild(c);
      }
    });

    // the rope leaving the outermost wrap, off to the anchor
    const exit = svg("path", { class: "wn-exit", d: "" });
    const exitLabel = svg("text", { class: "wn-text wn-text--exit", x: W - 6, y: 14, "text-anchor": "end" }, "to the anchor →");
    g.append(exit, exitLabel);
    // names of the parts
    g.appendChild(svg("text", { class: "wn-text", x: xMotor + motorW / 2, y: H - 6, "text-anchor": "middle" }, "motor"));
    g.appendChild(svg("text", { class: "wn-text", x: x0 + drumW / 2, y: H - 6, "text-anchor": "middle" }, "drum, cut through: one circle per wrap"));
    g.appendChild(svg("text", { class: "wn-text", x: xGear + gearW / 2, y: H - 6, "text-anchor": "middle" }, "gearbox"));

    const node = svg("svg", { class: "drum-svg", viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "The winch from the front, its drum cut through: each circle is one wrap of rope, stacked in layers" }, g);
    return {
      el: node,
      set(onDrumM, startOnDrumM) {
        let last = null;
        circles.forEach((w) => {
          const on = w.end <= onDrumM + 1e-6;
          const cls = w.end <= minWrapsM + 1e-6 ? "dm-wrap is-min" : w.end <= startOnDrumM + 1e-6 ? "dm-wrap is-start" : on ? "dm-wrap is-wound" : "dm-wrap";
          if (w.c.getAttribute("class") !== cls) w.c.setAttribute("class", cls);
          if (on) last = w;
        });
        const from = last || { cx: x0 + pitch / 2, cy: baseY - pitch / 2 };
        exit.setAttribute("d", `M ${from.cx} ${from.cy - r} C ${from.cx} ${flTop - 18}, ${W - 60} ${flTop - 22}, ${W - 6} 22`);
      },
    };
  }

  // ------------------------------------------------------------ current gauge
  function gauge() {
    const cx = 110;
    const cy = 112;
    const R = 92;
    const arcPath = (f) => {
      const a = Math.PI - f * Math.PI;
      return `M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R * Math.cos(a)} ${cy - R * Math.sin(a)}`;
    };
    const track = svg("path", { d: arcPath(1), class: "ga-track" });
    const fill = svg("path", { d: arcPath(0.001), class: "ga-fill" });
    const ticks = svg("g", { class: "ga-ticks" });
    const peak = svg("line", { class: "ga-peak", x1: cx, y1: cy - R - 9, x2: cx, y2: cy - R + 9 });
    const needle = svg("g", { class: "ga-needle" }, svg("path", { d: `M ${cx - 4} ${cy} L ${cx} ${cy - R + 16} L ${cx + 4} ${cy} Z` }), svg("circle", { cx, cy, r: 7 }));
    const node = svg("svg", { class: "gauge-svg", viewBox: "0 0 220 122", role: "img", "aria-label": "Dial of the current the winch draws" }, track, fill, ticks, peak, needle);
    let max = 500;
    return {
      el: node,
      setScale(peakA) {
        max = Math.max(300, Math.ceil((peakA * 1.1) / 100) * 100);
        const kids = [];
        for (let v = 0; v <= max; v += 100) {
          const a = Math.PI - (v / max) * Math.PI;
          kids.push(svg("line", { x1: cx + (R - 7) * Math.cos(a), y1: cy - (R - 7) * Math.sin(a), x2: cx + (R + 5) * Math.cos(a), y2: cy - (R + 5) * Math.sin(a) }));
          if (max <= 500 || v % 200 === 0) kids.push(svg("text", { x: cx + (R - 22) * Math.cos(a), y: cy - (R - 22) * Math.sin(a) + 4, "text-anchor": "middle" }, String(v)));
        }
        ticks.replaceChildren(...kids);
        peak.style.transform = `rotate(${(peakA / max) * 180 - 90}deg)`;
      },
      set(amps) {
        const f = Math.max(0, Math.min(1, amps / max));
        needle.style.transform = `rotate(${f * 180 - 90}deg)`;
        fill.setAttribute("d", arcPath(Math.max(f, 0.001)));
      },
    };
  }

  // ------------------------------------------------------------ line chart with a playhead
  /*
   * o: { width, height, points, series: [{ key, cls, step, label, short }], yUnit,
   *      xLabel, labelEnds, tip(p) -> [lines], aria }
   */
  function lineChart(o) {
    const W = Math.max(280, Math.min(720, Math.round(o.width || 600)));
    const narrow = W < 460;
    const H = o.height || 200;
    const pad = { l: 52, r: o.labelEnds ? (narrow ? 62 : 104) : 14, t: 22, b: o.xLabel ? 38 : 22 };
    const pts = o.points;
    const xMax = pts[pts.length - 1].x || 1;
    const yMaxRaw = Math.max(...pts.map((p) => Math.max(...o.series.map((s) => p[s.key] || 0))), 1);
    const step = niceStep(yMaxRaw / 3);
    const yMax = Math.ceil((yMaxRaw * 1.08) / step) * step;
    const X = (x) => pad.l + (x / xMax) * (W - pad.l - pad.r);
    const Y = (y) => H - pad.b - (y / yMax) * (H - pad.t - pad.b);

    const g = svg("g", null);
    for (let v = 0; v <= yMax + 1e-9; v += step) {
      g.appendChild(svg("line", { class: "ch-grid", x1: pad.l, x2: W - pad.r, y1: Y(v), y2: Y(v) }));
      g.appendChild(svg("text", { class: "ch-tick", x: pad.l - 8, y: Y(v) + 4, "text-anchor": "end" }, U.n(v, 1)));
    }
    g.appendChild(svg("text", { class: "ch-unit", x: 4, y: 11, "text-anchor": "start" }, o.yUnit));
    const xStep = niceStep(xMax / 4);
    for (let v = 0; v <= xMax + 1e-9; v += xStep) g.appendChild(svg("text", { class: "ch-tick", x: X(v), y: H - pad.b + 16, "text-anchor": "middle" }, U.n(v, xStep < 1 ? 0.1 : 1)));
    if (o.xLabel) g.appendChild(svg("text", { class: "ch-axis", x: (pad.l + W - pad.r) / 2, y: H - 4, "text-anchor": "middle" }, o.xLabel));

    o.series.forEach((s) => {
      let d = "";
      pts.forEach((p, i) => {
        if (i === 0) d += `M ${X(p.x)} ${Y(p[s.key])}`;
        else if (s.step) d += ` L ${X(p.x)} ${Y(pts[i - 1][s.key])} L ${X(p.x)} ${Y(p[s.key])}`;
        else d += ` L ${X(p.x)} ${Y(p[s.key])}`;
      });
      g.appendChild(svg("path", { class: "ch-line " + s.cls, d }));
    });
    if (o.labelEnds) {
      const last = pts[pts.length - 1];
      const ys = o.series.map((s) => Y(last[s.key]));
      const apart = ys.length === 2 && Math.abs(ys[0] - ys[1]) < 16 ? (ys[0] < ys[1] ? -8 : 8) : 0;
      o.series.forEach((s, i) => g.appendChild(svg("text", { class: "ch-label", x: W - pad.r + 8, y: ys[i] + 4 + (i === 0 ? apart : -apart) }, narrow ? s.short : s.label)));
    }

    const head = svg("line", { class: "ch-playhead", x1: X(0), x2: X(0), y1: pad.t, y2: H - pad.b });
    const dots = o.series.map((s) => svg("circle", { class: "ch-dot " + s.cls, r: 4.5, cx: X(0), cy: Y(pts[0][s.key]) }));
    g.append(head, ...dots);
    const hit = svg("rect", { x: pad.l, y: pad.t, width: W - pad.l - pad.r, height: H - pad.t - pad.b, fill: "transparent" });
    g.appendChild(hit);
    const node = svg("svg", { class: "chart-svg", viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", "aria-label": o.aria }, g);
    hit.addEventListener("pointermove", (e) => {
      const box = node.getBoundingClientRect();
      const sx = ((e.clientX - box.left) / box.width) * W;
      const x = Math.max(0, Math.min(xMax, ((sx - pad.l) / (W - pad.l - pad.r)) * xMax));
      const p = pts.reduce((a, b) => (Math.abs(b.x - x) < Math.abs(a.x - x) ? b : a));
      showTip(o.tip(p), e.clientX, e.clientY);
    });
    hit.addEventListener("pointerleave", hideTip);

    function valuesAt(x) {
      let i = 0;
      while (i < pts.length - 1 && pts[i + 1].x <= x) i++;
      const a = pts[i];
      const b = pts[Math.min(i + 1, pts.length - 1)];
      const t = b.x === a.x ? 0 : (x - a.x) / (b.x - a.x);
      return o.series.map((s) => (s.step ? a[s.key] : a[s.key] + t * (b[s.key] - a[s.key])));
    }
    return {
      el: node,
      setPlayhead(x) {
        const px = X(Math.max(0, Math.min(xMax, x)));
        head.setAttribute("x1", px);
        head.setAttribute("x2", px);
        const vals = valuesAt(x);
        dots.forEach((d, i) => {
          d.setAttribute("cx", px);
          d.setAttribute("cy", Y(vals[i]));
        });
      },
    };
  }

  function niceStep(raw) {
    const p = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-9))));
    const f = raw / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  }

  // ------------------------------------------------------------ rope angle, seen from above
  // The vehicle points the way it must move; the rope swings off to the anchor.
  function angleView() {
    const rope = svg("g", { class: "av-rope" },
      svg("line", { x1: 46, y1: 34, x2: 118, y2: 34, class: "av-line" }),
      svg("circle", { cx: 124, cy: 34, r: 7, class: "av-tree" }));
    const node = svg("svg", { class: "angle-svg", viewBox: "0 0 140 68", "aria-hidden": "true" },
      svg("line", { x1: 46, y1: 34, x2: 132, y2: 34, class: "av-path" }),
      svg("path", { d: "M10 22 h30 q6 0 6 6 v12 q0 6 -6 6 h-30 q-4 0 -4 -4 v-16 q0 -4 4 -4 Z", class: "av-veh" }),
      svg("rect", { x: 28, y: 25, width: 8, height: 18, rx: 2, class: "av-glass" }),
      svg("path", { class: "av-arc", d: "" }),
      rope);
    const arc = node.querySelector(".av-arc");
    return {
      el: node,
      set(deg) {
        rope.style.transform = `rotate(${-deg}deg)`;
        const a = (deg * Math.PI) / 180;
        const r = 30;
        arc.setAttribute("d", deg > 0.5 ? `M ${46 + r} 34 A ${r} ${r} 0 0 0 ${46 + r * Math.cos(a)} ${34 - r * Math.sin(a)}` : "");
      },
    };
  }

  root.WINCH_DIAGRAMS = { scene, lineThumb, rigging, drum, gauge, lineChart, angleView, LOOKS };
})(window);
