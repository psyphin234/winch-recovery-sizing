# Winch & Recovery Sizing

Static calculator for 4x4 **winching**, part of the PsyPhin site: the pull it takes to winch a stuck vehicle out, what double and triple lines do, how a winch copes as rope piles onto the drum, the current it draws along the way, the rigging ratings, and the winch size. Started 2026-10-11; redesigned the same day (owner: "a lot less complicated looking", inputs on the diagrams, animated, one page).

**Winching only.** Straps and kinetic recovery are for a separate page the owner will do later. Their rules (Australian strap standard, Bushranger's strap sheet, the kinetic spring model, kinetic rope stretch), and the battery/cable electrics (SAE J537, IEC 60028), were removed on 2026-10-11 and are in git history (commit 8565449 and before) to reuse.

Repo `psyphin234/winch-recovery-sizing` (public), GitHub Pages from `main` / root. Push to `main` to deploy; check with `gh api repos/psyphin234/winch-recovery-sizing/pages/builds/latest`. Card on psyphin.co.za (Tools, amber "Under construction") since 2026-10-11.

**Address:** until its subdomain is set up it's served at `https://psyphin.co.za/winch-recovery-sizing/` (inherited from the psyphin234.github.io user site). The planned address is **https://winching.psyphin.co.za/**. To switch (the pattern in the psyphin.co.za CLAUDE.md):
1. Owner adds an Afrihost CNAME `winching.psyphin.co.za` → `psyphin234.github.io` (the form wants the full hostname). Check: `nslookup winching.psyphin.co.za 8.8.8.8`.
2. Only once that resolves: set the custom domain (`gh api -X PUT repos/psyphin234/winch-recovery-sizing/pages -f cname=winching.psyphin.co.za`), then `git pull` the `CNAME` file GitHub commits. Doing this before the DNS exists would redirect the working address to one that doesn't resolve.
3. Once the certificate is issued, turn on Enforce HTTPS (`-F https_enforced=true`), add `<link rel="canonical">` and `og:url` for the new address to both pages, change the card's `url` in psyphin.co.za's `projects.js`, and update the psyphin.co.za CLAUDE.md DNS list (and its runbook).

Plain HTML/CSS/vanilla JS, classic scripts (no modules, no build step), so `index.html` opens straight from disk. Everything runs in the browser; inputs are only kept in the visitor's own `localStorage` (key `winch-calc-v2`).

**Status: UNDER CONSTRUCTION.** Both pages carry the amber `.construction` banner and `<meta name="robots" content="noindex">`. Keep both until the owner says otherwise.

## Source policy (owner's rule, non-negotiable)

- **Engineering, standards, manufacturers' published data and best practice, and published recovery methods only. No broscience:** no forum, club, retailer-blog or "everyone says" figures.
- Every number lives in `js/data.js` as a rule's `params`, next to its sources, the exact words quoted from the source (`quote`) and a `checked` date. `calc.js`, `app.js` and the HTML read them from there; don't hard-code 1.5, 8%, 25% etc.
- Where nothing citable exists, add a `gaps` entry and say "no published figure" on the page instead of guessing. Current gaps: rock (the user picks the nearest published ground, labelled as their choice), snow (not offered), suction, duty cycle.
- Rule `category` drives the tag: method | maker | engineering | calculation. **calculation** = this site's own physics; it must cite `physics` and say so where shown.
- Before adding a claim, read the source itself. Checked and dropped on 2026-10-11: "a strap rated over 3x GVM won't stretch enough" (unverifiable), WreckMaster's "body mire 1.5x" (only quoted second-hand on forums, so "bogged to the chassis" uses I4WDTA instead), and an early "within 10% of measured" claim for I4WDTA (true only for the bogged tests; their slight-incline test came out ~30% under, which the slope rule now says).

## Sources used (all in data.js)

- **I4WDTA, Recovery Resistance Calculations (2020)**: total resistance = ground (weight / GCF, after Sibly's NZ 4WD Handbook) + gradient (1/60 per degree to 45°; the page uses weight × sin, which matches) + damage resistance + 25% margin. The page's three bog levels: **not bogged** = GCF; **bogged to the axles** = GCF − 1 (I4WDTA's rule); **bogged to the chassis** = no wheel can roll, damage resistance = full weight added to the ground (how I4WDTA worked out their "bogged to both diffs" field tests, 1–11% above measured). Their worked example (3 500 lb Jeep, soft clay, one wheel, 15° = 4 375 lb) is a test.
- **WARN**: 1.5 × GVWR winch rule; pull by layer (rated on layer 1); min 5 wraps steel / 10 synthetic; ZEON 10 spec and first-layer chart (via 4x4 Down Under's listing); engine running, 650 CCA, lithium caution; heavy-duty snatch block (two WLLs: 4:1 ASME B30.26 and 2:1 BS 7901, MBS 96 000 lb).
- **Crosby G-209**: shackle WLL table, ultimate ≥ 6 × WLL. **LEEA COPSULE 7.5.6**: 8% per sheave.
- The drum model (rope centre one rope diameter further out per layer) reproduces WARN's ZEON 10 layer table to within 0.5%; a test checks it. The page draws every winch with the ZEON 10's drum (80 × 229 mm) and 9.5 mm rope, and scales the ZEON 10 chart to the user's rating; it says so under the readouts.

## The page (one page, no modes)

One `.stage` card, top to bottom:
1. **Try:** example chips (`scenarios` in data.js; made-up figures).
2. **Scene** (`V.scene()`): animated side view. The **mass**, **winch** and **anchor distance** fields are HTML overlays on the picture (on the roof, in the sky in front, and on a dimension line over the rope), placed by `toPercent()` so they follow the slope; under 860 px `placeFields()` in app.js moves them below the picture and the dimension line shows the distance as text. The anchor field and the one on the rope diagram are the same value. No force arrows or load/winch labels on the picture (owner's call, 2026-10-11): the balance bars below it make that comparison. Slope turns the world (`rotate`, shrinks up to 30% at 45° so the tree stays in view); bogging sinks the vehicle into the ground (the ground is drawn over it); ground chips change the ground pattern (colours are illustration only). Animations by status: winching (wheels turn, vehicle edges forward, rope runs), close (slower), short (rope strains, winch arrow pulses red), rolls (downhill). All off under prefers-reduced-motion.
3. **Controls:** ground chips: Tar, Gravel, Grass, Sand (I4WDTA loose wet sand, 3: the owner chose the cautious sand figure), Mud (their shallow mud, 3; deeper is "How deep", and mud to the axles gives 2 = their deep mud), Soft clay, Rock (asks for the nearest ground). Hard wet sand, loose wet sand, shingle, deep mud and snow were dropped from the list (owner's call); older saved choices fall back to the default. how deep (3 icon chips), slope (Uphill/Downhill + slider 0–45°, shows ° and %), and rope angle (slider 0–45° with a little top view that swings; the rope must pull resistance ÷ cos, and the verdict states the sideways pull, resistance × tan; its extra pull is the magenta `--series-4` segment, validated with the other three). No typed angles (owner's call).
4. **Verdict:** headline, detail, a one-click fix when another line count or a closer anchor would work, and the balance bars (rope pull needed, segmented, with a tick at the estimate without margin; winch on its start layer, with a mark for its end layer).
5. **How the rope is run:** three clickable thumbnails (single/double/triple, each with the winch pull and a pass/fail mark, or "rope too short"), the top-view rigging diagram with the **anchor distance typed on the rope** (with a rope angle, everything from the vehicle's front out is sheared so the ropes leave at the true angle; a dashed "way it must move" line and a magenta arc show the angle; the rope is drawn shorter at steep angles to keep the height down, and the anchor's label moves above the tree), and what each block / tree protector / rope end holds now and at the winch's full pull, with a Crosby shackle size.
6. **The pull, metre by metre:** the winch from the front (motor, drum between flanges, gearbox, tie bar, feet; labelled) with the drum cut through, one circle per wrap (grey = must stay on, blue = on at the start, light = wound on during the pull) and the rope leaving the outermost wrap "to the anchor", plus a legend; it sits beside the gauge, charts below with **rope length and steel/synthetic on the drum**; current gauge; pull chart (available vs needed) and current chart sharing the distance axis, with a playhead; Play button (plays once when it scrolls into view, 6 s); "the vehicle must move [x] m"; readouts (time, peak A, Ah drawn, rope wound in). No battery or wiring questions (owner's call); amps and Ah are what the winch draws.
7. **Winch for this pull:** minimum rating with where it comes from (larger of WARN's 1.5 × mass and this pull on its start layer); the user's winch **layer by layer** (a bar per layer against a line for the pull needed, the layers the pull uses highlighted, and a plain note on why outer layers pull less); common sizes for the chosen line count, each with a box per layer (green enough, red not, outlined = used in this pull) and "copes" / "too small".
Then the disclaimer and explainers (layers, block and shackle MBS/WLL, gaps).

- **Winch rating as typed** (`C.parseRating`): "EW9500" → 9 500 lb; "Zeon 10", "11XP" → thousands of lb (model-number reading, shown as such); "4.5 t", "4.T" → tonnes; "12 000 lb", "5443 kg", "9.5k", "45 kN"; a bare number ≥ 1000 → lb, ≤ 10 → tonnes; a unit beats a bare number. The page always shows its reading under the field and asks for a unit when unclear.
- Status: pass if the winch covers the need including the 25% margin all the way; amber "Close" if it covers the estimate but not the whole margin; red if not, or if the rope can't reach the anchor and keep its minimum wraps.

## Structure

```
index.html        The page (one stage) + explainers
sources.html      Every rule with category, summary, quote, sources, checked date; gaps; source list
js/data.js        THE data file: sources, rules, grounds (+ how each is drawn), bog levels, Crosby shackles, WARN ZEON 10 data, gaps, scenarios, defaults, common winch sizes
js/calc.js        Pure calculations (no DOM): resistance, parseRating, rigging, drum/layers, chart interpolation, motor, simulate(), sizing, shackleFor
js/ui.js          DOM + formatting helpers (el(), kg/lb/kN, lbMin/kgMin round UP for minimums, "Sources:" line)
js/diagrams.js    scene, lineThumb, rigging, drum, gauge, lineChart (playhead + tooltip). Rigging and charts are drawn at their box's real width so text stays readable on phones
js/app.js         State, building the controls once, update(), playback
js/sources.js     Builds sources.html from data.js
css/style.css     The SA Towing Check stylesheet (base) + this tool's section at the end. Chart colours --series-1/2/3 were validated (colour-blind separation) on --surface-2; the site's --accent was too light for a series colour
tests/            index.html + calc.test.js (data, I4WDTA example, bog levels, rating parser, rigging statics, WARN layer table, chart, simulation); run.ps1 runs them in headless Edge
```

## Preview and test

- Open `index.html` from disk, or `python -m http.server`.
- Tests: `powershell -ExecutionPolicy Bypass -File tests\run.ps1`.
- Headless Edge won't render narrower than about 490 px; to check 390 px, screenshot a page that iframes `index.html` at 390 px. Must fit 390 px with no horizontal page scroll. Also check ~700 px (fields below the picture) and desktop.
- Watch for heredoc/escape trouble when editing from the shell: a `\b` once became a backspace character in app.js. `grep -nP "[\x00-\x08]" js/*.js` finds them.

## Conventions

- Header: the same `.brand-bar` as fuel, towing and tyres (pill + Calculator/Sources, `logo.jpg`, eyebrow, title, subtitle). Favicons and `logo.jpg` are copies from the towing checker; change them together.
- GoatCounter tag is on both pages with the host-prefix snippet, as on the other tools.
- Brand is written **PsyPhin**. Commit identity: `74655215+psyphin234@users.noreply.github.com`. The repo is public: no personal names or private notes in committed files.

## Ideas parked by the owner

- **Straps and kinetic recovery:** a separate page (see the top of this file for what to reuse).
- **Power budget** (fridge, lights, charging, laptop, inverter losses as editable presets labelled "typical, check your device's label"): left for later as the least certain. Same source policy: preset draws need a maker's figure each, or a gap entry.
