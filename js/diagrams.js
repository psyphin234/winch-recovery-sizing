/*
 * diagrams.js: SVG and HTML drawings built from calc.js results.
 *   resistanceBar  stacked bar of where the pull comes from (+ legend that doubles as the table)
 *   rigging        top view of the rope run: tension on each length, load on each block and the anchor
 *   drum           the drum's layers: rope left on at the start, wound on during the pull, empty
 *   pullChart      pull available vs pull needed along the recovery, with a crosshair tooltip
 * Text stays in text colours; series colours only mark identity (--series-* in style.css).
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
  function tooltip() {
    if (!tip) {
      tip = el("div", { class: "viz-tip", role: "presentation", hidden: true });
      document.body.appendChild(tip);
    }
    return tip;
  }
  function showTip(lines, clientX, clientY) {
    const t = tooltip();
    t.replaceChildren(...lines.map((l, i) => el(i === 0 ? "strong" : "span", null, l)));
    t.hidden = false;
    const w = t.offsetWidth;
    const h = t.offsetHeight;
    const x = Math.min(window.innerWidth - w - 8, Math.max(8, clientX + 14));
    const y = clientY - h - 12 < 8 ? clientY + 16 : clientY - h - 12;
    t.style.left = x + window.scrollX + "px";
    t.style.top = y + window.scrollY + "px";
  }
  function hideTip() {
    if (tip) tip.hidden = true;
  }

  // ------------------------------------------------------------ resistance bar
  function resistanceBar(r) {
    const parts = [
      { key: "ground", label: "Ground", kg: r.groundKg, cls: "seg-1", note: "weight ÷ " + r.gcf },
      { key: "grade", label: "Gradient", kg: Math.max(0, r.gradeKg), cls: "seg-2", note: "weight × sin " + U.n(Math.abs(r.gradeDeg), 0.1) + "°" },
      { key: "damage", label: "Wheels that can't roll", kg: r.damageKg, cls: "seg-3", note: r.stuckWheels + " of " + r.wheels + " wheels" },
      { key: "margin", label: "25% safety margin", kg: r.marginKg, cls: "seg-margin", note: "I4WDTA" },
    ].filter((p) => p.kg > 0.5);
    const total = parts.reduce((s, p) => s + p.kg, 0) || 1;

    const bar = el("div", { class: "rbar", role: "img", "aria-label": "Where the pull comes from: " + parts.map((p) => p.label + " " + U.kg(p.kg)).join(", ") });
    parts.forEach((p) => {
      const seg = el("div", { class: "rbar-seg " + p.cls, style: "flex-grow:" + p.kg / total, tabindex: "0" });
      const lines = [p.label, U.kg(p.kg) + " (" + Math.round((p.kg / total) * 100) + "%)", p.note];
      seg.addEventListener("pointermove", (e) => showTip(lines, e.clientX, e.clientY));
      seg.addEventListener("pointerleave", hideTip);
      seg.addEventListener("focus", () => {
        const b = seg.getBoundingClientRect();
        showTip(lines, b.left + b.width / 2, b.top);
      });
      seg.addEventListener("blur", hideTip);
      bar.appendChild(seg);
    });

    const rows = [
      { label: "Ground", note: r.ground.chosen.label + (r.ground.isProxy ? " (as " + r.ground.used.label.toLowerCase() + ", your choice)" : "") + ": weight ÷ " + r.gcf + (r.bogged ? " (bogged: factor less 1)" : ""), kg: r.groundKg, cls: "seg-1" },
      { label: r.gradeKg < 0 ? "Gradient (downhill helps)" : "Gradient", note: U.n(Math.abs(r.gradeDeg), 0.1) + "°" + (r.gradeKg < 0 ? " downhill" : "") + ": weight × sin(angle)", kg: r.gradeKg, cls: "seg-2" },
      { label: "Wheels that can't roll", note: r.stuckWheels + " of " + r.wheels + ": weight × " + r.stuckWheels + " ÷ " + r.wheels, kg: r.damageKg, cls: "seg-3" },
      { label: "Safety margin", note: "25% of the above", kg: r.marginKg, cls: "seg-margin" },
    ];
    const table = el(
      "table",
      { class: "legend-table" },
      el("tbody", null, rows.map((row) =>
        el("tr", null,
          el("th", { scope: "row" }, el("span", { class: "swatch " + row.cls, "aria-hidden": "true" }), row.label, el("small", null, row.note)),
          el("td", { class: "num" }, (row.kg < 0 ? "−" : "") + U.kg(Math.abs(row.kg)))
        )
      )),
      el("tfoot", null, el("tr", null, el("th", { scope: "row" }, "Total resistance"), el("td", { class: "num" }, U.kg(r.totalKg))))
    );
    return el("figure", { class: "rbar-figure" }, bar, table);
  }

  // ------------------------------------------------------------ rigging (top view)
  // Drawn at the panel's own width (1 SVG unit = 1 CSS px), so text stays readable on phones.
  function rigging(rig, width) {
    const n = rig.parts;
    const W = Math.max(300, Math.min(640, Math.round(width || 640)));
    const narrow = W < 480;
    const top = 58;
    const gap = 46;
    const H = top + (n - 1) * gap + 70;
    const xVeh = narrow ? 92 : 150; // vehicle front
    const treeR = narrow ? 20 : 24;
    const treeX = W - treeR - 8;
    const xAnc = W - (narrow ? 84 : 120); // anchor side blocks
    const strapX = treeX - treeR;
    const yOf = (k) => top + k * gap;

    const g = svg("g", null);
    // vehicle
    const vy = yOf(0) - 26;
    const vh = Math.max(52, (n - 1) * gap + 52);
    g.appendChild(svg("rect", { class: "rg-vehicle", x: 8, y: vy, width: xVeh - 20, height: vh, rx: 10 }));
    g.appendChild(svg("text", { class: "rg-label", x: 8 + (xVeh - 20) / 2, y: vy + vh / 2 + 6, "text-anchor": "middle" }, "Vehicle"));
    g.appendChild(svg("rect", { class: "rg-winch", x: xVeh - 18, y: yOf(0) - 9, width: 16, height: 18, rx: 3 }));
    // anchor (tree)
    const ty = yOf(0) + ((n - 1) * gap) / 2;
    g.appendChild(svg("circle", { class: "rg-tree", cx: treeX, cy: ty, r: treeR }));
    g.appendChild(svg("text", { class: "rg-label", x: W - 4, y: ty + treeR + 22, "text-anchor": "end" }, "Anchor"));
    g.appendChild(svg("text", { class: "rg-value", x: W - 4, y: ty + treeR + 42, "text-anchor": "end" }, U.kg(rig.anchorKg)));

    // rope lengths
    for (let k = 0; k < n; k++) {
      const y = yOf(k);
      const x1 = k === 0 ? xVeh - 2 : xVeh + 8;
      const x2 = k === n - 1 && n % 2 === 1 ? strapX : xAnc;
      g.appendChild(svg("line", { class: "rg-rope", x1, y1: y, x2, y2: y }));
      g.appendChild(svg("text", { class: "rg-seg", x: xVeh + (xAnc - xVeh) * (narrow ? 0.36 : 0.5), y: y - 7, "text-anchor": "middle" }, U.kg(rig.segments[k])));
    }
    // blocks
    rig.points.forEach((p, i) => {
      if (p.kind === "block") {
        const j = i + 1;
        const yA = yOf(j - 1);
        const yB = yOf(j);
        const x = p.at === "anchor" ? xAnc : xVeh + 8;
        const cy = (yA + yB) / 2;
        const rr = (yB - yA) / 2;
        const sweep = p.at === "anchor" ? 1 : 0;
        g.appendChild(svg("path", { class: "rg-rope", d: `M ${x} ${yA} A ${rr} ${rr} 0 0 ${sweep} ${x} ${yB}`, fill: "none" }));
        const bx = p.at === "anchor" ? x + rr : x - rr;
        g.appendChild(svg("circle", { class: "rg-block", cx: bx, cy, r: 9 }));
        if (p.at === "anchor") {
          g.appendChild(svg("line", { class: "rg-strap", x1: bx + 9, y1: cy, x2: strapX, y2: ty }));
        }
        // label between the two ropes it joins, on the open side of the block
        g.appendChild(svg("text", { class: "rg-blocklabel", x: p.at === "anchor" ? bx - 16 : bx + 16, y: cy + 5, "text-anchor": p.at === "anchor" ? "end" : "start" }, (narrow ? "" : "Block " + j + ": ") + U.kg(p.loadKg)));
      } else {
        const y = yOf(n - 1);
        if (p.at === "vehicle") {
          g.appendChild(svg("circle", { class: "rg-end", cx: xVeh + 8, cy: y, r: 5 }));
        } else {
          g.appendChild(svg("line", { class: "rg-strap", x1: strapX, y1: y, x2: strapX + 6, y2: ty }));
        }
      }
    });
    // the winch's own pull
    g.appendChild(svg("text", { class: "rg-label", x: xVeh, y: top - 34, "text-anchor": "start" }, "Winch pulls " + U.kg(rig.winchKg)));

    const caption = n === 1
      ? "Single line: the winch pulls the full load, and the anchor takes the same."
      : `${n} lengths of rope pull on the vehicle. Each block loses 8% to friction (LEEA), so the winch pulls ${U.kg(rig.winchKg)}, not ${U.kg(rig.anchorKg / n)}. The anchor still takes the full ${U.kg(rig.anchorKg)}.`;
    return el(
      "figure",
      { class: "rigging-figure" },
      svg("svg", { class: "rigging-svg", viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", "aria-label": caption }, g),
      el("figcaption", { class: "hint" }, caption)
    );
  }

  // ------------------------------------------------------------ drum layers
  function drum(dr, startOnDrumM, endOnDrumM, minWrapsM, ropeType, width) {
    const W = Math.max(300, Math.min(640, Math.round(width || 640)));
    const narrow = W < 520;
    const layers = dr.layers;
    const band = 26;
    const H = 24 + layers.length * band + 46;
    const x0 = 22;
    const x1 = narrow ? Math.round(W * 0.48) : 380;
    const baseY = H - 46;
    const g = svg("g", null);
    // barrel and flanges
    g.appendChild(svg("rect", { class: "dr-barrel", x: x0, y: baseY, width: x1 - x0, height: 18, rx: 3 }));
    g.appendChild(svg("rect", { class: "dr-flange", x: x0 - 12, y: baseY - layers.length * band - 14, width: 12, height: layers.length * band + 32, rx: 3 }));
    g.appendChild(svg("rect", { class: "dr-flange", x: x1, y: baseY - layers.length * band - 14, width: 12, height: layers.length * band + 32, rx: 3 }));

    layers.forEach((l, i) => {
      const y = baseY - (i + 1) * band + 2;
      const wFor = (m) => Math.max(0, Math.min(1, (m - l.startM) / l.capM)) * (x1 - x0);
      const minW = wFor(minWrapsM);
      const startW = wFor(startOnDrumM);
      const endW = wFor(endOnDrumM);
      g.appendChild(svg("rect", { class: "dr-empty", x: x0, y, width: x1 - x0, height: band - 4, rx: 4 }));
      if (endW > startW) g.appendChild(svg("rect", { class: "dr-wound", x: x0 + startW, y, width: endW - startW, height: band - 4, rx: 4 }));
      if (startW > 0) g.appendChild(svg("rect", { class: "dr-start", x: x0, y, width: startW, height: band - 4, rx: 4 }));
      if (minW > 0) g.appendChild(svg("rect", { class: "dr-min", x: x0, y, width: Math.min(minW, x1 - x0), height: band - 4, rx: 4 }));
      g.appendChild(svg("text", { class: "dr-text", x: x1 + 24, y: y + band / 2 + 3 }, narrow ? `L${l.n} · ${Math.round(l.ratio * 100)}% · ${U.n(l.capM, 0.1)} m` : `Layer ${l.n} · ${Math.round(l.ratio * 100)}% of rated pull · ${U.n(l.capM, 0.1)} m`));
    });
    g.appendChild(svg("text", { class: "dr-text dr-muted", x: x0, y: H - 8 }, narrow ? `Drum ${U.n(dr.drumDiaMm, 1)} × ${U.n(dr.drumLengthMm, 1)} mm · ${dr.wraps} wraps a layer` : `Drum ${U.n(dr.drumDiaMm, 1)} mm × ${U.n(dr.drumLengthMm, 1)} mm, ${dr.wraps} wraps of ${U.n(dr.ropeDiaMm, 0.1)} mm rope per layer`));

    const legend = el(
      "ul",
      { class: "viz-legend" },
      el("li", null, el("span", { class: "swatch dr-min-swatch", "aria-hidden": "true" }), `Must stay on the drum (${ropeType === "synthetic" ? 10 : 5} wraps)`),
      el("li", null, el("span", { class: "swatch dr-start-swatch", "aria-hidden": "true" }), "On the drum at the start"),
      el("li", null, el("span", { class: "swatch dr-wound-swatch", "aria-hidden": "true" }), "Wound on during the pull"),
      el("li", null, el("span", { class: "swatch dr-empty-swatch", "aria-hidden": "true" }), "Paid out at the end")
    );
    return el(
      "figure",
      { class: "drum-figure" },
      svg("svg", { class: "drum-svg", viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", "aria-label": `Drum with ${layers.length} layers; the pull starts on layer ${layerOf(dr, startOnDrumM)} and ends on layer ${layerOf(dr, endOnDrumM)}.` }, g),
      legend
    );
  }
  function layerOf(dr, m) {
    return root.WINCH_CALC.layerAt(dr, m).n;
  }

  // ------------------------------------------------------------ pull along the recovery
  function pullChart(sim, width) {
    const W = Math.max(300, Math.min(640, Math.round(width || 640)));
    const narrow = W < 480;
    const H = narrow ? 230 : 260;
    const pad = { l: 56, r: narrow ? 66 : 112, t: 16, b: 40 };
    const pts = sim.points;
    const xMax = pts[pts.length - 1].x || 1;
    const yMaxRaw = Math.max(...pts.map((p) => Math.max(p.availKg, p.neededKg)));
    const step = niceStep(yMaxRaw / 4);
    const yMax = Math.ceil((yMaxRaw * 1.08) / step) * step;
    const X = (x) => pad.l + (x / xMax) * (W - pad.l - pad.r);
    const Y = (y) => H - pad.b - (y / yMax) * (H - pad.t - pad.b);

    const g = svg("g", null);
    for (let v = 0; v <= yMax + 1e-9; v += step) {
      g.appendChild(svg("line", { class: "ch-grid", x1: pad.l, x2: W - pad.r, y1: Y(v), y2: Y(v) }));
      g.appendChild(svg("text", { class: "ch-tick", x: pad.l - 8, y: Y(v) + 4, "text-anchor": "end" }, U.n(v, 1)));
    }
    const xStep = niceStep(xMax / 4);
    for (let v = 0; v <= xMax + 1e-9; v += xStep) {
      g.appendChild(svg("text", { class: "ch-tick", x: X(v), y: H - pad.b + 18, "text-anchor": "middle" }, U.n(v, xStep < 1 ? 0.1 : 1)));
    }
    g.appendChild(svg("text", { class: "ch-axis", x: (pad.l + W - pad.r) / 2, y: H - 4, "text-anchor": "middle" }, "Metres the vehicle has moved"));
    g.appendChild(svg("text", { class: "ch-axis", x: 14, y: pad.t + (H - pad.t - pad.b) / 2, transform: `rotate(-90 14 ${pad.t + (H - pad.t - pad.b) / 2})`, "text-anchor": "middle" }, "kg"));

    // available: a step line (it changes only when a layer changes)
    let d = "";
    pts.forEach((p, i) => {
      d += i === 0 ? `M ${X(p.x)} ${Y(p.availKg)}` : ` L ${X(p.x)} ${Y(pts[i - 1].availKg)} L ${X(p.x)} ${Y(p.availKg)}`;
    });
    g.appendChild(svg("path", { class: "ch-line ch-line--avail", d }));
    g.appendChild(svg("line", { class: "ch-line ch-line--need", x1: X(0), x2: X(xMax), y1: Y(pts[0].neededKg), y2: Y(pts[0].neededKg) }));
    // direct labels at the right end
    const last = pts[pts.length - 1];
    const ya = Y(last.availKg);
    const yn = Y(last.neededKg);
    const apart = Math.abs(ya - yn) < 16 ? (ya < yn ? -8 : 8) : 0;
    g.appendChild(svg("text", { class: "ch-label", x: W - pad.r + 8, y: ya + 4 + apart },  narrow ? "Can pull" : "Winch can pull"));
    g.appendChild(svg("text", { class: "ch-label", x: W - pad.r + 8, y: yn + 4 - apart }, narrow ? "Needed" : "Rope pull needed"));

    // crosshair + tooltip
    const cross = svg("line", { class: "ch-cross", x1: 0, x2: 0, y1: pad.t, y2: H - pad.b, visibility: "hidden" });
    const dotA = svg("circle", { class: "ch-dot ch-dot--avail", r: 5, visibility: "hidden" });
    const dotN = svg("circle", { class: "ch-dot ch-dot--need", r: 5, visibility: "hidden" });
    g.append(cross, dotA, dotN);
    const hit = svg("rect", { x: pad.l, y: pad.t, width: W - pad.l - pad.r, height: H - pad.t - pad.b, fill: "transparent" });
    g.appendChild(hit);
    const chart = svg("svg", { class: "pull-svg", viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", "aria-label": "Line chart of the pull the winch can give, layer by layer, against the rope pull needed, over the distance pulled. The table below has the same figures." }, g);
    hit.addEventListener("pointermove", (e) => {
      const box = chart.getBoundingClientRect();
      const sx = ((e.clientX - box.left) / box.width) * W;
      const x = Math.max(0, Math.min(xMax, ((sx - pad.l) / (W - pad.l - pad.r)) * xMax));
      const p = pts.reduce((a, b) => (Math.abs(b.x - x) < Math.abs(a.x - x) ? b : a));
      [cross].forEach((c) => {
        c.setAttribute("x1", X(p.x));
        c.setAttribute("x2", X(p.x));
        c.setAttribute("visibility", "visible");
      });
      dotA.setAttribute("cx", X(p.x));
      dotA.setAttribute("cy", Y(p.availKg));
      dotN.setAttribute("cx", X(p.x));
      dotN.setAttribute("cy", Y(p.neededKg));
      dotA.setAttribute("visibility", "visible");
      dotN.setAttribute("visibility", "visible");
      showTip([`${U.n(p.x, 0.1)} m moved, layer ${p.layer}`, `Winch can pull ${U.kg(p.availKg)}`, `Needed ${U.kg(p.neededKg)}`, `${U.n(p.amps, 1)} A, rope ${U.n(p.lineSpeedMMin, 0.1)} m/min`], e.clientX, e.clientY);
    });
    hit.addEventListener("pointerleave", () => {
      [cross, dotA, dotN].forEach((c) => c.setAttribute("visibility", "hidden"));
      hideTip();
    });

    const legend = el(
      "ul",
      { class: "viz-legend" },
      el("li", null, el("span", { class: "swatch line-swatch line-swatch--avail", "aria-hidden": "true" }), "Winch can pull (rated pull on the layer in use)"),
      el("li", null, el("span", { class: "swatch line-swatch line-swatch--need", "aria-hidden": "true" }), "Rope pull needed, with the 25% margin")
    );
    return el("figure", { class: "pull-figure" }, legend, chart);
  }

  function niceStep(raw) {
    const p = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-9))));
    const f = raw / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  }

  root.WINCH_DIAGRAMS = { resistanceBar, rigging, drum, pullChart };
})(window);
