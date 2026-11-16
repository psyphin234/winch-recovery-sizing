/*
 * diagrams.js: the page's pictures, built from calc.js results.
 *   scene       side view of the stuck vehicle, the winch and the anchor. Built once and
 *               updated in place, so slope and bogging animate between states.
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

  const grad = (id, attrs, stops) => svg("linearGradient", Object.assign({ id }, attrs),
    stops.map((st) => svg("stop", { offset: st[0], "stop-color": st[1], "stop-opacity": st[2] === undefined ? null : st[2] })));
  const radial = (id, attrs, stops) => svg("radialGradient", Object.assign({ id }, attrs),
    stops.map((st) => svg("stop", { offset: st[0], "stop-color": st[1], "stop-opacity": st[2] === undefined ? null : st[2] })));
  // the same "random" numbers every time, so a picture never changes between draws
  const seeded = (seed) => () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  // ------------------------------------------------------------ the scene (side view)
  /*
   * World coordinates: viewBox 800 x 380, ground line y = 290, the world turns
   * about (420, 290) for the slope and shrinks a little on steep slopes so the
   * tree stays in view. The vehicle faces right; the anchor tree is on the right.
   * Inputs and labels are HTML overlays placed with the returned positions.
   * The night sky, lights and shading are illustration, not data.
   */
  const SCENE = { VW: 800, VH: 380, PX: 420, PY: 290 };
  function scene() {
    const { VW, VH, PX, PY } = SCENE;
    const SINK = { none: 4, axles: 32, chassis: 47 };

    const defs = svg("defs", null,
      grad("sc-sky", { x1: 0, y1: 0, x2: 0, y2: 1 }, [[0, "#040919"], [0.62, "#0b1740"], [1, "#16306a"]]),
      radial("sc-horizon", { cx: 0.5, cy: 1, r: 0.75 }, [[0, "#4cc9ff", 0.2], [1, "#4cc9ff", 0]]),
      radial("sc-moonglow", { cx: 0.5, cy: 0.5, r: 0.5 }, [[0, "#eaf2ff", 0.3], [1, "#eaf2ff", 0]]),
      grad("sc-hill-far", { x1: 0, y1: 0, x2: 0, y2: 1 }, [[0, "#142452"], [1, "#0a1330"]]),
      grad("sc-hill-near", { x1: 0, y1: 0, x2: 0, y2: 1 }, [[0, "#0e1a40"], [1, "#070e26"]]),
      grad("sc-depth", { gradientUnits: "userSpaceOnUse", x1: 0, y1: PY, x2: 0, y2: PY + 200 }, [[0, "#000", 0], [1, "#000", 0.5]]),
      grad("sc-paint", { x1: 0, y1: 0, x2: 0, y2: 1 }, [[0, "#3a5591"], [0.55, "#22335c"], [1, "#131e3e"]]),
      grad("sc-glass", { x1: 0, y1: 0, x2: 1, y2: 1 }, [[0, "#1c3566"], [1, "#081228"]]),
      radial("sc-rim", { cx: 0.4, cy: 0.35, r: 0.7 }, [[0, "#7f93bd"], [1, "#2c3960"]]),
      grad("sc-beam", { x1: 0, y1: 0, x2: 1, y2: 0 }, [[0, "#ffe9a8", 0.3], [1, "#ffe9a8", 0]]),
      grad("sc-bark", { x1: 0, y1: 0, x2: 1, y2: 0 }, [[0, "#6f5642"], [0.5, "#5b4636"], [1, "#3b2c21"]]),
      radial("sc-leafg", { cx: 0.35, cy: 0.3, r: 0.8 }, [[0, "#4c8a55"], [1, "#22422a"]]),
      grad("sc-metal", { x1: 0, y1: 0, x2: 0, y2: 1 }, [[0, "#f4f8ff"], [1, "#8b9cc2"]]),
      svg("pattern", { id: "sc-blades", width: 10, height: 10, patternUnits: "userSpaceOnUse" },
        svg("path", { d: "M1 10 L3 2 L4 10 M5 10 L7 4 L8 10", fill: "#6f9a48" })),
      Object.keys(LOOKS).map((k) => groundPattern("sc-g-" + k, k))
    );

    // sky and far hills, so the slope reads against something fixed
    const rnd = seeded(11);
    const stars = svg("g", { class: "sc-stars" });
    for (let i = 0; i < 54; i++) {
      stars.appendChild(svg("circle", { cx: (rnd() * VW).toFixed(1), cy: (rnd() * 200).toFixed(1), r: (0.5 + rnd() * 0.9).toFixed(2), class: "sc-star" + (i % 4 === 0 ? " sc-star--twinkle" : ""), style: `opacity:${(0.25 + rnd() * 0.65).toFixed(2)};animation-delay:${(-rnd() * 5).toFixed(1)}s` }));
    }
    const backdrop = svg("g", { class: "sc-back" },
      svg("rect", { width: VW, height: VH, fill: "url(#sc-sky)" }),
      stars,
      svg("circle", { cx: 96, cy: 54, r: 44, fill: "url(#sc-moonglow)" }),
      svg("circle", { cx: 96, cy: 54, r: 13, class: "sc-moon" }),
      svg("circle", { cx: 102, cy: 49, r: 12, class: "sc-moon-cut" }),
      svg("rect", { y: 90, width: VW, height: 200, fill: "url(#sc-horizon)" }),
      svg("path", { d: "M0 250 Q120 200 230 232 T470 214 T800 226 L800 380 L0 380 Z", fill: "url(#sc-hill-far)" }),
      svg("path", { d: "M0 250 Q120 200 230 232 T470 214 T800 226", class: "sc-ridge" }),
      svg("path", { d: "M0 300 Q160 262 330 286 T800 276 L800 380 L0 380 Z", fill: "url(#sc-hill-near)" })
    );

    let tips = {};
    const hit = (key, node) => {
      const show = (e) => { if (tips[key]) showTip(tips[key], e.clientX, e.clientY); };
      node.addEventListener("pointerenter", show);
      node.addEventListener("pointermove", show);
      node.addEventListener("pointerleave", hideTip);
      return node;
    };

    const leaf = (cx, cy, r, cls) => svg("circle", { cx, cy, r, class: "sc-leaf" + (cls ? " " + cls : ""), fill: "url(#sc-leafg)" });
    const tree = svg("g", { class: "sc-tree" },
      svg("path", { class: "sc-trunk", fill: "url(#sc-bark)", d: "M694 300 L696 130 Q707 120 718 130 L722 300 Z" }),
      svg("path", { class: "sc-barkline", d: "M702 150 L701 210 M711 160 L712 228 M705 252 L704 292 M714 256 L715 290" }),
      svg("path", { class: "sc-branch", d: "M706 150 L688 118 M708 142 L730 110" }),
      leaf(672, 112, 40), leaf(736, 104, 38, "sc-leaf--2"), leaf(704, 66, 40), leaf(690, 96, 30, "sc-leaf--2"), leaf(722, 82, 28),
      svg("path", { class: "sc-leafshine", d: "M680 44 Q704 26 728 44 M650 96 Q656 78 672 74" }),
      hit("protector", svg("g", { class: "sc-protector" },
        svg("rect", { x: 689, y: 231, width: 36, height: 16, rx: 3, class: "sc-strap-under" }),
        svg("rect", { x: 690, y: 232, width: 34, height: 14, rx: 3, class: "sc-strap" }),
        svg("line", { x1: 693, y1: 239, x2: 721, y2: 239, class: "sc-stitch" })))
    );

    const ropes = svg("g", { class: "sc-ropes" });
    const ropeHit = hit("rope", svg("line", { x1: 462, y1: 241, x2: 690, y2: 241, class: "sc-hit" }));

    // vehicle: outer group sinks, inner group creeps forward while winching
    const wheel = (cx) => svg("g", { class: "sc-wheel" },
      svg("circle", { cx, cy: 258, r: 32, class: "sc-tyre" }),
      svg("circle", { cx, cy: 258, r: 29.5, class: "sc-tread" }),
      svg("circle", { cx, cy: 258, r: 19, class: "sc-rim", fill: "url(#sc-rim)" }),
      [0, 60, 120, 180, 240, 300].map((a) => svg("line", { x1: cx + 6 * Math.cos((a * Math.PI) / 180), y1: 258 + 6 * Math.sin((a * Math.PI) / 180), x2: cx + 17 * Math.cos((a * Math.PI) / 180), y2: 258 + 17 * Math.sin((a * Math.PI) / 180), class: "sc-spoke" })),
      svg("circle", { cx, cy: 258, r: 5, class: "sc-hub" }));
    const arch = (cx) => svg("path", { class: "sc-arch", d: `M ${cx - 39} 256 A 39 39 0 0 1 ${cx + 39} 256 Z` });
    const vehicleInner = svg("g", { class: "sc-veh-inner" },
      svg("path", { class: "sc-beam", fill: "url(#sc-beam)", d: "M458 203 L690 160 L690 290 L458 215 Z" }),
      svg("path", { class: "sc-body", fill: "url(#sc-paint)", d: "M186 252 L186 206 Q186 196 196 195 L292 192 L320 151 Q325 145 333 145 L400 145 Q408 145 412 151 L434 190 L450 194 Q458 196 458 206 L458 252 Q458 256 454 256 L186 256 Z" }),
      svg("path", { class: "sc-shine", d: "M194 201 L292 198 L322 154 Q326 150 333 150 L398 150" }),
      svg("path", { class: "sc-glass", fill: "url(#sc-glass)", d: "M302 190 L326 156 Q329 152 335 152 L362 152 L362 190 Z" }),
      svg("path", { class: "sc-glass", fill: "url(#sc-glass)", d: "M370 152 L398 152 Q404 152 407 157 L428 190 L370 190 Z" }),
      svg("path", { class: "sc-glint", d: "M318 184 L336 158 M378 184 L392 158" }),
      svg("path", { class: "sc-seam", d: "M366 192 L366 250 M298 196 L298 250" }),
      svg("rect", { x: 372, y: 204, width: 15, height: 4, rx: 2, class: "sc-handle" }),
      svg("rect", { x: 304, y: 204, width: 15, height: 4, rx: 2, class: "sc-handle" }),
      svg("rect", { x: 196, y: 246, width: 252, height: 8, rx: 2, class: "sc-sill" }),
      svg("rect", { x: 334, y: 138, width: 66, height: 5, rx: 2, class: "sc-rack" }),
      svg("path", { class: "sc-rack-leg", d: "M342 143 L342 147 M392 143 L392 147" }),
      svg("rect", { x: 448, y: 200, width: 10, height: 13, rx: 3, class: "sc-head" }),
      svg("rect", { x: 186, y: 201, width: 6, height: 15, rx: 2, class: "sc-tail" }),
      svg("rect", { x: 456, y: 226, width: 22, height: 28, rx: 4, class: "sc-bar" }),
      hit("winch", svg("g", null,
        svg("rect", { x: 448, y: 232, width: 14, height: 18, rx: 3, class: "sc-winch", fill: "url(#sc-metal)" }),
        svg("path", { class: "sc-winch-line", d: "M451 236 L459 236 M451 241 L459 241 M451 246 L459 246" }))),
      arch(250), arch(396),
      wheel(250),
      wheel(396)
    );
    const vehicle = svg("g", { class: "sc-veh" }, vehicleInner);

    // ground, drawn over the vehicle so a bogged vehicle sinks into it
    const groundFill = svg("rect", { x: -700, y: PY, width: 2200, height: 700, class: "sc-ground" });
    const groundDepth = svg("rect", { x: -700, y: PY, width: 2200, height: 700, fill: "url(#sc-depth)", class: "sc-depth" });
    const groundEdge = svg("line", { x1: -700, y1: PY, x2: 1500, y2: PY, class: "sc-edge" });
    const blades = svg("rect", { x: -700, y: PY - 8, width: 2200, height: 9, fill: "url(#sc-blades)", class: "sc-blades" });
    const mounds = svg("g", { class: "sc-mounds" },
      [250, 396].map((x) => [svg("ellipse", { cx: x - 30, cy: PY, rx: 26, ry: 9 }), svg("ellipse", { cx: x + 30, cy: PY, rx: 26, ry: 9 })]));
    const shadow = svg("ellipse", { cx: 322, cy: PY + 4, rx: 150, ry: 8, class: "sc-shadow" });
    const treeShadow = svg("ellipse", { cx: 708, cy: PY + 4, rx: 46, ry: 6, class: "sc-shadow" });
    const ground = svg("g", { class: "sc-groundg" }, groundFill, groundDepth, shadow, treeShadow, mounds, blades, groundEdge);

    // the distance to the anchor, as a dimension line over the rope (not to scale)
    const DIM_Y = 206;
    const dimText = svg("text", { class: "sc-dimtext", x: 584, y: DIM_Y - 8, "text-anchor": "middle" }, "");
    const dim = svg("g", { class: "sc-dim" },
      svg("line", { x1: 478, y1: DIM_Y, x2: 694, y2: DIM_Y, class: "sc-dimline" }),
      svg("line", { x1: 478, y1: DIM_Y - 7, x2: 478, y2: DIM_Y + 7, class: "sc-dimline" }),
      svg("line", { x1: 694, y1: DIM_Y - 7, x2: 694, y2: DIM_Y + 7, class: "sc-dimline" }),
      svg("path", { d: `M 478 ${DIM_Y} l 9 -4 v 8 Z`, class: "sc-dimhead" }),
      svg("path", { d: `M 694 ${DIM_Y} l -9 -4 v 8 Z`, class: "sc-dimhead" }),
      dimText);

    const world = svg("g", { class: "sc-world" }, tree, ropes, ropeHit, vehicle, ground, dim);
    const node = svg("svg", { class: "scene-svg", viewBox: `0 0 ${VW} ${VH}`, role: "img", "aria-label": "Side view of the stuck vehicle, its winch and the anchor tree" }, defs, backdrop, world);

    let st = { sink: SINK.none, scale: 1, angle: 0 };

    function drawRopes(parts) {
      const ys = parts === 1 ? [241] : parts === 2 ? [237, 247] : [234, 241, 248];
      const line = (y, cls) => svg("line", { x1: 462, y1: y, x2: parts > 1 ? 676 : 690, y2: 241 + (y - 241) * 0.3, class: cls });
      const kids = ys.map((y) => line(y, "sc-rope-under")).concat(ys.map((y, i) => line(y, "sc-rope" + (i % 2 ? " sc-rope--back" : ""))));
      if (parts > 1) kids.push(svg("line", { x1: 685, y1: 241, x2: 694, y2: 239, class: "sc-blockstrap" }), svg("circle", { cx: 676, cy: 241, r: 9, class: "sc-block" }), svg("circle", { cx: 676, cy: 241, r: 2.5, class: "sc-block-pin" }));
      if (parts > 2) kids.push(svg("circle", { cx: 470, cy: 245, r: 7, class: "sc-block" }), svg("circle", { cx: 470, cy: 245, r: 2, class: "sc-block-pin" }));
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
     * s: { look, bog, slopeDir, gradeDeg, parts, anchorM, status, tips: { rope, winch, protector } }
     * Returns where the overlays go: the mass, winch and anchor-distance inputs.
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
      mounds.style.stroke = LOOKS[look].edge;
      mounds.style.opacity = s.bog === "none" ? 0 : 1;
      blades.style.opacity = LOOKS[look].blades ? 1 : 0;
      drawRopes(s.parts || 1);
      tips = s.tips || {};

      dimText.textContent = s.anchorM ? `${U.n(s.anchorM, 0.1)} m to the anchor` : "";

      node.setAttribute("class", "scene-svg sc--" + (s.status || "idle"));
      return {
        massField: toPercent(318, 98, true),
        winchField: toPercent(568, 62, false),
        anchorField: toPercent(584, DIM_Y, false),
      };
    }

    return { el: node, update };
  }

  /*
   * Lets the slope be set by dragging the picture up or down with a mouse or pen
   * (on a phone the slider does it, so a finger on the picture still scrolls the page).
   * get() -> the slope now, in degrees, uphill positive; onChange(deg) the same way.
   */
  function slopeDrag(node, get, onChange, onGrab) {
    let from = null;
    const angleAt = (e) => {
      const b = node.getBoundingClientRect();
      const x = ((e.clientX - b.left) / b.width) * SCENE.VW - SCENE.PX;
      const y = ((e.clientY - b.top) / b.height) * SCENE.VH - SCENE.PY;
      return Math.hypot(x, y) < 50 ? null : (Math.atan2(y, x) * 180) / Math.PI;
    };
    node.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "touch") return;
      const a = angleAt(e);
      if (a === null) return;
      from = { a, deg: get() };
      node.setPointerCapture(e.pointerId);
      if (onGrab) onGrab(true);
      e.preventDefault();
    });
    node.addEventListener("pointermove", (e) => {
      if (!from) return;
      const a = angleAt(e);
      if (a === null) return;
      let d = from.a - a;
      if (d > 180) d -= 360;
      if (d < -180) d += 360;
      onChange(from.deg + d);
    });
    const up = () => {
      if (from && onGrab) onGrab(false);
      from = null;
    };
    node.addEventListener("pointerup", up);
    node.addEventListener("pointercancel", up);
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

    g.appendChild(svg("defs", null, grad("rg-paint", { x1: 0, y1: 0, x2: 0, y2: 1 }, [[0, "#2c4279"], [1, "#16224a"]])));
    g.appendChild(svg("rect", { class: "rg-vehicle", fill: "url(#rg-paint)", x: 8, y: vy, width: xVeh - 20, height: vh, rx: 10 }));
    g.appendChild(svg("text", { class: "rg-label", x: 8 + (xVeh - 20) / 2, y: n > 2 ? vy + 22 : vy + vh / 2 + 6, "text-anchor": "middle" }, "Vehicle"));
    g.appendChild(svg("rect", { class: "rg-winch", x: xVeh - 18, y: yOf(0) - 9, width: 16, height: 18, rx: 3 }));
    const tree = P(treeX, yMid);

    for (let k = 0; k < n; k++) {
      const y = yOf(k);
      const a = P(k === 0 ? xVeh - 2 : xVeh + 8, y);
      const b = P(k === n - 1 && n % 2 === 1 ? xAnc + 10 : xAnc, y);
      // the rope runs back toward the winch: leftwards on even lengths, rightwards on odd ones
      g.appendChild(svg("line", { class: "rg-rope-under", x1: a.x, y1: a.y, x2: b.x, y2: b.y }));
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
        // label: left of the block, between the ropes it turns. For an anchor-side block: with the rope angled,
        // under the block (the anchor's label is then above the tree), except on a triple line, whose rope end
        // and strap sit there: just under its lower rope, tilted with it. On phones the anchor-distance box
        // covers the spot between the ropes, so just under the lower rope there too.
        const text = (narrow || span < 160 ? "" : "Block " + j + ": ") + U.kg(p.loadKg);
        const endStrap = n % 2 === 1; // odd line counts end at the anchor, with a strap to the tree
        // Under the block it goes to the right, clear of the anchor-distance box (~7 px a character). At small
        // angles that spot is on the "way it must move" line: then between the ropes, or on phones not at all
        // (on a double line the anchor block carries the anchor's load, which is shown right beside it).
        const onWayLine = B.y + 22 > yOf(n - 1) - 6;
        if (p.at === "anchor" && angled && !endStrap && !onWayLine) g.appendChild(svg("text", { class: "rg-blocklabel", x: Math.min(bx - 6, W - 4 - text.length * 7), y: B.y + 22, "text-anchor": "start" }, text));
        else if (p.at === "anchor" && angled && !endStrap && narrow) { /* shown as the anchor's load */ }
        else if (p.at === "anchor" && angled && !endStrap) g.appendChild(svg("text", { class: "rg-blocklabel", x: bx - 16, y: cy + 5, "text-anchor": "end" }, text));
        else if (p.at === "anchor" && (angled || narrow)) {
          // the same clearance from the rope, measured square to it, at any angle
          const L = P(bx - 20, yOf(j) + 21 / Math.cos((deg * Math.PI) / 180));
          g.appendChild(svg("text", { class: "rg-blocklabel", x: L.x, y: L.y, "text-anchor": "end", transform: angled ? `rotate(${-deg} ${L.x} ${L.y})` : null }, text));
        } else g.appendChild(svg("text", { class: "rg-blocklabel", x: bx - 16, y: cy + 5, "text-anchor": "end" }, text));
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
    [0.68, 0.4].forEach((f) => g.appendChild(svg("circle", { class: "rg-treering", cx: tree.x - 1, cy: tree.y + 1, r: treeR * f })));
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
    const at = P(xVeh + span * (narrow ? 0.5 : 0.66), yOf(0)); // on phones, clear of the anchor's figures
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
    g.appendChild(svg("defs", null,
      grad("wn-metal", { x1: 0, y1: 0, x2: 1, y2: 0 }, [[0, "#6f82ad"], [0.45, "#dfe8fa"], [1, "#6f82ad"]]),
      grad("wn-case", { x1: 0, y1: 0, x2: 0, y2: 1 }, [[0, "#30426f"], [0.5, "#1c2747"], [1, "#101833"]]),
      grad("wn-core", { x1: 0, y1: 0, x2: 0, y2: 1 }, [[0, "#56658f"], [0.5, "#3e4c72"], [1, "#262f4c"]]),
      radial("wn-bead", { cx: 0.35, cy: 0.3, r: 0.75 }, [[0, "#fff", 0.55], [1, "#fff", 0]])));
    // feet and base plate
    g.appendChild(svg("rect", { x: xMotor + 6, y: feetY, width: W - xMotor - 16, height: 5, rx: 2, class: "wn-base" }));
    // motor: a ribbed cylinder
    g.appendChild(svg("rect", { x: xMotor, y: axisY - hh / 2, width: motorW, height: hh, rx: 10, class: "wn-motor", fill: "url(#wn-case)" }));
    for (let i = 1; i < 6; i++) g.appendChild(svg("line", { x1: xMotor + i * (motorW / 6), y1: axisY - hh / 2 + 6, x2: xMotor + i * (motorW / 6), y2: axisY + hh / 2 - 6, class: "wn-rib" }));
    // gearbox / clutch housing
    g.appendChild(svg("rect", { x: xGear, y: axisY - hh / 2, width: gearW, height: hh, rx: 6, class: "wn-gear", fill: "url(#wn-case)" }));
    g.appendChild(svg("circle", { cx: xGear + gearW / 2, cy: axisY - hh / 2 + 11, r: 5, class: "wn-knob" }));
    // flanges (end plates) and the barrel
    g.appendChild(svg("rect", { x: xFlL, y: flTop, width: fl, height: flH, rx: 3, class: "wn-flange", fill: "url(#wn-metal)" }));
    g.appendChild(svg("rect", { x: xFlR, y: flTop, width: fl, height: flH, rx: 3, class: "wn-flange", fill: "url(#wn-metal)" }));
    g.appendChild(svg("rect", { x: x0, y: baseY, width: drumW, height: coreH, class: "wn-barrel", fill: "url(#wn-core)" }));
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
        const c = svg("circle", { cx, cy, r, class: "dm-wrap", "data-layer": li });
        circles.push({ c, end: cum, cx, cy });
        g.appendChild(c);
        g.appendChild(svg("circle", { cx, cy, r, class: "dm-bead", fill: "url(#wn-bead)" }));
      }
    });

    // the rope leaving the outermost wrap, off to the anchor
    const exitUnder = svg("path", { class: "wn-exit-under", d: "" });
    const exit = svg("path", { class: "wn-exit", d: "" });
    const exitLabel = svg("text", { class: "wn-text wn-text--exit", x: W - 6, y: 14, "text-anchor": "end" }, "to the anchor →");
    g.append(exitUnder, exit, exitLabel);
    // names of the parts
    g.appendChild(svg("text", { class: "wn-text", x: xMotor + motorW / 2, y: H - 6, "text-anchor": "middle" }, "motor"));
    g.appendChild(svg("text", { class: "wn-text", x: x0 + drumW / 2, y: H - 6, "text-anchor": "middle" }, "drum, cut through: one circle per wrap"));
    g.appendChild(svg("text", { class: "wn-text", x: xGear + gearW / 2, y: H - 6, "text-anchor": "middle" }, "gearbox"));

    const node = svg("svg", { class: "drum-svg", viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "The winch from the front, its drum cut through: each circle is one wrap of rope, stacked in layers" }, g);
    // point at a wrap: its layer, and how much of the rated pull the winch has there
    node.addEventListener("pointermove", (e) => {
      const li = e.target.getAttribute ? e.target.getAttribute("data-layer") : null;
      const l = li === null ? null : dr.layers[+li];
      if (!l) return hideTip();
      showTip([`Layer ${l.n}`, `${Math.round(l.ratio * 100)}% of rated pull`, `holds ${U.n(l.capM, 0.1)} m of rope`], e.clientX, e.clientY);
    });
    node.addEventListener("pointerleave", hideTip);
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
        const d = `M ${from.cx} ${from.cy - r} C ${from.cx} ${flTop - 18}, ${W - 60} ${flTop - 22}, ${W - 6} 22`;
        exit.setAttribute("d", d);
        exitUnder.setAttribute("d", d);
      },
    };
  }

  // ------------------------------------------------------------ current gauge
  function gauge() {
    const cx = 110;
    const cy = 112;
    const R = 92;
    const pt = (f, r) => {
      const a = Math.PI - f * Math.PI;
      return `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy - r * Math.sin(a)).toFixed(2)}`;
    };
    const arc = (f0, f1, r) => `M ${pt(f0, r)} A ${r} ${r} 0 0 1 ${pt(f1, r)}`;
    const defs = svg("defs", null,
      svg("linearGradient", { id: "ga-grad", gradientUnits: "userSpaceOnUse", x1: cx - R, y1: 0, x2: cx + R, y2: 0 },
        svg("stop", { offset: 0, "stop-color": "#b9b0ff" }), svg("stop", { offset: 0.55, "stop-color": "#9085e9" }), svg("stop", { offset: 1, "stop-color": "#7c5cff" })),
      svg("filter", { id: "ga-glow", x: "-30%", y: "-30%", width: "160%", height: "160%" }, svg("feGaussianBlur", { stdDeviation: 4 })));
    const track = svg("path", { d: arc(0, 1, R), class: "ga-track" });
    const glow = svg("path", { d: arc(0, 0.001, R), class: "ga-fill ga-fill--glow", stroke: "url(#ga-grad)", filter: "url(#ga-glow)" });
    const fill = svg("path", { d: arc(0, 0.001, R), class: "ga-fill", stroke: "url(#ga-grad)" });
    const ticks = svg("g", { class: "ga-ticks" });
    const peak = svg("path", { class: "ga-peak", d: `M ${cx - 5} ${cy - R - 14} L ${cx + 5} ${cy - R - 14} L ${cx} ${cy - R - 6} Z` });
    const needle = svg("g", { class: "ga-needle" }, svg("path", { d: `M ${cx - 3.6} ${cy} L ${cx - 0.7} ${cy - R + 13} L ${cx + 0.7} ${cy - R + 13} L ${cx + 3.6} ${cy} Z` }));
    const hub = svg("g", { class: "ga-hub" }, svg("circle", { cx, cy, r: 8.5 }), svg("circle", { cx, cy, r: 3, class: "ga-hub-dot" }));
    const node = svg("svg", { class: "gauge-svg", viewBox: "0 0 220 124", role: "img", "aria-label": "Dial of the current the winch draws" }, defs, track, glow, fill, ticks, peak, needle, hub);
    let max = 500;
    return {
      el: node,
      setScale(peakA) {
        max = Math.max(300, Math.ceil((peakA * 1.1) / 100) * 100);
        const kids = [];
        for (let v = 0; v <= max; v += 50) {
          const major = v % 100 === 0;
          const a = Math.PI - (v / max) * Math.PI;
          const r1 = major ? R + 5 : R - 2;
          kids.push(svg("line", { class: major ? null : "ga-minor", x1: cx + (R - 7) * Math.cos(a), y1: cy - (R - 7) * Math.sin(a), x2: cx + r1 * Math.cos(a), y2: cy - r1 * Math.sin(a) }));
          if (major && (max <= 500 || v % 200 === 0)) kids.push(svg("text", { x: cx + (R - 22) * Math.cos(a), y: cy - (R - 22) * Math.sin(a) + 4, "text-anchor": "middle" }, String(v)));
        }
        ticks.replaceChildren(...kids);
        peak.style.transform = `rotate(${(peakA / max) * 180 - 90}deg)`;
      },
      set(amps) {
        const f = Math.max(0, Math.min(1, amps / max));
        needle.style.transform = `rotate(${f * 180 - 90}deg)`;
        const d = arc(0, Math.max(f, 0.001), R);
        fill.setAttribute("d", d);
        glow.setAttribute("d", d);
        glow.style.opacity = (0.25 + f * 0.6).toFixed(2);
        // at rest the round end of an empty arc would show as a dot
        fill.style.display = glow.style.display = f < 0.004 ? "none" : "";
      },
    };
  }

  // ------------------------------------------------------------ line chart with a playhead
  /*
   * o: { width, height, points, series: [{ key, cls, step, label, short }], yUnit,
   *      xLabel, labelEnds, tip(p) -> [lines], aria,
   *      area (key of the series to shade under), onScrub(x) (press or drag on the chart) }
   */
  let chartCount = 0;
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
    const uid = "ch" + ++chartCount;

    const g = svg("g", null);
    g.appendChild(svg("rect", { class: "ch-plot", x: pad.l, y: pad.t, width: W - pad.l - pad.r, height: H - pad.t - pad.b, rx: 4 }));
    for (let v = 0; v <= yMax + 1e-9; v += step) {
      g.appendChild(svg("line", { class: "ch-grid" + (v === 0 ? " ch-grid--base" : ""), x1: pad.l, x2: W - pad.r, y1: Y(v), y2: Y(v) }));
      g.appendChild(svg("text", { class: "ch-tick", x: pad.l - 8, y: Y(v) + 4, "text-anchor": "end" }, U.n(v, 1)));
    }
    g.appendChild(svg("text", { class: "ch-unit", x: 4, y: 11, "text-anchor": "start" }, o.yUnit));
    const xStep = niceStep(xMax / 4);
    for (let v = 0; v <= xMax + 1e-9; v += xStep) g.appendChild(svg("text", { class: "ch-tick", x: X(v), y: H - pad.b + 16, "text-anchor": "middle" }, U.n(v, xStep < 1 ? 0.1 : 1)));
    if (o.xLabel) g.appendChild(svg("text", { class: "ch-axis", x: (pad.l + W - pad.r) / 2, y: H - 4, "text-anchor": "middle" }, o.xLabel));

    const pathOf = (s) => {
      let d = "";
      pts.forEach((p, i) => {
        if (i === 0) d += `M ${X(p.x)} ${Y(p[s.key])}`;
        else if (s.step) d += ` L ${X(p.x)} ${Y(pts[i - 1][s.key])} L ${X(p.x)} ${Y(p[s.key])}`;
        else d += ` L ${X(p.x)} ${Y(p[s.key])}`;
      });
      return d;
    };
    const areaSeries = o.area && o.series.find((s) => s.key === o.area);
    if (areaSeries) {
      g.appendChild(svg("defs", null, svg("linearGradient", { id: uid + "-area", x1: 0, y1: 0, x2: 0, y2: 1 },
        svg("stop", { offset: 0, class: "ch-area-stop " + areaSeries.cls, "stop-opacity": 0.3 }),
        svg("stop", { offset: 1, class: "ch-area-stop " + areaSeries.cls, "stop-opacity": 0 }))));
      g.appendChild(svg("path", { class: "ch-area", fill: `url(#${uid}-area)`, d: `${pathOf(areaSeries)} L ${X(xMax)} ${Y(0)} L ${X(0)} ${Y(0)} Z` }));
    }
    o.series.forEach((s) => {
      const d = pathOf(s);
      g.appendChild(svg("path", { class: "ch-line ch-line--glow " + s.cls, d }));
      g.appendChild(svg("path", { class: "ch-line " + s.cls, d }));
    });
    if (o.labelEnds) {
      const last = pts[pts.length - 1];
      const ys = o.series.map((s) => Y(last[s.key]));
      const apart = ys.length === 2 && Math.abs(ys[0] - ys[1]) < 16 ? (ys[0] < ys[1] ? -8 : 8) : 0;
      o.series.forEach((s, i) => g.appendChild(svg("text", { class: "ch-label", x: W - pad.r + 8, y: ys[i] + 4 + (i === 0 ? apart : -apart) }, narrow ? s.short : s.label)));
    }

    // where the pointer is: a crosshair with a ring on each line
    const hover = svg("g", { class: "ch-hover", style: "display:none" },
      svg("line", { class: "ch-cross", y1: pad.t, y2: H - pad.b }),
      o.series.map((s) => svg("circle", { class: "ch-ring " + s.cls, r: 6 })));
    const head = svg("line", { class: "ch-playhead", x1: X(0), x2: X(0), y1: pad.t, y2: H - pad.b });
    const dots = o.series.map((s) => svg("circle", { class: "ch-dot " + s.cls, r: 4.5, cx: X(0), cy: Y(pts[0][s.key]) }));
    g.append(hover, head, ...dots);
    const hit = svg("rect", { class: "ch-hit" + (o.onScrub ? " is-scrub" : ""), x: pad.l, y: pad.t, width: W - pad.l - pad.r, height: H - pad.t - pad.b, fill: "transparent" });
    g.appendChild(hit);
    const node = svg("svg", { class: "chart-svg", viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", "aria-label": o.aria }, g);
    let down = false;
    const point = (e) => {
      const box = node.getBoundingClientRect();
      const sx = ((e.clientX - box.left) / box.width) * W;
      const x = Math.max(0, Math.min(xMax, ((sx - pad.l) / (W - pad.l - pad.r)) * xMax));
      const p = pts.reduce((a, b) => (Math.abs(b.x - x) < Math.abs(a.x - x) ? b : a));
      hover.style.display = "";
      hover.firstChild.setAttribute("x1", X(p.x));
      hover.firstChild.setAttribute("x2", X(p.x));
      o.series.forEach((s, i) => {
        hover.childNodes[i + 1].setAttribute("cx", X(p.x));
        hover.childNodes[i + 1].setAttribute("cy", Y(p[s.key]));
      });
      showTip(o.tip(p), e.clientX, e.clientY);
      if (down && o.onScrub) o.onScrub(x);
    };
    const leave = () => {
      down = false;
      hover.style.display = "none";
      hideTip();
    };
    hit.addEventListener("pointerdown", (e) => {
      down = true;
      if (o.onScrub && hit.setPointerCapture) hit.setPointerCapture(e.pointerId);
      point(e);
    });
    hit.addEventListener("pointermove", point);
    hit.addEventListener("pointerup", (e) => {
      down = false;
      if (e.pointerType !== "mouse") leave();
    });
    hit.addEventListener("pointercancel", leave);
    hit.addEventListener("pointerleave", () => { if (!down) leave(); });

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
  // onChange(deg): called while the anchor is dragged round.
  function angleView(onChange) {
    const rope = svg("g", { class: "av-rope" },
      svg("line", { x1: 46, y1: 34, x2: 118, y2: 34, class: "av-line-under" }),
      svg("line", { x1: 46, y1: 34, x2: 118, y2: 34, class: "av-line" }),
      svg("circle", { cx: 124, cy: 34, r: 7, class: "av-tree" }),
      svg("circle", { cx: 124, cy: 34, r: 3, class: "av-ring" }),
      onChange ? svg("circle", { cx: 124, cy: 34, r: 10.5, class: "av-grip" }) : null);
    const node = svg("svg", { class: "angle-svg" + (onChange ? " is-drag" : ""), viewBox: "0 0 140 68", "aria-hidden": "true" },
      svg("defs", null, grad("av-paint", { x1: 0, y1: 0, x2: 0, y2: 1 }, [[0, "#2c4279"], [1, "#16224a"]])),
      svg("line", { x1: 46, y1: 34, x2: 132, y2: 34, class: "av-path" }),
      svg("path", { d: "M10 22 h30 q6 0 6 6 v12 q0 6 -6 6 h-30 q-4 0 -4 -4 v-16 q0 -4 4 -4 Z", class: "av-veh", fill: "url(#av-paint)" }),
      svg("rect", { x: 28, y: 25, width: 8, height: 18, rx: 2, class: "av-glass" }),
      svg("path", { class: "av-arc", d: "" }),
      rope);
    const arc = node.querySelector(".av-arc");
    if (onChange) {
      let down = false;
      const turn = (e) => {
        const box = node.getBoundingClientRect();
        const x = ((e.clientX - box.left) / box.width) * 140 - 46;
        const y = ((e.clientY - box.top) / box.height) * 68 - 34;
        onChange(Math.max(0, Math.min(90, Math.round((Math.atan2(-y, Math.max(x, 1)) * 180) / Math.PI))));
      };
      node.addEventListener("pointerdown", (e) => {
        down = true;
        node.classList.add("is-dragging");
        node.setPointerCapture(e.pointerId);
        turn(e);
        e.preventDefault();
      });
      node.addEventListener("pointermove", (e) => { if (down) turn(e); });
      const up = () => {
        down = false;
        node.classList.remove("is-dragging");
      };
      node.addEventListener("pointerup", up);
      node.addEventListener("pointercancel", up);
    }
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

  root.WINCH_DIAGRAMS = { scene, slopeDrag, lineThumb, rigging, drum, gauge, lineChart, angleView, LOOKS };
})(window);
