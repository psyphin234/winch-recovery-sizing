/* Visual effects, decoration only (nothing here touches the calculations):
   - the winching hologram in the header (canvas.hero-fx): a 4x4 bogged in mud
     on a slope, winching itself up on a double line through a snatch block on
     a tree protector. The wheels turn, mud flicks off them, the drum winds and
     the rope runs over the block's sheave towards the winch; then it holds,
     dims and starts again. It shows no figures, so it can't be mistaken for a
     result;
   - the explainers fading in as they scroll into view.
   Under prefers-reduced-motion the hologram is drawn once, mid-pull, and the
   fade-ins are skipped. The circuit board behind the page is js/circuit.js. */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------------------------------------------------------------- fade-ins
  function setUpReveal() {
    if (reduceMotion || !("IntersectionObserver" in window)) return;
    document.documentElement.classList.add("fx-reveal");
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add("is-visible");
        io.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0.04 });
    document.querySelectorAll(".explainer").forEach(function (el) { io.observe(el); });
    // Fail-safe: nothing stays invisible if the observer misses it.
    setTimeout(function () {
      document.querySelectorAll(".explainer").forEach(function (el) { el.classList.add("is-visible"); });
    }, 4000);
  }

  // ------------------------------------------------------------ the hologram
  // World units: the slope rises to the right at SLOPE, through (0, 0); up is
  // negative. The vehicle is drawn in its own frame (rear at x = 0, ground at
  // y = 0, facing right), then set on the slope at distance d and sunk SINK
  // into the mud. The tree stands upright TREE along the slope.
  var SLOPE = 14 * Math.PI / 180, COS = Math.cos(SLOPE), SIN = Math.sin(SLOPE);
  var SINK = 16, TREE = 640, TRAVEL = 110;
  var CYCLE = 8, PULL = 6, HOLD = 7.2;          // seconds: winching, holding, then a dim and a restart
  var BOX = { l: -60, t: -432, r: 724, b: 58 };  // the scene, for fitting and the HUD frame
  var WHEELS = [62, 238], R_TYRE = 32, R_SHEAVE = 14;
  var FAIRLEAD = [316, -50], RECOVERY = [314, -36], DRUM = [307, -50];

  function onSlope(d) { return [d * COS, -d * SIN]; }

  // a point in the vehicle's frame, in the world, with the vehicle at d
  function world(d, p) {
    var x = p[0], y = p[1] + SINK;
    return [d * COS + x * COS + y * SIN, -d * SIN - x * SIN + y * COS];
  }

  function wagon(ctx) {
    ctx.moveTo(6, -30);
    ctx.lineTo(2, -72);
    ctx.lineTo(8, -126);
    ctx.quadraticCurveTo(10, -134, 22, -134);
    ctx.lineTo(184, -134);
    ctx.lineTo(220, -92);
    ctx.lineTo(286, -86);
    ctx.quadraticCurveTo(298, -84, 298, -70);
    ctx.lineTo(298, -32);
    ctx.lineTo(278, -32);
    ctx.arc(238, -32, 40, 0, Math.PI, true);
    ctx.lineTo(102, -32);
    ctx.arc(62, -32, 40, 0, Math.PI, true);
    ctx.closePath();
  }

  function wagonDetails(ctx) {
    // side windows and pillars
    ctx.moveTo(28, -124); ctx.lineTo(178, -124); ctx.lineTo(208, -94); ctx.lineTo(28, -94); ctx.closePath();
    ctx.moveTo(112, -124); ctx.lineTo(112, -94);
    // doors
    ctx.moveTo(112, -94); ctx.lineTo(112, -40);
    ctx.moveTo(206, -92); ctx.lineTo(206, -40);
    // roof rack
    ctx.moveTo(22, -146); ctx.lineTo(182, -146);
    [36, 100, 164].forEach(function (x) { ctx.moveTo(x, -146); ctx.lineTo(x, -134); });
    // snorkel up the windscreen pillar
    ctx.moveTo(226, -90); ctx.lineTo(220, -150); ctx.lineTo(232, -154);
    // headlight
    ctx.moveTo(294, -74); ctx.arc(290, -74, 4, 0, Math.PI * 2);
    // spare wheel on the back door
    ctx.moveTo(10, -80); ctx.arc(-12, -80, 22, 0, Math.PI * 2);
    ctx.moveTo(-3, -80); ctx.arc(-12, -80, 9, 0, Math.PI * 2);
    // bull bar round the winch, and the recovery point under it
    ctx.moveTo(298, -84); ctx.lineTo(314, -80); ctx.lineTo(318, -32); ctx.lineTo(298, -28);
    ctx.moveTo(RECOVERY[0] + 3, RECOVERY[1]); ctx.arc(RECOVERY[0], RECOVERY[1], 3, 0, Math.PI * 2);
  }

  function wheel(ctx, x, spin) {
    var y = -32;
    ctx.moveTo(x + R_TYRE, y); ctx.arc(x, y, R_TYRE, 0, Math.PI * 2);
    ctx.moveTo(x + 19, y); ctx.arc(x, y, 19, 0, Math.PI * 2);
    ctx.moveTo(x + 5, y); ctx.arc(x, y, 5, 0, Math.PI * 2);
    for (var k = 0; k < 6; k++) {
      var a = spin + k * Math.PI / 3;
      ctx.moveTo(x + Math.cos(a) * 6, y + Math.sin(a) * 6);
      ctx.lineTo(x + Math.cos(a) * 18, y + Math.sin(a) * 18);
    }
    // tread blocks
    for (var t = 0; t < 14; t++) {
      var b = spin + t * Math.PI / 7;
      ctx.moveTo(x + Math.cos(b) * (R_TYRE - 5), y + Math.sin(b) * (R_TYRE - 5));
      ctx.lineTo(x + Math.cos(b) * R_TYRE, y + Math.sin(b) * R_TYRE);
    }
  }

  // a ring of a circle, as a path
  function ring(ctx, x, y, r) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2); }

  // The tree: trunk, roots, branches and a canopy of overlapping clumps.
  function treeBase() { return onSlope(TREE); }
  var CANOPY = [[-54, -176, 34], [-6, -196, 40], [46, -174, 32], [-24, -152, 28], [22, -150, 28]];
  function trunk(ctx, B) {
    var x = B[0], y = B[1];
    ctx.moveTo(x - 18, y + 4); ctx.quadraticCurveTo(x - 11, y - 8, x - 10, y - 40); ctx.lineTo(x - 7, y - 150);
    ctx.moveTo(x + 18, y - 4); ctx.quadraticCurveTo(x + 11, y - 12, x + 10, y - 40); ctx.lineTo(x + 7, y - 150);
    ctx.moveTo(x - 8, y - 128); ctx.lineTo(x - 48, y - 170);
    ctx.moveTo(x + 7, y - 136); ctx.lineTo(x + 40, y - 174);
    ctx.moveTo(x, y - 146); ctx.lineTo(x - 2, y - 196);
  }

  function setUpHologram() {
    var canvas = document.querySelector(".hero-fx");
    if (!canvas || !canvas.getContext) return;
    var header = canvas.parentElement;
    var text = header.querySelector(".brand-text");
    var ctx = canvas.getContext("2d");

    var w = 0, h = 0, s = 1, ox = 0, oy = 0, fade = 1, labels = true;
    var mx = 0, my = 0, tx = 0, ty = 0;
    var bw = BOX.r - BOX.l, bh = BOX.b - BOX.t;
    var flecks = [];
    for (var i = 0; i < 22; i++) flecks.push({ p: Math.random(), wheel: i % 2, v: 0.8 + Math.random() * 0.8, k: 0.6 + Math.random() * 0.8 });
    var MUD = [];
    for (var m = 0; m < 34; m++) MUD.push({ d: -40 + m * 22 + (m * 37 % 11), depth: 6 + (m * 53 % 34), r: 2 + (m * 29 % 5) });

    function resize() {
      var rect = header.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width; h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var textRight = text ? text.getBoundingClientRect().right - rect.left : w * 0.6;
      var contentRight = (w + Math.min(w, 1120)) / 2;
      var room = Math.min(w - 24, contentRight + 140) - textRight - 30;
      if (room > 300) {
        s = Math.min(room / bw, (h - 30) / bh);
        ox = textRight + 30 + (room - bw * s) / 2 - BOX.l * s;
        oy = h - 14 - BOX.b * s;
        fade = 1; labels = true;
      } else {
        // Narrow screens: a faint scene behind the text, along the bottom.
        s = Math.min((w * 0.95) / bw, (h * 0.6) / bh);
        ox = w - BOX.r * s - 8;
        oy = h - BOX.b * s - 6;
        fade = 0.2; labels = false;
      }
    }

    function stroke(colour, width, blur) {
      ctx.strokeStyle = colour;
      ctx.lineWidth = width / s;
      ctx.shadowColor = "rgba(76, 201, 255, 0.9)";
      ctx.shadowBlur = blur;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // How far the vehicle has come (0..TRAVEL) and how bright the scene is.
    function motion(time) {
      var phase = reduceMotion ? PULL * 0.55 : time % CYCLE;
      var e = function (u) { return u * u * (3 - 2 * u); };
      var d, speed = 0, alpha = 1;
      if (phase < PULL) {
        var u = phase / PULL;
        // a slow take-up of the slack, then a steady crawl
        d = TRAVEL * e(u);
        speed = 6 * u * (1 - u);
      } else if (phase < HOLD) {
        d = TRAVEL;
      } else {
        var q = (phase - HOLD) / (CYCLE - HOLD);
        alpha = 1 - 0.85 * Math.sin(q * Math.PI);
        d = q < 0.5 ? TRAVEL : 0;
      }
      return { d: d, speed: speed, alpha: alpha, phase: phase };
    }

    function frame(t) {
      var time = t / 1000;
      var mo = motion(time), d = mo.d;
      ctx.clearRect(0, 0, w, h);
      tx += (mx - tx) * 0.05; ty += (my - ty) * 0.05;

      ctx.save();
      ctx.translate(ox + tx * 10, oy + ty * 6);
      ctx.scale(s, s);
      ctx.globalAlpha = fade * mo.alpha;

      var B = treeBase();
      var F = world(d, FAIRLEAD), Rp = world(d, RECOVERY);

      // Light pooled over the scene.
      var pool = ctx.createRadialGradient(380, -150, 10, 380, -150, 440);
      pool.addColorStop(0, "rgba(47, 107, 255, 0.2)");
      pool.addColorStop(1, "rgba(47, 107, 255, 0)");
      ctx.fillStyle = pool;
      ctx.fillRect(-100, -620, 960, 900);

      // ---- the tree (behind everything else)
      ctx.save();
      ctx.beginPath();
      CANOPY.forEach(function (c) { ring(ctx, B[0] + c[0], B[1] + c[1], c[2]); });
      ctx.fillStyle = "rgba(76, 201, 255, 0.05)";
      ctx.fill();
      ctx.restore();
      ctx.beginPath();
      CANOPY.forEach(function (c) { ring(ctx, B[0] + c[0], B[1] + c[1], c[2]); });
      stroke("rgba(76, 201, 255, 0.4)", 1.1, 4);
      ctx.beginPath(); trunk(ctx, B); stroke("rgba(76, 201, 255, 0.75)", 1.4, 6);
      // leaves glinting
      ctx.fillStyle = "rgba(190, 235, 255, 0.8)";
      for (var g = 0; g < 14; g++) {
        var c = CANOPY[g % CANOPY.length], a = g * 2.4;
        var tw = reduceMotion ? 0.6 : 0.5 + 0.5 * Math.sin(time * 2 + g * 1.7);
        ctx.globalAlpha = fade * mo.alpha * tw * 0.8;
        ctx.fillRect(B[0] + c[0] + Math.cos(a) * c[2] * 0.6, B[1] + c[1] + Math.sin(a) * c[2] * 0.6, 2 / s, 2 / s);
      }
      ctx.globalAlpha = fade * mo.alpha;

      // ---- tree protector, shackle and snatch block
      var band = [B[0], B[1] - 40];
      var S = [B[0] - 26, B[1] - 40];
      var ux = F[0] - S[0], uy = F[1] - S[1], ul = Math.hypot(ux, uy);
      ux /= ul; uy /= ul;
      var nx = uy, ny = -ux;                  // perpendicular, pointing up
      if (ny > 0) { nx = -nx; ny = -ny; }
      var K = [S[0] + ux * (R_SHEAVE + 12), S[1] + uy * (R_SHEAVE + 12)];
      var T1 = [K[0] + nx * R_SHEAVE, K[1] + ny * R_SHEAVE];    // the winch line leaves here
      var T2 = [K[0] - nx * R_SHEAVE, K[1] - ny * R_SHEAVE];    // the line back to the vehicle

      // the strap round the trunk: the back half faint, the front half bright
      ctx.beginPath(); ctx.ellipse(band[0], band[1], 12, 4.5, 0, Math.PI, Math.PI * 2);
      stroke("rgba(76, 201, 255, 0.35)", 2, 0);
      ctx.beginPath(); ctx.ellipse(band[0], band[1], 12, 4.5, 0, 0, Math.PI);
      ctx.moveTo(band[0] - 11, band[1] - 2); ctx.lineTo(S[0] + 3, S[1] - 2);
      ctx.moveTo(band[0] - 11, band[1] + 2); ctx.lineTo(S[0] + 3, S[1] + 2);
      stroke("rgba(150, 225, 255, 0.95)", 2.6, 8);
      // shackle and the block's cheek plates
      ctx.beginPath();
      ctx.moveTo(S[0] + 4, S[1] - 5); ctx.arc(S[0], S[1], 5, -Math.PI / 2, Math.PI / 2, true);
      ctx.moveTo(S[0] + 4, S[1] - 5); ctx.lineTo(S[0] + 4, S[1] + 5);
      stroke("rgba(150, 225, 255, 0.9)", 1.4, 5);
      ctx.beginPath();
      ctx.moveTo(S[0] + ux * 5 + nx * 5, S[1] + uy * 5 + ny * 5);
      ctx.lineTo(K[0] + nx * (R_SHEAVE + 5), K[1] + ny * (R_SHEAVE + 5));
      ctx.arc(K[0], K[1], R_SHEAVE + 5, Math.atan2(ny, nx), Math.atan2(-ny, -nx), Math.atan2(ny, nx) > Math.atan2(uy, ux));
      ctx.lineTo(S[0] + ux * 5 - nx * 5, S[1] + uy * 5 - ny * 5);
      ctx.fillStyle = "rgba(6, 12, 32, 0.6)";
      ctx.fill();
      stroke("rgba(76, 201, 255, 0.8)", 1.3, 6);

      // ---- vehicle (the ground is drawn over it afterwards, so it sits in the mud)
      var g0 = onSlope(-120), g1 = onSlope(TREE + 140);
      ctx.save();
      var V = onSlope(d);
      ctx.translate(V[0], V[1]);
      ctx.rotate(-SLOPE);
      ctx.translate(0, SINK);
      var spin = d / R_TYRE;
      ctx.save();
      ctx.beginPath(); wagon(ctx);
      var body = ctx.createLinearGradient(0, -150, 0, 0);
      body.addColorStop(0, "rgba(76, 201, 255, 0.11)");
      body.addColorStop(1, "rgba(76, 201, 255, 0.02)");
      ctx.fillStyle = body;
      ctx.fill();
      ctx.clip();
      ctx.fillStyle = "rgba(160, 225, 255, 0.07)";
      var lineShift = reduceMotion ? 0 : (time * 12) % 4;
      for (var ly = -150 + lineShift; ly < 0; ly += 4) ctx.fillRect(0, ly, 300, 1 / s);
      ctx.restore();
      ctx.beginPath(); wagon(ctx); stroke("rgba(76, 201, 255, 0.8)", 1.4, 6);
      ctx.beginPath(); wagonDetails(ctx); stroke("rgba(76, 201, 255, 0.6)", 1.05, 3);
      ctx.beginPath(); WHEELS.forEach(function (x) { wheel(ctx, x, spin); }); stroke("rgba(76, 201, 255, 0.8)", 1.25, 5);
      // the winch drum, winding in (twice the vehicle's travel on a double line)
      var drumSpin = (2 * d) / 7;
      ctx.beginPath();
      ring(ctx, DRUM[0], DRUM[1], 7);
      for (var k = 0; k < 3; k++) {
        var da = drumSpin + k * Math.PI * 2 / 3;
        ctx.moveTo(DRUM[0], DRUM[1]); ctx.lineTo(DRUM[0] + Math.cos(da) * 7, DRUM[1] + Math.sin(da) * 7);
      }
      stroke("rgba(190, 240, 255, 0.95)", 1.3, 8);
      // mud flicking off the turning wheels
      if (mo.speed > 0.05) {
        ctx.fillStyle = "rgb(150, 210, 255)";
        flecks.forEach(function (f) {
          var p = (f.p + time * f.v) % 1, wx = WHEELS[f.wheel];
          ctx.globalAlpha = fade * mo.alpha * (1 - p) * Math.min(1, mo.speed) * 0.8;
          ctx.fillRect(wx - 22 - p * 70 * f.k, -8 - p * 46 * f.k + p * p * 52, 2.4 / s, 2.4 / s);
        });
        ctx.globalAlpha = fade * mo.alpha;
      }
      ctx.restore();

      // ---- the ground over the sunk wheels
      ctx.beginPath();
      ctx.moveTo(g0[0], g0[1]); ctx.lineTo(g1[0], g1[1]); ctx.lineTo(g1[0], BOX.b); ctx.lineTo(g0[0], BOX.b);
      ctx.closePath();
      var slab = ctx.createLinearGradient(0, -260, 0, BOX.b);
      slab.addColorStop(0, "rgba(5, 10, 30, 0.94)");
      slab.addColorStop(1, "rgba(4, 8, 24, 0.7)");
      ctx.fillStyle = slab;
      ctx.fill();
      ctx.save();
      ctx.clip();
      // layers under the surface, fading down
      [14, 30, 50].forEach(function (dep, k2) {
        var a0 = onSlope(-120), a1 = onSlope(TREE + 140);
        ctx.beginPath(); ctx.moveTo(a0[0], a0[1] + dep); ctx.lineTo(a1[0], a1[1] + dep);
        ctx.strokeStyle = "rgba(76, 201, 255, " + (0.2 - k2 * 0.05) + ")";
        ctx.lineWidth = 0.8 / s;
        ctx.stroke();
      });
      // lumps of mud
      ctx.strokeStyle = "rgba(76, 201, 255, 0.22)";
      ctx.lineWidth = 0.9 / s;
      MUD.forEach(function (mu) {
        var p = onSlope(mu.d);
        ctx.beginPath(); ctx.ellipse(p[0], p[1] + mu.depth, mu.r * 2, mu.r, -SLOPE, 0, Math.PI * 2); ctx.stroke();
      });
      ctx.restore();
      // the lit surface
      var edge = ctx.createLinearGradient(g0[0], 0, g1[0], 0);
      edge.addColorStop(0, "rgba(76, 201, 255, 0)");
      edge.addColorStop(0.15, "rgba(76, 201, 255, 0.75)");
      edge.addColorStop(0.9, "rgba(76, 201, 255, 0.75)");
      edge.addColorStop(1, "rgba(76, 201, 255, 0)");
      ctx.beginPath(); ctx.moveTo(g0[0], g0[1]); ctx.lineTo(g1[0], g1[1]);
      ctx.strokeStyle = edge; ctx.lineWidth = 1.3 / s;
      ctx.shadowColor = "rgba(76, 201, 255, 0.9)"; ctx.shadowBlur = 8; ctx.stroke(); ctx.shadowBlur = 0;
      // mud heaped against the tyres
      ctx.beginPath();
      WHEELS.forEach(function (x) {
        var c0 = world(d, [x - 38, -2 - SINK]), c1 = world(d, [x + 38, -2 - SINK]), top = world(d, [x + 6, -12 - SINK]);
        ctx.moveTo(c0[0], c0[1]); ctx.quadraticCurveTo(top[0], top[1], c1[0], c1[1]);
      });
      stroke("rgba(120, 200, 255, 0.6)", 1.1, 4);

      // ---- the rope: from the recovery point, round the sheave, to the winch
      var a2 = Math.atan2(T2[1] - K[1], T2[0] - K[0]), a1 = Math.atan2(T1[1] - K[1], T1[0] - K[0]);
      var far = Math.atan2(-uy, -ux);
      var norm = function (a) { return ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); };
      var cw = norm(far - a2) < norm(a1 - a2);
      function rope() {
        ctx.moveTo(Rp[0], Rp[1]);
        ctx.lineTo(T2[0], T2[1]);
        ctx.arc(K[0], K[1], R_SHEAVE, a2, a1, !cw);
        ctx.lineTo(F[0], F[1]);
      }
      ctx.beginPath(); rope(); stroke("rgba(120, 215, 255, 0.85)", 1.8, 8);
      ctx.setLineDash([9, 15]);
      ctx.lineDashOffset = -d * 2.2;
      ctx.beginPath(); rope(); stroke("rgba(235, 250, 255, 0.95)", 1.3, 6);
      ctx.setLineDash([]);
      // the sheave turning
      ctx.beginPath();
      ring(ctx, K[0], K[1], R_SHEAVE - 3);
      ring(ctx, K[0], K[1], 3);
      var sheave = d / R_SHEAVE;
      for (var sp = 0; sp < 4; sp++) {
        var sa = sheave + sp * Math.PI / 2;
        ctx.moveTo(K[0] + Math.cos(sa) * 3, K[1] + Math.sin(sa) * 3);
        ctx.lineTo(K[0] + Math.cos(sa) * (R_SHEAVE - 3), K[1] + Math.sin(sa) * (R_SHEAVE - 3));
      }
      stroke("rgba(190, 240, 255, 0.9)", 1.1, 6);

      // ---- labels
      if (labels) {
        ctx.font = "600 " + (10.5 / s) + "px Inter, system-ui, sans-serif";
        if ("letterSpacing" in ctx) ctx.letterSpacing = (1.6 / s) + "px";
        ctx.textBaseline = "middle";
        var mid = [(F[0] + T1[0]) / 2, (F[1] + T1[1]) / 2];
        var midGround = onSlope(mid[0] / COS);
        var kGround = onSlope(K[0] / COS);
        var tags = [
          { label: "WINCH", at: F, lx: F[0], ly: F[1] - 118, align: "center" },
          { label: "TREE PROTECTOR", at: [band[0] - 12, band[1]], lx: band[0] - 34, ly: B[1] - 256, align: "right", via: [band[0] - 34, band[1] - 22] },
          { label: "DOUBLE LINE", at: mid, lx: mid[0], ly: midGround[1] + 40, align: "right" },
          { label: "SNATCH BLOCK", at: [K[0], K[1] + R_SHEAVE + 5], lx: K[0], ly: kGround[1] + 40, align: "left" },
        ];
        tags.forEach(function (tag, n) {
          var tw = ctx.measureText(tag.label).width;
          var down = tag.ly < tag.at[1];
          var lead0 = [tag.lx, tag.ly + (down ? 12 : -12) / s * 0.9];
          // leader: dashed, with a pulsing ring on the point
          ctx.strokeStyle = "rgba(76, 201, 255, 0.75)";
          ctx.lineWidth = 1 / s;
          ctx.setLineDash([3 / s, 3 / s]);
          ctx.beginPath();
          ctx.moveTo(lead0[0], lead0[1]);
          if (tag.via) ctx.lineTo(tag.via[0], tag.via[1]);
          ctx.lineTo(tag.at[0], tag.at[1]);
          ctx.stroke();
          ctx.setLineDash([]);
          var rr = reduceMotion ? 0.3 : (time * 1.2 + n * 0.27) % 1;
          ctx.strokeStyle = "rgba(160, 230, 255, " + (1 - rr) * 0.85 + ")";
          ctx.beginPath(); ctx.arc(tag.at[0], tag.at[1], 3 + rr * 9, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = "rgba(76, 201, 255, 0.95)";
          ctx.beginPath(); ctx.arc(tag.at[0], tag.at[1], 2.2 / s, 0, Math.PI * 2); ctx.fill();
          // the label, with a short underline in light
          ctx.textAlign = tag.align;
          ctx.fillStyle = "rgba(225, 242, 255, 0.95)";
          ctx.shadowColor = "rgba(76, 201, 255, 0.9)"; ctx.shadowBlur = 8;
          var tx0 = tag.align === "center" ? tag.lx : tag.align === "right" ? tag.lx + 6 / s : tag.lx - 6 / s;
          ctx.fillText(tag.label, tx0, tag.ly);
          ctx.shadowBlur = 0;
          var ux0 = tag.align === "center" ? tag.lx - tw / 2 : tag.align === "right" ? tx0 - tw : tx0;
          ctx.fillStyle = "rgba(76, 201, 255, 0.6)";
          ctx.fillRect(ux0, tag.ly + 9 / s, tw, 1 / s);
        });

        // A HUD frame with the scene's name, a blinking light and the line
        // pull rising and falling with the winching (no figures).
        ctx.globalAlpha = fade;
        ctx.strokeStyle = "rgba(76, 201, 255, 0.55)";
        ctx.lineWidth = 1 / s;
        var L = BOX.l, T = BOX.t, R = BOX.r, Bm = BOX.b, cc = 16;
        ctx.beginPath();
        ctx.moveTo(L, T + cc); ctx.lineTo(L, T); ctx.lineTo(L + cc, T);
        ctx.moveTo(R - cc, T); ctx.lineTo(R, T); ctx.lineTo(R, T + cc);
        ctx.moveTo(L, Bm - cc); ctx.lineTo(L, Bm); ctx.lineTo(L + cc, Bm);
        ctx.moveTo(R - cc, Bm); ctx.lineTo(R, Bm); ctx.lineTo(R, Bm - cc);
        ctx.stroke();
        ctx.textAlign = "left";
        ctx.fillStyle = "rgba(150, 190, 235, 0.8)";
        ctx.fillText("WINCH PLAN", L + 30, T + 14);
        ctx.fillStyle = "rgba(46, 230, 166, " + (0.4 + 0.6 * (Math.sin(time * 4) > 0 ? 1 : 0.2)) + ")";
        ctx.beginPath(); ctx.arc(L + 18, T + 14, 3.2, 0, Math.PI * 2); ctx.fill();
        var pull = mo.phase < PULL ? Math.min(1, mo.phase / 0.8) * (0.7 + 0.04 * Math.sin(time * 9)) : 0.15;
        if (reduceMotion) pull = 0.7;
        var pw = 120, px = L + 30, py = T + 34;
        ctx.fillStyle = "rgba(150, 190, 235, 0.8)";
        ctx.font = "600 " + (9 / s) + "px Inter, system-ui, sans-serif";
        ctx.fillText("LINE PULL", px + pw + 12, py + 2);
        ctx.fillStyle = "rgba(76, 201, 255, 0.18)";
        ctx.fillRect(px, py, pw, 4);
        ctx.fillStyle = "rgba(76, 201, 255, 0.95)";
        ctx.shadowColor = "rgba(76, 201, 255, 1)"; ctx.shadowBlur = 8;
        ctx.fillRect(px, py, pw * pull, 4);
        ctx.shadowBlur = 0;
      }
      ctx.restore();
    }

    var running = false, visible = true, raf = 0;
    function loop(t) { frame(t); raf = requestAnimationFrame(loop); }
    function update() {
      var should = !reduceMotion && visible && !document.hidden;
      if (should && !running) { running = true; raf = requestAnimationFrame(loop); }
      if (!should && running) { running = false; cancelAnimationFrame(raf); }
    }
    function still() { if (!running) frame(PULL * 550); }

    resize();
    still();
    if ("ResizeObserver" in window) new ResizeObserver(function () { resize(); still(); }).observe(header);
    else window.addEventListener("resize", function () { resize(); still(); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { resize(); still(); });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; update(); }).observe(header);
    }
    document.addEventListener("visibilitychange", update);
    header.addEventListener("pointermove", function (e) {
      var rect = header.getBoundingClientRect();
      mx = (e.clientX - rect.left) / rect.width - 0.5;
      my = (e.clientY - rect.top) / rect.height - 0.5;
    });
    update();
  }

  function start() { setUpReveal(); setUpHologram(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
