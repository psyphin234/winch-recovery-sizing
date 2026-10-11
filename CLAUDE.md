# Winch & Recovery Sizing

Static calculator for 4x4 winch recoveries, part of the PsyPhin site: the pull it takes to recover a stuck vehicle, the winch size, what snatch blocks do, how a real winch copes as rope piles onto the drum, what it asks of the battery and wiring, and the strap, shackle and block ratings to match. Started 2026-10-11.

Repo `psyphin234/winch-recovery-sizing` (public), GitHub Pages from `main` / root. Push to `main` to deploy; check with `gh api repos/psyphin234/winch-recovery-sizing/pages/builds/latest`. No card on psyphin.co.za yet.

**Address:** until its subdomain is set up it's served at `https://psyphin.co.za/winch-recovery-sizing/` (inherited from the psyphin234.github.io user site). The planned address is **https://winching.psyphin.co.za/**. To switch (the pattern in the psyphin.co.za CLAUDE.md):
1. Owner adds an Afrihost CNAME `winching.psyphin.co.za` → `psyphin234.github.io` (the form wants the full hostname). Check: `nslookup winching.psyphin.co.za 8.8.8.8`.
2. Only once that resolves: set the custom domain (`gh api -X PUT repos/psyphin234/winch-recovery-sizing/pages -f cname=winching.psyphin.co.za`), then `git pull` the `CNAME` file GitHub commits. Doing this before the DNS exists would redirect the working address to one that doesn't resolve.
3. Once the certificate is issued, turn on Enforce HTTPS (`-F https_enforced=true`), add `<link rel="canonical">` and `og:url` for the new address to both pages, and update the psyphin.co.za CLAUDE.md DNS list (and its runbook).

Plain HTML/CSS/vanilla JS, classic scripts (no modules, no build step), so `index.html` opens straight from disk. Everything runs in the browser; inputs are only kept in the visitor's own `localStorage`.

**Status: UNDER CONSTRUCTION.** Both pages carry the amber `.construction` banner and `<meta name="robots" content="noindex">`. Keep both until the owner says otherwise.

## Source policy (owner's rule, non-negotiable)

- **Engineering, standards, manufacturers' published data and best practice, and published recovery methods only. No broscience:** no forum, club, retailer-blog or "everyone says" figures.
- Every number lives in `js/data.js` as a rule's `params`, next to its sources, the exact words quoted from the source (`quote`) and a `checked` date. `calc.js`, `app.js` and the HTML read them from there; don't hard-code 1.5, 8%, 650 CCA etc.
- Where nothing citable exists, add a `gaps` entry and say "no published figure" on the page instead of guessing. Current gaps: snow and rock ground factors (the user picks the nearest published ground, labelled as their choice), winch rope MBS-to-rating ratio, duty cycle, alternator output at idle.
- Rule `category` drives the tag: method | maker | standard | engineering | calculation. **calculation** = this site's own physics (statics, energy, Ohm's law); it must cite `physics` and say so where shown.
- Before adding a claim, read the source itself. Things checked and dropped on 2026-10-11: "a strap rated over 3x GVM won't stretch enough" (not in anything readable; removed), and an early "within 10% of measured" claim for I4WDTA (true only for the four bogged tests; their slight-incline test came out ~30% under, which the gradient rule now says).
- Kinetic rope/strap peak force is an idealised spring model (`kinetic()` in calc.js); the page labels it "Simplified physics, not a measurement". Keep that label.

## Sources used (all in data.js)

- **I4WDTA, Recovery Resistance Calculations (2020)**: total resistance = ground (weight / GCF, after Sibly's NZ 4WD Handbook) + gradient (1/60 per degree to 45°; the page uses weight × sin, which matches) + damage (weight × stuck wheels / wheels) + 25% margin; bogged to the axles = GCF − 1. Their worked example (3 500 lb Jeep, soft clay, one wheel, 15° = 4 375 lb) is a test.
- **WARN**: 1.5 × GVWR winch rule; pull by layer (ZEON 8/10 tables; rated on layer 1); min 5 wraps steel / 10 synthetic; ZEON 10 spec and first-layer chart (via 4x4 Down Under's listing, as warn.com product pages weren't readable); 650 CCA; engine running; lithium caution; heavy-duty snatch block (two WLLs: 4:1 ASME B30.26 and 2:1 BS 7901, MBS 96 000 lb).
- **Crosby G-209**: shackle WLL table, ultimate ≥ 6 × WLL. **LEEA COPSULE 7.5.6**: 8% per sheave. **Australian recovery strap standard (2017)** + **Bushranger's strap sheet**: MBS 2–3 × GVM of the lighter vehicle; stand 1.5 × stretched length away; 20% stretch. **SAE J537** (CCA test, 7.2 V) and **IEC 60028** (copper 1/58 Ω mm²/m) for the electrics.
- The drum model (rope centre one rope diameter further out per layer) reproduces WARN's ZEON 10 layer table to within 0.5%; a test checks it.

## Structure

```
index.html        The calculator: form (left/top), results (right/below), explainers
sources.html      Every rule with category, summary, quote, sources, checked date; gaps; source list
js/data.js        THE data file: sources, rules (params/quote/checked), grounds, Crosby shackles, WARN ZEON 10 data, cables, gaps, scenarios
js/calc.js        Pure calculations (no DOM): resistance, rigging (n lines, redirects), drum/layers, chart interpolation, electrics, simulate(), sizing, kinetic
js/ui.js          DOM + formatting helpers (el(), kg/lb/kN, lbMin/kgMin round UP for minimums, check cards, "Sources:" line)
js/diagrams.js    Resistance bar, rigging top view, drum layers, pull-along-the-recovery chart (crosshair tooltip). Drawn at the panel's real width so text stays readable on phones; app.js re-renders on resize
js/app.js         Wires the form to calc.js, modes, scenarios, localStorage, renders every panel
js/sources.js     Builds sources.html from data.js
css/style.css     The SA Towing Check stylesheet (trimmed) + this tool's additions at the end. Chart colours --series-1/2/3 were validated (colour-blind separation) on --surface-2; the site's --accent was too light for a series colour
tests/            index.html + calc.test.js (data integrity, I4WDTA example, WARN layer table, rigging statics, electrics, kinetic); run.ps1 runs them in headless Edge
```

## Modes

- **Simple** (default): mass, ground, bogged, slope, single or double line. Output: resistance + breakdown, rope pull, winch size (WARN 1.5 × vs this recovery; per-layer table uses WARN ZEON 10 ratios), common winch sizes, snatch block comparison + rigging diagram, gear ratings, strap MBS range, MBS vs WLL.
- **Advanced** (`#advanced`; `#example` loads the deep-mud double-line scenario): adds stuck wheels, triple/four lines, rope angle, redirect block, anchor distance and pull distance, the user's winch (rating, rope, drum, MBS, editable performance chart), battery (lead-acid CCA or lithium BMS limit), cable size/length, alternator, and kinetic recovery.
- In Simple, advanced-only inputs are treated as 0/off (never silently used). Scenarios that use triple lines or stuck wheels switch to Advanced.
- Winch fields start as WARN ZEON 10 figures, labelled as such. Until the user edits the performance chart, current and speed come from the ZEON 10 chart scaled by fraction of rated pull (said on the page).
- The pull simulation holds the needed rope pull constant over the whole distance (cautious) and tracks layer, pull available, current, speed, time and Ah as rope winds on.
- Status: pass if the winch covers the need including the 25% margin; amber "Close" if it covers the estimate but not the whole margin; red if not.

## Preview and test

- Open `index.html` (or `index.html#example`) from disk, or `python -m http.server`.
- Tests: `powershell -ExecutionPolicy Bypass -File tests\run.ps1`.
- Headless Edge won't render narrower than about 490 px; to check 390 px, screenshot a page that iframes `index.html` at 390 px. Must fit 390 px with no horizontal page scroll (wide tables scroll inside `.table-wrap`).

## Conventions

- Header: the same `.brand-bar` as fuel, towing and tyres (pill + Calculator/Sources, `logo.jpg`, eyebrow, title, subtitle). Favicons and `logo.jpg` are copies from the towing checker; change them together.
- GoatCounter tag is on both pages with the host-prefix snippet, as on the other tools (harmless until hosted).
- Brand is written **PsyPhin**. Commit identity (when this becomes a repo): `74655215+psyphin234@users.noreply.github.com`. The repo will be public: no personal names or private notes in committed files.

## Ideas parked by the owner

- **Power budget** (fridge, lights, charging, laptop, inverter losses as editable presets labelled "typical, check your device's label"): the owner's idea, deliberately left for later as the least certain. Same source policy applies: preset draws need a maker's figure each, or a gap entry.
