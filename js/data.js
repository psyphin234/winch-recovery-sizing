/*
 * data.js: THE data file. Every number the calculator uses lives here, next to
 * the source it comes from. calc.js, app.js and the HTML read these values;
 * they must not hard-code them.
 *
 * Rule categories (drive the tag shown on the sources page):
 *   method      - a published recovery method from a training body (I4WDTA)
 *   maker       - a winch or rigging manufacturer's published figure
 *   engineering - an engineering body's practice (LEEA)
 *   calculation - this site's own physics; says so wherever it is shown
 *
 * Source policy: engineering, standards, manufacturers' data and published
 * training methods only. No forum, club or "everyone says" figures. Where
 * nothing citable exists, add an entry to `gaps` and say so on the page.
 *
 * This page is about winching only. Straps and kinetic recovery are for a
 * separate page (their rules are in git history, commit 8565449 and before).
 */
(function (root) {
  "use strict";

  const sources = {
    i4wdta: {
      label: "I4WDTA (International 4WD Trainers Association), Recovery Resistance Calculations, 2020",
      url: "https://i4wdta.org/wp-content/uploads/2024/04/Recovery-Resistance-Calculations.pdf",
      kind: "method",
    },
    sibly: {
      label: "Ken Sibly, The New Zealand 4 Wheel Drive Handbook, Shoal Bay Press, 2004, p. 195 (cited by I4WDTA for the ground factors)",
      url: null,
      kind: "method",
    },
    warnChoose: {
      label: "WARN Industries, How to Choose the Right Winch",
      url: "https://www.warn.com/how-to-choose-the-right-winch",
      kind: "maker",
    },
    warnLayers: {
      label: "WARN Industries, Winch Performance Specifications: Pulling Capacity by Layer",
      url: "https://www.warn.com/warn-winch-performance-specifications-pulling-capacity-by-layer",
      kind: "maker",
    },
    warnZeon10: {
      label: "WARN ZEON 10 (12 V, steel rope) published specification and first-layer performance chart, as listed by 4x4 Down Under",
      url: "https://4x4downunder.com.au/products/warn-zeon-10-12v-10-000lb-winch-steel-wire",
      kind: "maker",
    },
    warnBattery: {
      label: "WARN Industries, Winch Battery Basics",
      url: "https://www.warn.com/blogs/articles/winch-battery-basics",
      kind: "maker",
    },
    warnBlock: {
      label: "WARN Industries, Heavy Duty Snatch Block 24 000 lb (part 80858)",
      url: "https://www.warn.com/products/heavy-duty-snatch-block-24-000-lb-80858",
      kind: "maker",
    },
    leea: {
      label: "LEEA (Lifting Equipment Engineers Association), COPSULE edition 10, topic 7.5.6 Rigging Arrangement",
      url: "https://copsule.leeaint.com/copsule/en-GB/latest/id-c327f720-b276-40dd-e93a-8f4a4d19bcff.html",
      kind: "engineering",
    },
    crosby: {
      label: "Crosby (Kito Crosby), G-209 / S-209 Screw Pin Anchor Shackles",
      url: "https://kitocrosby.com/product/crosby-g-209-s-209-screw-pin-anchor-shackles/",
      kind: "maker",
    },
    physics: {
      label: "Physics (statics): this site's own calculation",
      url: null,
      kind: "calculation",
    },
  };

  /*
   * Ground condition factors (GCF), I4WDTA after Sibly. The resistance on that
   * ground is the vehicle's weight divided by the factor.
   * Snow and rock: no published factor found (see gaps); the user picks the
   * nearest published ground instead, and the page says it's their choice.
   * `look` is only how the ground is drawn in the scene, not data.
   */
  const grounds = [
    { id: "road", label: "Tar", gcf: 25, look: "road" },
    { id: "gravel", label: "Gravel", gcf: 5, look: "gravel" },
    { id: "grass", label: "Grass", gcf: 7, look: "grass" },
    { id: "wetsand-hard", label: "Hard wet sand", gcf: 6, look: "wetsand" },
    { id: "drysand", label: "Loose dry sand", gcf: 4, look: "sand" },
    { id: "wetsand-loose", label: "Loose wet sand", gcf: 3, look: "wetsand" },
    { id: "shingle", label: "Shingle", gcf: 3, look: "shingle" },
    { id: "mud-shallow", label: "Shallow mud", gcf: 3, look: "mud" },
    { id: "mud-deep", label: "Deep mud", gcf: 2, look: "deepmud" },
    { id: "clay", label: "Soft clay", gcf: 2, look: "clay" },
    { id: "snow", label: "Snow", gcf: null, proxy: true, look: "snow" },
    { id: "rock", label: "Rock", gcf: null, proxy: true, look: "rock" },
  ];

  // How deep it's stuck: the three choices on the page.
  const bogLevels = [
    { id: "none", label: "Not bogged", rule: null },
    { id: "axles", label: "Bogged to the axles", rule: "bogged-axles" },
    { id: "chassis", label: "Bogged to the chassis", rule: "bogged-chassis" },
  ];

  // Crosby G-209 screw pin anchor shackles: nominal size, pin, WLL (t).
  // Minimum ultimate strength is 6 x WLL (Crosby's 6:1 design factor).
  const shackles = [
    { size: '1/2"', pinMm: 13, wllT: 2 },
    { size: '5/8"', pinMm: 16, wllT: 3.25 },
    { size: '3/4"', pinMm: 19, wllT: 4.75 },
    { size: '7/8"', pinMm: 22, wllT: 6.5 },
    { size: '1"', pinMm: 25, wllT: 8.5 },
  ];

  // WARN ZEON 10 (12 V, steel rope), as published. Its drum, rope and
  // first-layer chart stand in for the user's winch, scaled to its rating.
  const zeon10 = {
    ratedLb: 10000,
    chart: [
      { pullLb: 0, speedFtMin: 33, amps: 62 },
      { pullLb: 2000, speedFtMin: 14.9, amps: 144 },
      { pullLb: 4000, speedFtMin: 11.2, amps: 215 },
      { pullLb: 6000, speedFtMin: 8.5, amps: 280 },
      { pullLb: 8000, speedFtMin: 6.5, amps: 353 },
      { pullLb: 10000, speedFtMin: 4.8, amps: 409 },
    ],
    layersLb: [10000, 8245, 7014, 6103],
    drumDiaMm: 80,
    drumLengthMm: 229,
    ropeDiaMm: 9.52,
    ropeLengthM: 24.38,
    batteryCca: 650,
  };

  const rules = [
    {
      id: "ground-factor",
      category: "method",
      title: "Ground resistance",
      summary: "The force to roll the vehicle over the ground is its weight divided by a ground condition factor (GCF): smooth road 25, grass 7, hard wet sand 6, gravel 5, loose dry sand 4, loose wet sand 3, shingle 3, shallow mud 3, deep mud 2, soft clay 2.",
      quote: "Ground Condition [GC] = weight of vehicle ÷ GCF",
      sources: ["i4wdta", "sibly"],
      params: { grounds: grounds.filter((g) => g.gcf) },
      checked: "2026-10-11",
    },
    {
      id: "bogged-axles",
      category: "method",
      title: "Bogged to the axles",
      summary: "For a vehicle bogged to the axles, subtract 1 from the ground condition factor. Deep mud (2) becomes 1: the full weight of the vehicle.",
      quote: "For vehicle bogged to the axles subtract 1 from numbers below",
      sources: ["i4wdta"],
      params: { subtract: 1, minFactor: 1 },
      checked: "2026-10-11",
    },
    {
      id: "bogged-chassis",
      category: "method",
      title: "Bogged to the chassis",
      summary: "With the diffs and chassis down in it, no wheel can roll. I4WDTA's method counts each wheel that can't roll as its share of the vehicle's weight (\"damage resistance\"), added to the ground resistance: with all four down, the full weight. That's how they worked out their \"bogged to both diffs\" field tests, which came out 1–11% above the measured pull. They name nothing deeper, and suction in clay or deep mud can add more: they advise releasing it before pulling.",
      quote: "Damage resistance [DR] = weight of vehicle x wheels missing ÷ number of wheels on vehicle",
      sources: ["i4wdta"],
      params: { wheelsDown: 4, wheels: 4 },
      checked: "2026-10-11",
    },
    {
      id: "gradient",
      category: "calculation",
      title: "Slope",
      summary: "Pulling a vehicle up a slope means lifting part of its weight: weight × sin(angle). I4WDTA's rule of thumb, 1/60 of the weight per degree up to 45°, gives almost the same answer (25% at 15°, 50% at 30°). Downhill, gravity helps. Caution: in I4WDTA's field test on a slight incline, the method came out about 30% below the measured pull (2 188 lb worked out, 3 140 lb measured), so over-estimate the angle as they advise.",
      quote: "One calculates the gradient factor by taking 1/60 of the vehicle weight for each degree of gradient up to 45°. It is safer to over estimate the gradient.",
      sources: ["physics", "i4wdta"],
      params: { methodLimitDeg: 45, perDegreeFraction: 1 / 60, sliderMaxDeg: 45 },
      checked: "2026-10-11",
    },
    {
      id: "line-angle",
      category: "calculation",
      title: "Rope at an angle",
      summary: "If the rope isn't in line with the way the vehicle has to move, only part of its pull moves the vehicle: the rope must pull the resistance ÷ cos(angle). The rest pulls the vehicle sideways (resistance × tan(angle)), loading its tyres, the fairlead and the winch mount. At 20° the rope pulls 6% more; at 45°, 41% more, with a sideways pull as big as the resistance itself.",
      quote: "",
      sources: ["physics"],
      params: { sliderMaxDeg: 45 },
      checked: "2026-10-11",
    },
    {
      id: "safety-margin",
      category: "method",
      title: "Safety margin on the estimate",
      summary: "Add 25% of the ground, slope and bogging resistance together as a safety margin.",
      quote: "It is advisable to add 25% of the sum of the prior load resistance factors as a safety margin",
      sources: ["i4wdta"],
      params: { fraction: 0.25 },
      checked: "2026-10-11",
    },
    {
      id: "winch-size",
      category: "maker",
      title: "Winch size from vehicle mass",
      summary: "WARN's sizing rule: the winch's rated pull should be at least 1.5 times the vehicle's GVM (gross vehicle mass, GVWR in the US: the maximum loaded mass from the manufacturer).",
      quote: "GVWR x 1.5 = Minimum Pulling Capacity",
      sources: ["warnChoose"],
      params: { factor: 1.5 },
      checked: "2026-10-11",
    },
    {
      id: "layer-pull",
      category: "maker",
      title: "Less pull on each layer of rope",
      summary: "A winch is rated on the first layer of rope on the drum. Each layer adds to the drum's working diameter, which works like a taller gear: less pull, more speed. WARN's ZEON 10 table (80 mm drum, 9.52 mm rope) gives 10 000, 8 245, 7 014 and 6 103 lb for layers 1 to 4. Those figures match the rope's centre sitting one rope diameter further out per layer exactly, which is the model this page uses. The page draws your winch with the ZEON 10's drum and rope; yours will be similar, not identical.",
      quote: "you are effectively changing the gear ratio of the winch by increasing the diameter of the winch drum",
      sources: ["warnLayers", "warnZeon10"],
      params: { layerPitchRopeDia: 1 },
      checked: "2026-10-11",
    },
    {
      id: "min-wraps",
      category: "maker",
      title: "Rope that must stay on the drum",
      summary: "Leave at least 5 wraps of wire rope, or 10 wraps of synthetic rope, on the drum. The rope's anchor on the drum isn't made to take the load.",
      quote: "a minimum of 5 wraps on the drum with wire rope, and 10 wraps with synthetic rope",
      sources: ["warnLayers"],
      params: { steel: 5, synthetic: 10 },
      checked: "2026-10-11",
    },
    {
      id: "winch-chart",
      category: "maker",
      title: "Current draw and line speed",
      summary: "Current and line speed come from a winch maker's first-layer performance chart: WARN's published ZEON 10 chart (62 A and 10.3 m/min with no load, 409 A and 1.5 m/min at 10 000 lb), scaled to your winch's rating. Your winch's own chart will differ. On a higher layer the motor works harder for the same rope pull, and the rope moves faster, in proportion to the drum's working diameter.",
      quote: "Performance (1st layer of drum)",
      sources: ["warnZeon10", "physics"],
      params: { reference: zeon10 },
      checked: "2026-10-11",
    },
    {
      id: "engine-running",
      category: "maker",
      title: "Run the engine while winching",
      summary: "WARN: with the engine off a winch will only run for a few minutes, so winch with the engine running. WARN lists 650 CCA as the minimum battery for winching with its winches, and strongly recommends against lithium batteries for winching unless a qualified installer fits them with extra circuit protection.",
      quote: "A winch will work if your vehicle engine is off but will only operate for a few minutes.",
      sources: ["warnBattery", "warnZeon10"],
      params: { minCca: 650 },
      checked: "2026-10-11",
    },
    {
      id: "sheave-friction",
      category: "engineering",
      title: "Friction in each snatch block",
      summary: "Each sheave (pulley) a rope runs over loses some force to friction. LEEA's lifting code assumes 8% per sheave, so the rope leaving a block carries 92% of the rope going in. That's why WARN says a snatch block nearly doubles a winch's pull, not exactly.",
      quote: "Assuming 8% per sheave for friction",
      sources: ["leea", "warnBlock"],
      params: { lossPerSheave: 0.08 },
      checked: "2026-10-11",
    },
    {
      id: "mechanical-advantage",
      category: "calculation",
      title: "Double and triple line pulls",
      summary: "With the rope run out through a snatch block and back, two lengths of rope share the load on the vehicle, so the winch needs about half the pull (a third with three lengths), minus block friction. The rope has to be pulled in two (or three) times as far, so the vehicle moves at half (or a third of) the line speed, and twice (or three times) as much rope is paid out. The anchor still takes the full load.",
      quote: "When used properly, this multi-purpose snatch block can double the pulling power of a winch",
      sources: ["physics", "warnBlock"],
      params: { maxLines: 3 },
      checked: "2026-10-11",
    },
    {
      id: "wll-mbs",
      category: "maker",
      title: "MBS versus WLL",
      summary: "MBS (minimum breaking strength) is the load at which a new item is expected to break. WLL (working load limit) is the most the maker certifies it for in normal use: the MBS divided by a design factor. The factor is set by the standard the maker follows, so one item can carry two WLLs: WARN's snatch block is 24 000 lb WLL at 4:1 for general rigging (ASME B30.26) and 48 000 lb WLL at 2:1 for vehicle recovery (BS 7901), with an MBS of 96 000 lb. Crosby's shackles use 6:1.",
      quote: "4:1 Safety Factor WLL: 24,000lb - per ASME B30.26 Standard (General rigging & lifting) / 2:1 Safety Factor WLL: 48,000lb - per BS 7901 Standard (Vehicle recovery, not overhead)",
      sources: ["warnBlock", "crosby"],
      params: {},
      checked: "2026-10-11",
    },
    {
      id: "shackle-ratings",
      category: "maker",
      title: "Shackle ratings",
      summary: "Crosby G-209 screw pin anchor shackles: 1/2\" 2 t, 5/8\" 3.25 t, 3/4\" 4.75 t, 7/8\" 6.5 t, 1\" 8.5 t WLL. Minimum ultimate strength is 6 times the WLL; proof load is 2 times. Side loading reduces the WLL (see Crosby's warnings). Other brands differ: read the WLL marked on your shackle.",
      quote: "Minimum Ultimate Strength is 6 times the Working Load Limit.",
      sources: ["crosby"],
      params: { shackles: shackles, designFactor: 6, proofFactor: 2 },
      checked: "2026-10-11",
    },
  ];

  // Things nobody citable publishes: shown as "no published figure", never guessed.
  const gaps = [
    {
      id: "snow",
      title: "Snow",
      text: "No published ground factor found for snow (it ranges from firm pack to deep powder). Pick the published ground it behaves most like; the page labels that as your choice.",
    },
    {
      id: "rock",
      title: "Rock",
      text: "No published ground factor found for rock. Tyres roll on rock much like on a road; what holds a vehicle is usually a ledge. Pick the nearest ground and set the slope to the ledge's angle.",
    },
    {
      id: "suction",
      title: "Suction",
      text: "No published figure for the extra pull suction adds in clay or deep mud. I4WDTA's advice is to release it (dig, lift) before pulling.",
    },
    {
      id: "duty-cycle",
      title: "Winch duty cycle",
      text: "Duty cycle (how long a winch may pull before resting) differs between winches. The page shows how long the pull takes; check it against your winch's manual.",
    },
  ];

  // Ready-made examples. Made-up figures that show how the inputs combine;
  // masses are typical loaded 4x4s, not from a source.
  const scenarios = [
    { id: "grass", label: "Wet grass campsite", values: { massKg: 3000, ground: "grass", bog: "none", slopeDir: "up", gradeDeg: 0, parts: 1, anchorM: 20, moveM: 8, winch: "EW9500" } },
    { id: "dune", label: "Dune climb, 20°", values: { massKg: 3300, ground: "drysand", bog: "none", slopeDir: "up", gradeDeg: 20, parts: 1, anchorM: 20, moveM: 12, winch: "EW9500" } },
    { id: "mud", label: "Deep mud, to the axles", values: { massKg: 3200, ground: "mud-deep", bog: "axles", slopeDir: "up", gradeDeg: 10, parts: 2, anchorM: 10, moveM: 6, winch: "Zeon 10" } },
    { id: "chassis", label: "Clay, to the chassis", values: { massKg: 2900, ground: "clay", bog: "chassis", slopeDir: "up", gradeDeg: 5, parts: 3, anchorM: 7, moveM: 4, winch: "12000 lb" } },
    { id: "ledge", label: "Rock ledge, 35°", values: { massKg: 3100, ground: "rock", proxy: "road", bog: "none", slopeDir: "up", gradeDeg: 35, parts: 2, anchorM: 10, moveM: 3, winch: "4.5 t" } },
  ];

  // The defaults the page opens with (also an example, labelled as such).
  const defaults = { massKg: 3000, ground: "mud-shallow", proxy: "", bog: "axles", slopeDir: "up", gradeDeg: 10, ropeAngleDeg: 0, parts: 1, anchorM: 15, moveM: 6, winch: "EW9500", ropeLengthM: zeon10.ropeLengthM, ropeType: "steel" };

  root.WINCH_DATA = {
    sources,
    grounds,
    bogLevels,
    shackles,
    zeon10,
    rules,
    gaps,
    scenarios,
    defaults,
    commonWinchesLb: [8000, 9500, 10000, 12000, 15000, 17500],
    units: { lbToKg: 0.45359237, g: 9.80665, ftToM: 0.3048 },
    rule(id) {
      const r = rules.find((x) => x.id === id);
      if (!r) throw new Error("Unknown rule " + id);
      return r;
    },
  };
})(window);
