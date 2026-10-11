/*
 * ui.js: small DOM and formatting helpers shared by index.html and
 * sources.html. All text goes in via textContent, never innerHTML.
 */
(function (root) {
  "use strict";

  const D = root.WINCH_DATA;
  const C = root.WINCH_CALC;

  // "3 500 kg" -> non-breaking spaces, so a number never wraps across lines.
  function keepNumbersTogether(text) {
    return text.replace(/(\d) (?=\d{3}\b)/g, "$1 ").replace(/(\d) (kg|kN|lb|km\/h|m|mm|A|Ah|V|t|%|°)(?=$|[\s.,;:)·])/g, "$1 $2");
  }

  // el("p", { class: "x" }, "text", childNode, ...)
  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v === null || v === undefined || v === false) return;
      if (k === "class") node.className = v;
      else node.setAttribute(k, v === true ? "" : v);
    });
    children.flat(Infinity).forEach((c) => {
      if (c === null || c === undefined || c === false) return;
      node.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(keepNumbersTogether(String(c))) : c);
    });
    return node;
  }

  function externalLink(url, text) {
    return el("a", { href: url, target: "_blank", rel: "noopener noreferrer" }, text);
  }

  // 12345.6 -> "12 350" (rounded to `step`, space as thousands separator)
  function n(x, step) {
    const s = step || 1;
    const v = Math.round(x / s) * s;
    const fixed = s < 1 ? v.toFixed(Math.max(0, -Math.floor(Math.log10(s)))) : String(Math.round(v));
    const [int, dec] = fixed.split(".");
    const sign = int.startsWith("-") ? "-" : "";
    const digits = sign ? int.slice(1) : int;
    return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ") + (dec ? "." + dec : "");
  }

  const kg = (x) => n(x, Math.abs(x) >= 1000 ? 10 : 5) + " kg";
  const lb = (x) => n(C.kgToLb(x), 50) + " lb";
  const kn = (x) => n(C.kgToKn(x), 0.1) + " kN";
  // Minimum ratings round UP, so a minimum is never shown below itself.
  const lbMin = (x) => n(Math.ceil(C.kgToLb(x) / 100) * 100, 1) + " lb";
  const kgMin = (x) => n(Math.ceil(x / 10) * 10, 1) + " kg";
  const force = (x) => kg(x) + " · " + kn(x) + " · " + lb(x);
  const tonnes = (t) => n(t, t < 10 ? 0.01 : 0.1).replace(/\.?0+$/, "") + " t";

  // Tag for a rule's category, as on the sources page.
  const CATEGORY = {
    method: { label: "Recovery method", cls: "tag--method" },
    maker: { label: "Manufacturer", cls: "tag--maker" },
    standard: { label: "Standard", cls: "tag--standard" },
    engineering: { label: "Engineering", cls: "tag--engineering" },
    calculation: { label: "Calculation", cls: "tag--calc" },
  };
  function categoryTag(category) {
    const c = CATEGORY[category];
    return el("span", { class: "tag " + c.cls }, c.label);
  }

  // One line per card: the rules it used, linking to the sources page (new tab, so inputs survive).
  function sourcesLine(ruleIds) {
    const ids = ruleIds.filter((id, i) => ruleIds.indexOf(id) === i);
    const items = ids.map((id) => {
      const r = D.rule(id);
      return el("li", null, el("a", { href: "sources.html#" + id, target: "_blank", title: "Where this comes from (opens the Sources page)" }, r.title));
    });
    return el("div", { class: "rule-links" }, el("span", { class: "rule-links-label" }, "Sources:"), el("ul", { "aria-label": "Where these numbers come from" }, items));
  }

  // Coloured status icon + label: never colour alone.
  const ICON = { pass: "✓", warn: "!", fail: "✕", info: "i", incomplete: "?" };
  function statusIcon(status) {
    return el("span", { class: "status-icon", "aria-hidden": "true" }, ICON[status] || "?");
  }

  function figure(label, value, sub, extraClass) {
    return el("div", { class: "figure" + (extraClass ? " " + extraClass : "") }, el("span", { class: "figure-label" }, label), el("span", { class: "figure-value" }, value), sub ? el("span", { class: "figure-sub" }, sub) : null);
  }

  function check(status, title, reason, extra, label) {
    return el(
      "li",
      { class: "check check--" + status },
      el("div", { class: "check-head" }, statusIcon(status), el("h3", null, title), el("span", { class: "status-label" }, label !== undefined ? label : { pass: "OK", warn: "Close", fail: "Not enough", info: "", incomplete: "Needs input" }[status])),
      reason ? el("p", { class: "check-reason" }, reason) : null,
      extra || null
    );
  }

  root.WINCH_UI = { el, externalLink, n, kg, lb, kn, lbMin, kgMin, force, tonnes, categoryTag, sourcesLine, statusIcon, figure, check, CATEGORY };
})(window);
