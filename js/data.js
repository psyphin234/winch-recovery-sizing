/*
 * data.js: THE data file. Every number the calculator uses lives here, next to
 * the source it comes from. calc.js, app.js and the HTML read these values;
 * they must not hard-code them.
 *
 * Rule categories (drive the tag shown on the sources page):
 *   method      - a published recovery method from a training body (I4WDTA)
 *   maker       - a winch, rigging or rope manufacturer's published figure
 *   standard    - a standard or mandatory product-safety rule
 *   engineering - an engineering body's practice (LEEA) or a physical constant
 *   calculation - this site's own physics; says so wherever it is shown
 *
 * Source policy: engineering, standards, manufacturers' data and published
 * training methods only. No forum, club or "everyone says" figures. Where
 * nothing citable exists, add an entry to `gaps` and say so on the page.
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
    accc: {
      label: "Australia: Consumer Goods (Motor Vehicle Recovery Straps) Safety Standard 2017 (ACCC product safety page)",
      url: "https://www.productsafety.gov.au/standards/recovery-straps-for-motor-vehicles",
      kind: "standard",
    },
    bushranger: {
      label: "Bushranger recovery strap instructions (maker's sheet with the warnings the Australian standard requires), via Snowys",
      url: "https://snowys.com.au/Product/ProductAttachments/cbc1afcc-ed75-446f-87dd-04bcba61608e",
      kind: "maker",
    },
    sae537: {
      label: "SAE J537, Storage Batteries (definition of the cold cranking amps test)",
      url: null,
      kind: "standard",
    },
    iec60028: {
      label: "IEC 60028, International standard of resistance for copper (annealed copper: 1/58 ohm mm²/m at 20 °C)",
      url: null,
      kind: "standard",
    },
    kineticMakers: {
      label: "Kinetic rope makers' listings: Terenowiec (stretch 25–30% at break) and Bear Rope KERR (30–35%)",
      url: "https://terenowiec.pl/en/283-kinetic-rope-14-mm-x-10-m-mbl-4t-reinforced-loops-on-both-sides.html",
      moreUrls: ["https://nakatanenga.de/en/detail/index/sArticle/6466"],
      kind: "maker",
    },
    physics: {
      label: "Physics (statics and energy): this site's own calculation",
      url: null,
      kind: "calculation",
    },
  };

  /*
   * Ground condition factors (GCF), I4WDTA after Sibly. The resistance on that
   * ground is the vehicle's weight divided by the factor. "For vehicle bogged
   * to the axles subtract 1 from numbers below" (I4WDTA).
   * Snow and rock: no published factor found (see gaps); the user picks the
   * nearest published ground instead, and the page says it's their choice.
   */
  const grounds = [
    { id: "road", label: "Tar or concrete (smooth road)", gcf: 25 },
    { id: "grass", label: "Grass", gcf: 7 },
    { id: "wetsand-hard", label: "Hard wet sand", gcf: 6 },
    { id: "gravel", label: "Gravel", gcf: 5 },
    { id: "drysand", label: "Loose dry sand", gcf: 4 },
    { id: "wetsand-loose", label: "Loose wet sand", gcf: 3 },
    { id: "shingle", label: "Shingle (loose stones)", gcf: 3 },
    { id: "mud-shallow", label: "Shallow mud", gcf: 3 },
    { id: "mud-deep", label: "Deep mud", gcf: 2 },
    { id: "clay", label: "Soft clay", gcf: 2 },
    { id: "snow", label: "Snow", gcf: null, proxy: true },
    { id: "rock", label: "Rock", gcf: null, proxy: true },
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

  // WARN ZEON 10 first-layer performance chart (12 V, steel rope), as published.
  // Used, scaled by fraction of rated pull, until the user enters their own chart.
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
    leadLengthM: 1.83,
    leadAwg: "2",
  };

  // Cable sizes offered (cross-section in mm²). AWG sizes are the standard areas.
  const cables = [
    { id: "4awg", label: '4 AWG (21 mm²)', mm2: 21.2 },
    { id: "25", label: "25 mm²", mm2: 25 },
    { id: "2awg", label: "2 AWG (34 mm²), WARN's lead size", mm2: 33.6 },
    { id: "35", label: "35 mm²", mm2: 35 },
    { id: "1awg", label: "1 AWG (42 mm²)", mm2: 42.4 },
    { id: "50", label: "50 mm²", mm2: 50 },
    { id: "1/0awg", label: "1/0 AWG (54 mm²)", mm2: 53.5 },
    { id: "2/0awg", label: "2/0 AWG (67 mm²)", mm2: 67.4 },
    { id: "70", label: "70 mm²", mm2: 70 },
  ];

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
      id: "gradient",
      category: "calculation",
      title: "Gradient",
      summary: "Pulling a vehicle up a slope means lifting part of its weight: weight × sin(angle). I4WDTA's rule of thumb, 1/60 of the weight per degree up to 45°, gives almost the same answer (25% at 15°, 50% at 30°). This page uses the exact physics; downhill, gravity helps and the figure is negative. Caution: in I4WDTA's field test on a slight incline, the method came out about 30% below the measured pull (2 188 lb worked out, 3 140 lb measured), so over-estimate the angle as they advise.",
      quote: "One calculates the gradient factor by taking 1/60 of the vehicle weight for each degree of gradient up to 45°. It is safer to over estimate the gradient.",
      sources: ["physics", "i4wdta"],
      params: { methodLimitDeg: 45, perDegreeFraction: 1 / 60 },
      checked: "2026-10-11",
    },
    {
      id: "damage",
      category: "method",
      title: "Wheels that can't roll",
      summary: "Damage resistance = weight × wheels that can't roll ÷ number of wheels. In I4WDTA's field tests (a Land Cruiser 100 recovered by a GQ Patrol, pull measured), a vehicle bogged to the rear diff was worked out as two wheels that can't roll, and both diffs as four. In all four bogged tests, in dry and wet sand, the calculation came out 0–11% above the measured pull.",
      quote: "Damage resistance [DR] = weight of vehicle x wheels missing ÷ number of wheels on vehicle",
      sources: ["i4wdta"],
      params: {},
      checked: "2026-10-11",
    },
    {
      id: "safety-margin",
      category: "method",
      title: "Safety margin on the estimate",
      summary: "Add 25% of the ground, gradient and damage resistance together as a safety margin.",
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
      summary: "A winch is rated on the first layer of rope on the drum. Each layer adds to the drum's working diameter, which works like a taller gear: less pull, more speed. WARN's ZEON 10 table (80 mm drum, 9.52 mm rope) gives 10 000, 8 245, 7 014 and 6 103 lb for layers 1 to 4. Those figures match the rope's centre sitting one rope diameter further out per layer exactly, which is the model this page uses for any drum and rope.",
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
      summary: "Current and line speed come from the winch maker's first-layer performance chart. The page starts with WARN's published ZEON 10 chart (62 A and 10.3 m/min with no load, 409 A and 1.5 m/min at 10 000 lb), scaled to your winch's rating. Enter your own winch's chart for real figures. On a higher layer the motor works harder for the same line pull, and the rope moves faster, in proportion to the drum's working diameter.",
      quote: "Performance (1st layer of drum)",
      sources: ["warnZeon10", "physics"],
      params: { reference: zeon10 },
      checked: "2026-10-11",
    },
    {
      id: "battery-cca",
      category: "maker",
      title: "Battery for winching",
      summary: "WARN lists 650 CCA as the minimum battery for winching with its winches (for example the ZEON 10), and recommends running the engine: with the engine off a winch will only run for a few minutes. WARN strongly recommends against lithium batteries for winching unless a qualified installer fits them with extra circuit protection.",
      quote: "We strongly recommend not using lithium batteries for winching applications unless installed by a qualified installer.",
      sources: ["warnBattery", "warnZeon10"],
      params: { minCca: 650 },
      checked: "2026-10-11",
    },
    {
      id: "cca-resistance",
      category: "calculation",
      title: "Battery voltage under load",
      summary: "A battery's CCA is the current it can deliver for 30 seconds at −18 °C while staying at or above 7.2 V (SAE J537). From that, its internal resistance is at most (12.6 V − 7.2 V) ÷ CCA. This page uses that cold, worst-case figure to estimate how far the voltage sags; a warm battery does better.",
      quote: "",
      sources: ["sae537", "physics"],
      params: { restVolts: 12.6, ccaEndVolts: 7.2 },
      checked: "2026-10-11",
    },
    {
      id: "cable-drop",
      category: "calculation",
      title: "Voltage lost in the cables",
      summary: "Copper's resistance is 1/58 ohm per metre for a 1 mm² conductor at 20 °C (IEC 60028). Current goes out and back, so the drop is current × 2 × cable length × 0.01724 ÷ cross-section.",
      quote: "",
      sources: ["iec60028", "physics"],
      params: { ohmMm2PerM: 1 / 58 },
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
      params: {},
      checked: "2026-10-11",
    },
    {
      id: "redirect-load",
      category: "calculation",
      title: "Load on a redirect block",
      summary: "A block that only changes the rope's direction carries both legs of rope. Its load is 2 × rope tension × cos(half the angle between the legs): 2.00× with the legs side by side, 1.41× at 90°, 1.00× at 120°.",
      quote: "",
      sources: ["physics"],
      params: {},
      checked: "2026-10-11",
    },
    {
      id: "line-angle",
      category: "calculation",
      title: "Pulling at an angle",
      summary: "If the rope isn't in line with the way the vehicle has to move, only part of the rope's pull moves it: the rope must pull the resistance ÷ cos(angle). The rest pushes sideways on the vehicle, its tyres and the fairlead.",
      quote: "",
      sources: ["physics"],
      params: { maxDeg: 45 },
      checked: "2026-10-11",
    },
    {
      id: "wll-mbs",
      category: "maker",
      title: "MBS versus WLL",
      summary: "MBS (minimum breaking strength) is the load at which a new item is expected to break. WLL (working load limit) is the most the maker certifies it for in normal use: the MBS divided by a design factor. The factor is set by the standard the maker follows, so one item can carry two WLLs: WARN's snatch block is 24 000 lb WLL at 4:1 for general rigging (ASME B30.26) and 48 000 lb WLL at 2:1 for vehicle recovery (BS 7901), with an MBS of 96 000 lb. Crosby's shackles use 6:1. Straps are labelled with MBS only.",
      quote: "4:1 Safety Factor WLL: 24,000lb - per ASME B30.26 Standard (General rigging & lifting) / 2:1 Safety Factor WLL: 48,000lb - per BS 7901 Standard (Vehicle recovery, not overhead)",
      sources: ["warnBlock", "crosby", "accc"],
      params: {},
      checked: "2026-10-11",
    },
    {
      id: "shackle-ratings",
      category: "maker",
      title: "Shackle ratings",
      summary: "Crosby G-209 screw pin anchor shackles: 1/2\" 2 t, 5/8\" 3.25 t, 3/4\" 4.75 t, 7/8\" 6.5 t, 1\" 8.5 t WLL. Minimum ultimate strength is 6 times the WLL; proof load is 2 times. Side loading reduces the WLL (see Crosby's warnings). Other brands differ: read the WLL cast into your shackle.",
      quote: "Minimum Ultimate Strength is 6 times the Working Load Limit.",
      sources: ["crosby"],
      params: { shackles: shackles, designFactor: 6, proofFactor: 2 },
      checked: "2026-10-11",
    },
    {
      id: "strap-mbs",
      category: "standard",
      title: "Snatch strap breaking strength",
      summary: "Australia's mandatory recovery strap standard requires straps to be labelled with their MBS and to recommend an MBS between 2 and 3 times the GVM of the vehicle, suited to the lighter of the two vehicles in the recovery. Bushranger's strap instructions carry that wording, and add: stand at least 1.5 times the stretched strap's length away, and a wet strap is weaker and stretches less. The standard excludes rope, wire cable and chain, so kinetic ropes aren't covered: follow the vehicle mass range on the rope's own label.",
      quote: "The minimum breaking strength of the strap should be between 2 and 3 times the vehicle's gross vehicle mass (GVM) of any vehicle it is used with. The strap must be suited to the gross vehicle mass (GVM) of the lighter of the 2 vehicles used in the recovery process.",
      sources: ["accc", "bushranger"],
      params: { min: 2, max: 3 },
      checked: "2026-10-11",
    },
    {
      id: "kinetic-energy",
      category: "calculation",
      title: "Kinetic recovery: peak force estimate",
      summary: "A kinetic rope or snatch strap stores the moving vehicle's energy (½ × mass × speed²) as stretch, then gives it back as pull. Treating the rope as a spring that reaches its MBS at its rated stretch, the peak force is √(2 × energy × stiffness). It rises in proportion to speed: twice the speed, twice the force. This is a simplified physics estimate (real ropes aren't linear, and the stuck vehicle moves), not a measurement. Kinetic rope makers list 25–35% stretch at break; Bushranger lists a 20% stretch factor for its snatch strap.",
      quote: "",
      sources: ["physics", "kineticMakers", "bushranger"],
      params: { defaultStretchPct: 30 },
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
      text: "No published ground factor found for rock. Tyres roll on rock much like on a road; what holds a vehicle is usually a ledge or a wheel jammed against a rock. Enter the ledge as gradient, or count the jammed wheel as a wheel that can't roll.",
    },
    {
      id: "winch-rope-factor",
      title: "Winch rope strength versus winch rating",
      text: "No published minimum ratio of winch rope MBS to winch rated pull was found from a winch maker. The page shows your rope's ratio for information and compares the rope with the largest load it can see.",
    },
    {
      id: "duty-cycle",
      title: "Winch duty cycle",
      text: "Duty cycle (how long a winch may pull before resting) differs between winches and isn't on the pages used here. The page shows how long the pull takes; check it against your winch's manual.",
    },
    {
      id: "alternator",
      title: "Alternator output at idle",
      text: "How much an alternator gives at idle depends on the vehicle. Enter your own figure, or leave it at 0 for the worst case (engine off).",
    },
  ];

  // Ready-made scenarios. Example figures, not from a source: they show how
  // the inputs combine. Masses are typical SA vehicles' GVMs, rounded.
  const scenarios = [
    {
      id: "grass-flat",
      label: "Double cab on wet grass, flat campsite",
      values: { massKg: 3000, ground: "grass", bogged: false, gradeDeg: 0, stuckWheels: 0, parts: 1, anchorM: 20, moveM: 8 },
    },
    {
      id: "dune",
      label: "Loaded SUV up a soft sand dune, 20°",
      values: { massKg: 3300, ground: "drysand", bogged: false, gradeDeg: 20, stuckWheels: 0, parts: 1, anchorM: 20, moveM: 12 },
    },
    {
      id: "mud-axles",
      label: "Bakkie bogged to the axles in deep mud, 10° climb, double line",
      values: { massKg: 3200, ground: "mud-deep", bogged: true, gradeDeg: 10, stuckWheels: 0, parts: 2, anchorM: 10, moveM: 6 },
    },
    {
      id: "rear-diff",
      label: "Bogged to the rear diff in loose wet sand",
      values: { massKg: 2900, ground: "wetsand-loose", bogged: false, gradeDeg: 0, stuckWheels: 2, parts: 1, anchorM: 22, moveM: 5 },
    },
    {
      id: "ledge",
      label: "Rock ledge, 35° face, wheel jammed, triple line",
      values: { massKg: 3100, ground: "rock", proxy: "road", bogged: false, gradeDeg: 35, stuckWheels: 1, parts: 3, anchorM: 6, moveM: 3 },
    },
    {
      id: "clay-damaged",
      label: "Damaged vehicle (wheel off) in soft clay, 15° (I4WDTA's worked example)",
      values: { massKg: 1588, ground: "clay", bogged: false, gradeDeg: 15, stuckWheels: 1, parts: 1, anchorM: 20, moveM: 5 },
    },
  ];

  root.WINCH_DATA = {
    sources,
    grounds,
    shackles,
    zeon10,
    cables,
    rules,
    gaps,
    scenarios,
    units: { lbToKg: 0.45359237, g: 9.80665, ftToM: 0.3048 },
    rule(id) {
      const r = rules.find((x) => x.id === id);
      if (!r) throw new Error("Unknown rule " + id);
      return r;
    },
  };
})(window);
