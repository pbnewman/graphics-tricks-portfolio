# TODO — Agent backlog

This is the working backlog. Agents pick tasks from here, top-down, per
`.claude/AGENT.md` §3.

**Status legend:**
- `- [ ]` = open, available
- `- [x] **Commit:** <sha>` = done
- `BLOCKED-NEEDS-HUMAN` = waiting on a human decision (skip and surface)
- `wip` = in-progress (with a `**Progress:**` note)

**Effort tags:**
- `XS` ≈ ≤ 10 min
- `S` ≈ 10–25 min
- `M` ≈ 25–45 min (target session size)
- `L` ≈ > 45 min (must be split before picking)

**How tasks are formatted:**

```
- [ ] **T-NNN** · <effort> · `files/likely/touched`
  One-line summary of what to do.
  **Done when:** explicit acceptance criteria.
  **Depends:** T-XXX, T-YYY (or empty)
  **Notes:** anything an agent needs to know
```

Newly-discovered tasks should be appended to the bottom of the relevant
phase. The phase order encodes priority.

---

## Phase 1 — Polish & foundations

Goal: bring the existing site to "fully polished" without changing its shape.

- [ ] **T-001** · XS · `index.html`
  Set descriptive `<title>` and `<meta name="description">` (currently the
  title is fine but `<meta description>` is missing).
  **Done when:** `<meta name="description" content="...">` exists with
  140–160 chars summarizing the site; `<meta name="author">` set to
  `pbnewman`; `<meta name="theme-color" content="#0a0a0c">` set.
  **Depends:** —

- [ ] **T-002** · S · `index.html`
  Add an inline SVG favicon (a tiny 16×16 flame matching the topbar mark,
  burnt-orange against the dark background).
  **Done when:** `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;...">`
  is present in `<head>`; favicon shows in the browser tab.
  **Depends:** —
  **Notes:** Keep it as a data-URI SVG so we don't add a new file.

- [ ] **T-003** · M · `index.html`
  Per-specimen anchor links: each `<article class="specimen">` gets an
  `id="NNN-slug"` (e.g. `001-fire`, `002-boids`). Update the existing topbar
  IntersectionObserver to call `history.replaceState` so the URL hash tracks
  the current specimen as you scroll. Visiting a `#NNN-slug` URL on page
  load should scroll to that specimen.
  **Done when:** all 30 specimens have IDs; scrolling updates `location.hash`
  without history spam (replaceState, not pushState); page-load with a hash
  scrolls to the right specimen.
  **Depends:** —
  **Notes:** slug = `data-effect` attribute value, prefixed with the 3-digit
  number.

- [ ] **T-004** · S · `index.html`
  Hover-revealed "copy permalink" affordance on the `.specimen-num` element
  (the big orange "001"). On click, copies `location.origin + pathname + #id`
  to clipboard. Brief visual feedback ("copied").
  **Done when:** hovering a specimen-num shows a `↗` or `#` glyph; clicking
  it copies the permalink; ≤ 1s visual confirmation.
  **Depends:** T-003

- [ ] **T-005** · S · `index.html`
  Respect `prefers-reduced-motion`. When the media query matches, effects
  should render a single static frame and then pause; the topbar flame
  should also be static.
  **Done when:** with `prefers-reduced-motion: reduce` set in DevTools, no
  canvas is animating; all canvases show one rendered frame so the page
  isn't a sea of black squares.
  **Depends:** —
  **Notes:** Add a `static` flag to the base `Effect` class; check the media
  query at construction time.

- [ ] **T-006** · M · `index.html`
  Keyboard navigation: `j` / `↓` jumps to the next specimen, `k` / `↑` to
  the previous. Smooth scroll. Ignored if a form field has focus.
  **Done when:** pressing j/k while the page has focus scrolls one specimen
  at a time with `behavior: 'smooth'`; URL hash updates (via T-003); doesn't
  fire when typing in an input.
  **Depends:** T-003

- [ ] **T-007** · S · `index.html`
  Space-bar pauses/resumes all currently-visible effects. Visual indicator
  in the topbar shows "Paused" when paused.
  **Done when:** pressing space toggles a global `paused` flag that suspends
  each effect's `update()` loop; a small "Paused" pill appears in the
  topbar when paused.
  **Depends:** —

- [ ] **T-008** · S · `index.html`
  Add `aria-label` to every `<canvas data-effect="...">`. Use the specimen
  title for the label (e.g. "Live canvas: The Doom fire effect").
  **Done when:** all 30+ canvases (including the topbar flame) have
  meaningful aria-labels; the topbar flame is marked `aria-hidden="true"`
  since it's decorative.
  **Depends:** —

- [ ] **T-009** · S · `sitemap.xml` (new), `index.html`
  Generate `sitemap.xml` listing the canonical URL plus all 30
  `#NNN-slug` anchors. Add `<link rel="sitemap">` to `<head>`.
  **Done when:** `sitemap.xml` exists at repo root with 31 `<url>` entries;
  `<head>` links to it.
  **Depends:** T-003

- [ ] **T-010** · S · `404.html` (new)
  Style-matched 404 page. Could be a simple plasma or tunnel that says "404
  · this trick doesn't exist (yet)" with a link back to home.
  **Done when:** `404.html` exists at repo root, uses the same fonts/colors
  as the main page, links back to `/`.
  **Depends:** —
  **Notes:** GitHub Pages serves `/404.html` automatically.

- [ ] **T-011** · XS · `LICENSE` (new), `README.md`
  `BLOCKED-NEEDS-HUMAN` — need author choice between MIT, CC-BY-4.0, CC0.
  Default proposal: MIT for code, CC-BY-4.0 for prose/imagery. Until the
  author confirms, agents should not pick this.
  **Done when:** `LICENSE` file exists; `README.md` mentions the license.
  **Depends:** —

- [ ] **T-012** · XS · `index.html`
  Add a license link to the footer.
  **Done when:** the footer shows "MIT" (or whatever T-011 settled on)
  linking to `LICENSE`.
  **Depends:** T-011

- [ ] **T-013** · S · `index.html`
  Open Graph + Twitter Card meta tags, text-only for now (no cover image
  asset yet — see T-013b).
  **Done when:** `og:title`, `og:description`, `og:url`, `og:type=website`,
  `twitter:card=summary`, `twitter:title`, `twitter:description` all present
  in `<head>`.
  **Depends:** —

- [ ] **T-013b** · M · `og-cover.svg` (new), `og-cover.png` (new), `index.html`
  Curated Open Graph cover image — `BLOCKED-NEEDS-HUMAN` on design
  direction (still of which specimen? Composite? Typography-only?).
  Default proposal: a stylized "field guide cover" — the site title in
  Instrument Serif over a still of the tunnel effect at low opacity.
  **Done when:** `og-cover.png` exists at 1200×630, referenced via
  `og:image` and `twitter:image`.
  **Depends:** T-013

- [ ] **T-014** · XS · `index.html`
  Add a "skip to content" link as the first focusable element, hidden until
  it receives focus.
  **Done when:** tabbing into the page first focuses a "Skip to content"
  link that jumps past the topbar to `#main`; `<section class="specimens">`
  gets `id="main"`.
  **Depends:** —

- [ ] **T-015** · M · `index.html`
  Loading skeleton on canvases before mount: while a canvas hasn't yet been
  initialized by the IntersectionObserver, show a faint dot-grid pattern
  via CSS background instead of solid black.
  **Done when:** every `.canvas-frame` shows a subtle grid before its
  effect mounts; grid fades out (opacity 0) once the canvas first renders.
  **Depends:** —

---

## Phase 2 — Modularize + source view

Goal: unlock the source-code viewer, the biggest pedagogical win.

- [ ] **T-016** · L · multiple
  `BLOCKED-NEEDS-HUMAN` — direction question for the author. Three options:
  (a) extract each effect to `/src/effects/NNN-name.js` with a small build
  step (esbuild) that re-inlines into a single HTML for archival;
  (b) keep effects in `index.html` but extract their source as string
  literals into a `data-source` attribute on each canvas so the source
  viewer can read them directly;
  (c) write a small parse-from-HTML script that scrapes the JS source at
  build time into `effects-sources.json` and the viewer fetches that.
  Recommendation: (b) — zero build, zero new files, but adds ~80 KB to the
  HTML. Agents: do not pick this; surface to human.
  **Done when:** author has picked a direction; this task is split into
  smaller per-effect extraction tasks.
  **Depends:** —

- [ ] **T-017** · M · `index.html`
  Source-code viewer drawer per specimen. A small "</> source" button on
  each `.canvas-frame` slides up a panel showing the syntax-highlighted JS
  for that specimen only.
  **Done when:** clicking the button opens a panel under the canvas with
  the source for that effect class; close button works; basic
  monochrome-with-accent syntax highlighting (no library; a tiny regex-based
  highlighter is fine).
  **Depends:** T-016

- [ ] **T-018** · M · `index.html`
  Extract all CSS to inline `<style>` blocks per section, in preparation
  for a future split. Don't move it to a separate file yet (T-016 decision
  pending). But organize the existing styles into commented sections:
  `RESET`, `TYPOGRAPHY`, `TOPBAR`, `SPECIMENS`, `SEE ALSO`, `FOOTER`,
  `RESPONSIVE`, `A11Y`.
  **Done when:** all CSS rules are grouped under one of the seven section
  comments; no visual regression.
  **Depends:** —

---

## Phase 3 — Search, TOC, settings

- [ ] **T-019** · M · `index.html`
  Random-specimen button in the topbar (🎲 or "RANDOM" text). Scrolls to a
  random specimen with smooth behavior.
  **Done when:** clicking the button scrolls smoothly to a random
  `article.specimen` not currently visible; URL hash updates (T-003).
  **Depends:** T-003

- [ ] **T-020** · M · `index.html`
  TOC drawer: a ≡ button in the topbar opens a slide-in panel listing all
  30 specimens (number + title + year). Click an entry to jump.
  **Done when:** drawer opens/closes smoothly; lists every specimen; click
  scrolls to that specimen; closes on Escape and on clicking outside.
  **Depends:** T-003

- [ ] **T-021** · M · `index.html`
  Fullscreen mode per canvas. A `⤢` button on the canvas-overlay enters
  fullscreen using the Fullscreen API; press Escape to exit.
  **Done when:** every canvas has a fullscreen button; click takes that
  canvas fullscreen; the effect resumes at the new resolution.
  **Depends:** —

- [ ] **T-022** · M · `index.html`
  Settings drawer: ⚙ button opens a small panel with toggles for
  reduce-motion, theme (when added), performance (auto/high/saver),
  source-by-default. Persist in `localStorage`.
  **Done when:** drawer opens; each toggle persists across reload;
  reduce-motion toggle overrides the media query.
  **Depends:** T-005

- [ ] **T-023** · M · `index.html`
  Subtle fade-in transition when a specimen enters the trigger band:
  the `.canvas-frame` opacity goes 0.8 → 1.0 over 250ms.
  **Done when:** scrolling produces a faint but perceptible fade-in as
  each specimen becomes "current"; doesn't fight `prefers-reduced-motion`.
  **Depends:** T-005

- [ ] **T-024** · M · `index.html`
  Print stylesheet: a `@media print` block that renders each specimen as
  a "field-guide page" — one specimen per page, canvas frozen at last
  frame (as a captured PNG via `toDataURL`), prose below.
  **Done when:** `Cmd-P` / `Ctrl-P` produces a tidy printable version;
  canvases are non-interactive stills.
  **Depends:** —

---

## Phase 5 — New specimens

These are substantial but contained. Each adds a new `<article>` and a new
effect class. Sized as `L` because new specimens are usually 1.5–2 sessions.
Agents picking these should split: session 1 = effect class + placeholder
article; session 2 = polish and prose.

- [ ] **T-030** · L · `index.html`
  New specimen: **Maze generation comparison** — split-quadrant canvas
  running four maze algorithms side-by-side (recursive backtracker,
  Wilson's, Eller's, Kruskal's). Click cycles through showing one at a
  time at full size.
  **Done when:** new article #031 with this effect; ≈ 80 lines for the
  combined generators; click interaction works.
  **Depends:** —

- [ ] **T-031** · L · `index.html`
  New specimen: **Delaunay triangulation** — companion to Voronoi (#023).
  Same point set; toggle/click switches between Voronoi cells and the dual
  Delaunay mesh. Use Bowyer-Watson incremental algorithm.
  **Done when:** new article #032; click toggles Voronoi ↔ Delaunay.
  **Depends:** —

- [ ] **T-032** · L · `index.html`
  New specimen: **Sorting visualized** — bar chart of N values being
  sorted; click cycles algorithms (bubble, insertion, quick, merge, heap,
  radix). Each algorithm is ≤ 20 lines.
  **Done when:** new article #033; click cycles algorithms; small label
  shows which is running.
  **Depends:** —

- [ ] **T-033** · L · `index.html`
  Promote "See Also" → live: **Bresenham's line algorithm**. A small grid
  where mouse position is the line endpoint; pixels light up as Bresenham
  chooses them.
  **Done when:** new article #034 (or replace the See Also card with a
  full specimen); the prose explains the integer-only trick; click freezes
  for inspection.
  **Depends:** —

- [ ] **T-034** · L · `index.html`
  Promote "See Also" → live: **Quaternion rotation**. A wireframe cube
  rotating via quaternions; toggle to Euler angles to demonstrate gimbal
  lock.
  **Done when:** new article #035; toggle works; gimbal lock visible.
  **Depends:** —

---

## Phase 6 — Beyond a GitHub page

Most of these are `BLOCKED-NEEDS-HUMAN`. Listed for visibility, not for
agents to pick.

- [ ] **T-040** · — · `BLOCKED-NEEDS-HUMAN`
  Custom domain. Author to pick a name. Then add `CNAME` file.

- [ ] **T-041** · — · `BLOCKED-NEEDS-HUMAN`
  Analytics provider choice (Plausible / Umami / none). Add tag once chosen.

- [ ] **T-042** · S · `manifest.webmanifest` (new), `index.html`
  PWA manifest + a basic service worker that caches the page for offline.
  **Done when:** manifest exists with name, icons, theme color, display
  `standalone`; service worker caches HTML + fonts; "Install app" prompt
  fires in Chromium.
  **Depends:** T-002

- [ ] **T-043** · — · `BLOCKED-NEEDS-HUMAN`
  GitHub Discussions enabled + giscus comments. Author needs to enable
  Discussions in repo settings first.

---

## Done

Tasks move here (with their `- [x]` and `**Commit:**` line) as agents
complete them. Agents append to this section, never delete.

*(none yet)*

---

## Backlog hygiene rules

- An agent may add new `T-NNN` items they discover during work. Append to
  the **end** of the relevant phase.
- An agent should not edit existing task descriptions except to add
  `**Progress:**`, `**Commit:**`, or `**Notes:**` lines, or to change the
  checkbox state.
- If a task is reclassified (effort estimate was wrong, dependencies
  changed), note it in `SESSIONS.md` and edit the task in a separate
  bookkeeping commit so the history is clear.
- Numbering is monotonic. Don't reuse T-IDs even if a task is deleted.
