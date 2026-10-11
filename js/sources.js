/*
 * sources.js: builds sources.html from data.js: every rule with its category,
 * summary, the exact words quoted from the source, and the sources; then the
 * gaps (what nobody publishes) and the full source list. Each rule has an
 * anchor (#rule-id) that the calculator's "Sources:" links point to.
 */
(function () {
  "use strict";

  const D = window.WINCH_DATA;
  const U = window.WINCH_UI;
  const { el, externalLink } = U;

  const GROUPS = [
    { category: "method", title: "Recovery method", intro: "The resistance estimate: a published method from the International 4WD Trainers Association, checked against their own field measurements." },
    { category: "maker", title: "Manufacturers", intro: "Figures and practice published by winch, rigging and rope makers. Your own gear's label or manual beats these." },
    { category: "standard", title: "Standards", intro: "Standards and mandatory product-safety rules." },
    { category: "engineering", title: "Engineering practice", intro: "Practice from engineering bodies." },
    { category: "calculation", title: "This site's calculations", intro: "Plain physics (statics, energy, electrical resistance) applied by this site. Not from a source as such, so they're listed separately and labelled where they're used." },
  ];

  function sourceItem(id) {
    const s = D.sources[id];
    const links = [s.url].concat(s.moreUrls || []).filter(Boolean);
    return el("li", null, links.length ? [externalLink(links[0], s.label), links.slice(1).map((u, i) => [" · ", externalLink(u, "second listing")])] : s.label);
  }

  function renderRule(r) {
    return el(
      "li",
      { class: "source-item", id: r.id, tabindex: "-1" },
      el("h3", null, r.title, U.categoryTag(r.category)),
      el("p", null, r.summary),
      r.quote ? el("blockquote", { class: "source-quote" }, "“" + r.quote + "”") : null,
      el("ul", { class: "source-meta" }, r.sources.map(sourceItem)),
      el("p", { class: "source-meta" }, el("strong", null, "Last checked: "), new Date(r.checked + "T00:00:00").toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" }))
    );
  }

  const root = document.getElementById("source-groups");
  GROUPS.forEach((g) => {
    const rules = D.rules.filter((r) => r.category === g.category);
    if (!rules.length) return;
    root.appendChild(
      el("section", { class: "source-group", id: "group-" + g.category },
        el("h2", null, g.title),
        el("p", { class: "muted" }, g.intro),
        el("ul", { class: "source-list" }, rules.map(renderRule)))
    );
  });

  root.appendChild(
    el("section", { class: "source-group", id: "gaps" },
      el("h2", null, "No published figure"),
      el("p", { class: "muted" }, "What the calculator doesn't put a number on, because no engineering source, standard or maker found publishes one."),
      el("ul", { class: "source-list" }, D.gaps.map((g) => el("li", { class: "source-item", id: "gap-" + g.id }, el("h3", null, g.title), el("p", null, g.text)))))
  );

  root.appendChild(
    el("section", { class: "source-group", id: "all-sources" },
      el("h2", null, "Every source"),
      el("ul", { class: "source-list" }, Object.keys(D.sources).map((id) => el("li", { class: "source-item" }, el("ul", { class: "source-meta plain-list" }, sourceItem(id)), U.categoryTag(D.sources[id].kind)))))
  );

  // Arriving from a "Sources:" link: show the rule.
  if (location.hash) {
    const t = document.getElementById(location.hash.slice(1));
    if (t) t.focus();
  }
  document.getElementById("year").textContent = new Date().getFullYear();
})();
