# Roadmap — A Field Guide to Graphics Tricks

A planning document for evolving the site from "a beautiful single-page anthology"
into "the canonical living archive for graphics ideas, with playable depth."

---

## 1. At a glance

**What exists today** (commit `ec9f293`):

- A single ~6 kloc `index.html` (HTML + CSS + JS) hosted on GitHub Pages.
- **30 specimens**: live canvas demos of classic graphics effects, chronologically
  arranged (Doom fire → tunnel). 28 are 2D canvas, 1 is WebGL 2 (Fluid GL),
  21 of 30 have mouse/keyboard interactivity.
- A **"See Also"** section: 6 prose-only cards for effects that are visually
  invisible (fast inverse sqrt, quaternions, Bresenham, …).
- A **sticky topbar** with a live miniature fire effect and a current-specimen
  indicator that updates as you scroll.
- A minimal footer (GitHub avatar, tagline).
- **No build step**, **no external libraries** (just Google Fonts), **no
  routing**, **no anchors**, **no search**, **no source-code view**.

**Engineering quality is already high:**

- `IntersectionObserver`-driven lazy initialization (effects don't spin until
  visible, pause when off-screen, state persists across scroll).
- `WeakMap` for canvas→instance tracking.
- Device-pixel-ratio capping at 2× for performance.
- Clean `Effect` base class + per-effect subclasses + central registry.
- Graceful WebGL fallback for the GPU fluid demo.

This means improvements should **respect the existing taste and architecture**,
not propose a wholesale rewrite. The bar is "evolve, don't replace."

---

## 2. Design principles to preserve

Anything we add should honor what already works:

1. **Quiet, editorial restraint.** The site reads like a printed field guide.
   No marketing copy, no calls-to-action, no popups, no "as seen on" logos.
2. **Algorithms are the heroes.** UI chrome should never compete with the canvas.
3. **Minimal accent palette.** Burnt orange `#ff7e3d` is the only saturated color.
   Resist the temptation to introduce a rainbow of category tags.
4. **No-frameworks default.** A reader should be able to view-source and learn.
   If we add a build step, it must be **optional** (single-file fallback stays).
5. **Math is public domain, presentation is open source.** Anything we add
   should be similarly attributable and forkable.
6. **Length is a virtue when earned.** "≈ 20 lines" claims should remain true;
   if we add code views, they must show *that* implementation, not bloat.

---

## 3. Quick wins (≤ 2 hours each)

These are high-leverage, low-risk improvements that polish what's already there.

| # | Item | Why | Effort |
|---|---|---|---|
| QW-01 | **Per-specimen anchor links** — `#001-fire`, copy-link button on hover | Currently impossible to share a specific specimen. Single biggest UX gap. | S |
| QW-02 | **Open Graph + Twitter Card meta** with a curated cover image | Link previews on social are currently a blank URL. | S |
| QW-03 | **Proper `<title>` and `<meta description>`** for SEO and tab clarity | Browser tabs all say the same thing. | XS |
| QW-04 | **Favicon** (a tiny rasterized flame, matches the topbar mark) | Currently the default globe. | XS |
| QW-05 | **`prefers-reduced-motion` respect** — pause animations, render last frame | Accessibility + saves battery on motion-sensitive users. | S |
| QW-06 | **Keyboard navigation**: `j`/`k` or `↑`/`↓` jump to prev/next specimen | Power-user affordance; matches the editorial vibe. | S |
| QW-07 | **Global pause/play** key (`space`) | Useful for focus and screenshots. | XS |
| QW-08 | **"Skip to next" arrow** at the bottom of each specimen | Helps mobile readers; clear scroll affordance. | XS |
| QW-09 | **Sitemap + RSS** — `sitemap.xml`, `feed.xml` for new specimens | Trivial to generate; helps discovery. | S |
| QW-10 | **404 page** styled to match (a glitchy plasma maybe) | Currently the GitHub Pages default. | S |
| QW-11 | **`<canvas>` `aria-label`** describing each effect for screen readers | Accessibility minimum. | S |
| QW-12 | **`loading="lazy"` audit** + decode hints on the avatar | Tiny perf win. | XS |
| QW-13 | **"Made with" → license link** (CC-BY or MIT, your call) | Currently ambiguous. | XS |

---

## 4. Foundational improvements (medium effort)

These unlock everything else and should land before big features.

### 4.1 Modularize without losing the single-file ethos

Split the monolithic `index.html` into:

```
/index.html                   ← shell + content
/styles.css                   ← all CSS
/src/core/effect.js           ← base Effect class
/src/core/registry.js         ← effect map + lazy init + topbar
/src/effects/001-fire.js
/src/effects/002-boids.js
…
/src/effects/030-tunnel.js
/build/index.html             ← optional: single-file output for archival
```

- Keep an `npm run build` (e.g. `esbuild`) that re-inlines everything into one
  HTML file for purists / for `view-source`-as-tutorial fans. Ship **both**.
- This is the prerequisite for: code-view modal (§5.1), per-effect GitHub
  links, easier contribution.

### 4.2 Routing + anchors

- Hash-based routing: `#001`, `#fire`, `#001-fire` all resolve.
- Updating the URL as you scroll past specimens (replaceState, throttled).
- Back/forward respects scroll position.

### 4.3 Tag system

Add quiet tag chips below each title (`physics`, `cellular`, `procedural`,
`fluid`, `fractal`, `GPU`, `3D`, `interactive`, `playable`). Used by:
filter UI (§5.3), "related effects" (§5.5), tag pages (§7.3).

### 4.4 Settings drawer

A small `⚙` button in the topbar opens a side drawer:

- Reduce motion (toggle)
- Theme (dark / phosphor green / blueprint / light)
- Performance (auto / high / battery saver)
- Audio (off / ambient / per-effect — see §6.5)
- Show source code by default (toggle)

Persist via `localStorage`.

---

## 5. Major site features

### 5.1 Source-code viewer (high impact)

The site's whole pitch is **"this is ≈ 20 lines"** — but the lines are
invisible. Add a "View source" toggle per specimen that slides up a panel
with:

- Syntax-highlighted JS for *this specimen only* (prism.js or shiki, pre-built).
- The exact `Effect` subclass and nothing else (i.e. the "20 lines" actually
  visible).
- A "Copy" button + a "Open on GitHub" link to the file in `/src/effects/`.

This is the single most pedagogically valuable feature we can add.

### 5.2 Per-specimen pages (optional, additive)

For each specimen, a dedicated route `/001-fire/` that includes:

- The canvas (larger, can go fullscreen).
- Expanded prose: history, original paper, where it shipped (Doom, F-Zero, …).
- Source code (§5.1).
- "Try this": parameter sliders (palette index, cooling rate, etc.).
- "Related": linked specimens via tag intersection.
- "Read more": curated external links (Wikipedia, Shadertoy, Bartosz Ciechanowski,
  Iñigo Quílez, etc.).

Keep the single-page anthology as the front door; per-specimen pages are
for going deep.

### 5.3 Search + filter

A `/` keyboard shortcut opens a command palette (cmd-k style):

- Fuzzy search by title, tag, year, author.
- Filter chips: "interactive only", "playable", "GPU", "≤ 30 lines".
- Sort: chronological (default), alphabetical, by complexity.

### 5.4 Index / TOC

A `≡` button reveals a slide-in TOC: all 30 specimens listed by number,
title, year. Click to jump. Becomes essential once we cross ~50 specimens.

### 5.5 Cross-references

At the bottom of each specimen, three "If you liked this, look at" links
chosen by tag overlap (e.g. fluid → fluid-GL → curl noise → smoke).

### 5.6 Fullscreen mode

Per-canvas fullscreen button (top-right of the canvas-overlay). Especially
valuable for fluid, tunnel, ray-marching, voxel space — the "wallpaper"-tier
effects.

### 5.7 Permalink + share

A `↗` button on each specimen copies a clean URL to clipboard. Combined with
QW-02, sharing a specimen on Twitter/Bluesky should produce a thumbnail.

### 5.8 Random specimen

A `🎲` button on the topbar. Scrolls to a random specimen with a smooth
transition. Surfaces less-clicked entries.

---

## 6. More interactive games

You specifically asked for this. Below are concepts that *extend existing
specimens into actual games* — they reuse the engines you've already built.

### 6.1 Wolfen-something (specimen #025: ray-casting)

Promote the ray-cast demo from "click to swap map" to a tiny dungeon crawler:

- WASD + mouse to look.
- Pickups (keys, ammo) drawn as billboards.
- Three enemy sprites with hit-points.
- A minimap in the corner using specimen #007 spatial hash for AI.
- Goal: find the exit. Time-attack mode.
- ~300 extra lines, no new tech — uses fragmenting of existing systems.

### 6.2 Glider Garden (specimen #012: Life)

A puzzle game on top of Conway's Life:

- Five preset starting boards.
- Goal: paint cells (limited budget) so the system evolves into a target
  pattern within N generations.
- Pre-built level packs (5–10 puzzles, escalating difficulty).
- Share level codes (URL-encoded board state).

### 6.3 Flowfield Drift (specimen #004: Perlin flow)

A racing/drift game:

- Player steers a particle through a procedural flow field.
- Field gradient pushes you off-course; you fight it.
- Checkpoints, lap timer, leaderboard via local storage.
- One-button control (only steering; flow does the speed).

### 6.4 Slime Maze (specimen #021: slime mold)

- A maze procedurally generated.
- Player drops "food" pheromones; the colony solves the maze.
- Goal: solve N mazes with the fewest food drops.
- Educational angle: real *Physarum polycephalum* solves mazes this way
  (link to the 2010 Tokyo subway paper).

### 6.5 Rope Trick (specimen #003: Verlet)

A physics puzzler:

- Click to pin/unpin rope endpoints.
- Place balls + ramps; goal is to fling balls into a target.
- Like the old PC game *The Incredible Machine*, in 20 lines of Verlet.

### 6.6 Painter (specimen #024: dither)

A drawing toy that's almost a game:

- Pick a palette (CGA, Game Boy, Macintosh, custom 4-color).
- Draw with the cursor; the canvas Floyd-Steinberg dithers continuously.
- Export as PNG.
- Daily prompt ("draw a tree") → community gallery (§7.5).

### 6.7 Identify the Trick (meta-game)

A quiz game using all 30 specimens:

- 8-second clip of a specimen plays.
- Four multiple-choice answers (titles).
- Score, streaks, hard mode (no title hint).
- Result is shareable: "I scored 24/30 on Field Guide quiz".

### 6.8 Shader of the Day (community)

A small text box where users paste a GLSL fragment shader, it renders
live. Curated daily shader picks featured on the front page.

### 6.9 Smaller "toys" (not games, but interactive enough)

- **L-system gardener**: build your own rule, watch it grow.
- **Reaction-diffusion canvas** that paints with chemistry.
- **Voronoi tiler**: drop points, generate a wallpaper, download SVG.
- **Mandelbrot deep-zoom** with shareable coords (`?re=-0.7&im=0.27015&zoom=1e6`).
- **Phyllotaxis flower designer** with parameter sliders.

---

## 7. New specimens to add

Targets to grow the gallery from 30 → ~60 over time, organized by theme.

### 7.1 Geometry & computational

- **Marching cubes** (3D companion to marching squares #022).
- **Delaunay triangulation** (companion to Voronoi #023).
- **Poisson disk sampling** vs random vs grid (side-by-side).
- **k-d tree visualizer** (querying nearest neighbors).
- **Convex hull** (Graham scan or Quickhull, animated).
- **Bezier + Catmull-Rom curves** (drag the control points).
- **Inverse kinematics** (CCD or FABRIK on a tentacle).

### 7.2 Rendering

- **Ray marching** (signed distance fields in 3D, a small primitive scene).
- **Halftone / cross-hatching / stippling** (NPR rendering).
- **Texture filtering compared**: nearest / bilinear / trilinear.
- **CRT post-effect** (curvature, scanlines, glow).
- **Chromatic aberration / lens distortion**.
- **Volumetric fog / god rays**.
- **Subsurface scattering toy** (in 2D).

### 7.3 Procedural

- **Maze generation comparison**: recursive backtracker, Wilson's, Eller's,
  Kruskal's. Side by side, each ~30 lines.
- **City-grid generator** (L-system or BSP).
- **Star/planet generator** (procedural orbits + noise textures).
- **Procedural sound visualization** (FFT of a sine sweep or microphone).

### 7.4 Promote "See Also" cards to live

The current "tricks you can feel but not see" section is great prose, but
several entries can become interactive demos:

- **Fast inverse sqrt** — show side-by-side numerical accuracy vs `Math.sqrt`,
  with a histogram of error.
- **Quaternions** — drag a 3D cube around with quaternion rotation, show
  Euler-angle gimbal lock toggling on.
- **Bilinear filtering** — image with toggle between nearest / bilinear /
  bicubic.
- **Bresenham line** — draw lines on a tiny grid, show pixel choices live.
- **Premultiplied alpha** — same image with/without, zoom in on the halo.
- **Schlick Fresnel** — angle slider; compare against the real Fresnel.

### 7.5 Cellular / agent-based

- **Brian's Brain** (3-state cellular automaton).
- **Wireworld** (Langton-adjacent, with logic gates).
- **Forest fire** (probabilistic CA).
- **Predator-prey grid** (Lotka-Volterra on a lattice).

### 7.6 Misc / fun

- **Sorting algorithms visualized** (bubble, quick, merge, radix, heap).
- **PRNGs compared** (LCG vs Xorshift vs Mersenne; bit-pattern visualization).
- **Spring-mass cloth** in 2D.
- **Soft body** (pressure-driven blob).
- **Gravity wells** (n-body sandbox).

### 7.7 GPU / WebGL track (raises the ceiling)

Currently only fluid-GL uses WebGL. Adding a few more would showcase the
"≈ 50 lines of GLSL" angle:

- **Domain-warped noise** in a fragment shader.
- **Raymarched SDF garden** (Iñigo Quílez-style).
- **Reaction-diffusion on GPU** (faster, prettier than #014).
- **Particle system on GPU** (millions of points).
- **Bloom / post-processing pipeline** demo.

---

## 8. Visual polish

The current design is excellent. Suggestions are tactical refinements, not
overhauls.

- **Hero intro section.** Currently the page jumps straight into specimen #001.
  A short hero (just two lines + the topbar flame at large scale) gives the
  site a "cover" — like the field-guide metaphor implies.
- **Loading skeletons.** Before a canvas mounts, show a faint grid pattern
  rather than a black box. Improves perceived performance.
- **Scroll-driven number ticker.** The topbar specimen number could
  *animate* on change (counter flip, the kind you see on physical odometers).
- **Subtle transitions between specimens.** A 0.3s opacity fade on a canvas
  when its specimen comes into the trigger band — feels filmic.
- **Accent rotation.** The accent is uniformly `#ff7e3d`. Consider letting
  each specimen's title-em color shift slightly (within the orange family)
  by year — earliest = warm amber, recent = cool orange. Quiet but charming.
- **Custom cursor variants.** Some specimens already imply different cursors
  (fluid wants a paintbrush, raycast wants crosshairs). Define 3–4
  `cursor` styles and apply by tag.
- **Print stylesheet.** A "view as book" print mode — the site is *literally* a
  field guide, lean into that. PDF-printable should look beautiful.
- **Mobile gestures.** Currently mouse-centric. Add explicit touch handlers for
  the drag-driven specimens (fluid, slime, marching squares).

---

## 9. Beyond a GitHub page

You noted "right now it's just a GitHub page." Here's what "more than that"
could mean — pick what aligns with your goals:

### 9.1 Identity / surface

- **Custom domain.** `fieldguide.graphics` or `graphics-tricks.dev`. Cheap,
  professional, and decouples from `pbnewman.github.io` if you move.
- **Logo and wordmark.** The fire icon already works as a mark; extract it.
- **Open Graph cover** (QW-02): a curated still of the tunnel or fluid,
  with the title typeset over it.

### 9.2 Content cadence

- **Essays / blog.** Long-form pieces ("Why fire works", "What Stam got
  right about fluids", "The 30-year shadow of Mode 7"). Even one post per
  month would compound discoverability.
- **Newsletter.** Buttondown or Substack — one essay or one new specimen per
  month. Low maintenance, high retention.
- **Annual "Atlas" PDF.** Once a year, compile the year's additions into a
  printable PDF / zine. Limited-run physical zines could be a delight.

### 9.3 Discoverability

- **Open Graph + Twitter Cards** (QW-02).
- **JSON-LD structured data** (`CreativeWork` per specimen).
- **RSS feed** (QW-09).
- **Sitemap.xml** (QW-09).
- **Submit to Awesome lists**: awesome-canvas, awesome-creative-coding,
  awesome-shaders.
- **Hacker News + Lobsters** submission (one specimen at a time, every few
  months — the "≈ 20 lines" angle is HN catnip).

### 9.4 Embeds / integrations

- **`<iframe>` embed widgets.** A clean iframe per specimen lets bloggers
  embed the live demo directly in their articles. Drives backlinks.
- **JSON API.** `/api/specimens.json` exposing the metadata catalog (number,
  title, year, tags, thumbnail URL). Other people can build with it.
- **OEmbed support** for Notion / Obsidian / Discord embedding.

### 9.5 Community

- **GitHub Discussions** enabled — one thread per specimen for Q&A.
- **Utterances or giscus** comments under each specimen (GitHub-backed,
  no server, no spam).
- **Contributor guide** for adding new specimens (`CONTRIBUTING.md`):
  template effect class, naming convention, accessibility checklist.
- **Specimen submissions via PR**: lower the bar to "add a new tile."
- **Credits page** for community contributors.

### 9.6 Operations

- **Analytics** (Plausible or Umami — privacy-respecting, GDPR-OK; not GA).
- **Sentry or simple console-error reporting** for canvas errors in the wild.
- **PWA manifest** so the site is installable offline (the whole thing is
  ~220 KB, perfect for a service worker cache).
- **Continuous deploy** on push to main via GitHub Actions (already happens
  with Pages, but a CI run for HTML validation, broken-link check, and
  Lighthouse score would catch regressions).

---

## 10. Engineering & performance

- **TypeScript** for the effects (with `.ts` source, compiled to a single
  `.js` bundle). Catches bugs, makes the registry safer.
- **Per-effect performance budget.** Measure FPS in CI on a low-end target;
  fail if any specimen drops below 30 fps on a 2018 mid-tier laptop.
- **OffscreenCanvas** + **Web Workers** for the heaviest sims (LBM, reaction,
  fluid). Frees the main thread.
- **WASM** for the inner loops of fluid and reaction-diffusion. Could 5×
  the resolution on those.
- **Quality presets** that downgrade resolution on weak GPUs (especially
  fluid-GL).
- **Image decode budget**: lazy-load the GitHub avatar with `decoding="async"`.
- **Lighthouse target**: 100/100/100/100. The site is small enough that this
  is achievable.

---

## 11. Accessibility & inclusivity

- **`prefers-reduced-motion`** → static last-frame fallback.
- **`prefers-color-scheme: light`** → a light theme variant (warm parchment
  feels right for "field guide").
- **High contrast mode.**
- **Keyboard-only navigation** for everything mouse-driven (esp. raycast WASD
  is already keyboard, but click-to-do-things should have key alternatives).
- **Screen-reader text** for each canvas: a sentence describing what's
  happening visually, in addition to the existing prose description.
- **Focus rings** that match the accent.
- **Skip-to-content link** for keyboard users.
- **Color-blind-safe palette toggle** (some specimens use hue heavily —
  reaction-diffusion, flow field).

---

## 12. Suggested phased roadmap

A pragmatic ordering — each phase ships something user-visible and unblocks
the next.

### Phase 1 — Polish & foundations (1–2 weekends)

Goal: bring the existing site to "fully polished" without changing its shape.

- Quick wins QW-01 through QW-13.
- `prefers-reduced-motion`, basic a11y pass.
- Open Graph cover, favicon, sitemap, RSS.
- Anchor links + URL updates on scroll.
- Keyboard nav (`j`/`k`/`space`/`/`).

**Outcome:** a polished, shareable, accessible, indexable site that still
fits in one HTML file.

### Phase 2 — Modularize + source view (1 weekend)

Goal: unlock everything downstream.

- §4.1: split into `src/effects/*.js`, optional build → single-file output.
- §5.1: source-code viewer per specimen.
- §4.3: tag system + chips on specimens.

**Outcome:** the pedagogical heart of the project becomes legible. People
can read the "20 lines" they're being told about.

### Phase 3 — Search, TOC, settings (1 weekend)

- §4.4: settings drawer (theme, motion, audio, performance).
- §5.3: command palette / fuzzy search.
- §5.4: TOC drawer.
- §5.5: related specimens.
- §5.6: fullscreen mode.
- §5.8: random specimen.

**Outcome:** site feels like a *product*, not just a page.

### Phase 4 — Per-specimen pages + community (1–2 weekends)

- §5.2: per-specimen deep pages.
- §9.5: GitHub Discussions + giscus comments.
- §9.5: `CONTRIBUTING.md` + effect template.
- §9.4: iframe embeds + `specimens.json`.

**Outcome:** the site is a *platform* others can build on and contribute to.

### Phase 5 — Games & new specimens (rolling)

Ship one of the games (§6) every 2–4 weeks, one new specimen (§7) every
1–2 weeks. The point is *cadence*, not volume.

Suggested order, based on highest delight-per-effort:

1. Game: **Glider Garden** (§6.2) — easiest, uses existing Life engine.
2. New specimen: **Maze generation comparison** (§7.3).
3. Game: **Painter** (§6.6) — pleasant, shareable PNGs.
4. New specimen: **Marching cubes** (§7.1).
5. Game: **Identify the Trick** quiz (§6.7).
6. Promote "See Also" cards one at a time (§7.4).
7. Game: **Wolfen-something** (§6.1) — biggest win, most work.
8. Continue rolling new specimens.

### Phase 6 — Long form & identity (ongoing)

- §9.1: custom domain.
- §9.2: first essay shipped; newsletter live.
- §9.3: HN/Lobsters submission cadence.
- §9.6: PWA + analytics.

**Outcome:** the site is *a body of work*, not a single file.

---

## 13. Things to deliberately *not* do

A short anti-list. These are temptations worth resisting:

- **No JS framework.** React/Vue/Svelte solve problems this site doesn't have.
- **No analytics-heavy SDKs.** A privacy-respecting page-counter is fine;
  Segment + Heap + GA is not.
- **No dark patterns.** No "subscribe" modals, no exit-intent popups, no
  cookie banners (don't set tracking cookies in the first place).
- **No autoplaying audio** (even ambient — opt in only).
- **No "powered by" badges** for third-party services.
- **No infinite scroll.** The gallery has a beginning and an end on purpose.
- **No AI-generated specimen art or copy** in the gallery itself. The
  premise is *human-written algorithms in <100 lines*. Keep it pure.
- **No paywalls / no "premium tier."** If monetized at all, a Ko-fi link
  in the footer; nothing else.

---

## 14. Open questions for the author

Decisions only you can make:

1. **Tone of voice for games**: do they share the editorial register of the
   gallery, or are they allowed to be a bit more playful?
2. **Domain**: custom domain yes/no? If yes, suggested names:
   `fieldguide.graphics`, `graphicstricks.dev`, `tricksof.graphics`.
3. **License**: MIT? CC-BY-4.0? CC-BY-SA? Public domain via CC0?
4. **Newsletter cadence**: monthly / quarterly / "when there's something to say"?
5. **Build step**: are you OK with `npm run build`, or must the source remain
   "open `index.html` and read"?
6. **Comments**: GitHub Discussions only, or giscus on every specimen page?
7. **Mobile-first vs desktop-first**: current design is desktop-tilted. Do
   we want a true mobile-first redesign at some point?
8. **TypeScript**: yes/no? It buys correctness at the cost of friction for
   casual readers.
9. **Specimen ceiling**: target 60? 100? 200? Or no ceiling, indefinite growth?
10. **Cover image / hero**: should the site have a "cover" before specimen #001,
    or keep the current jump-straight-in feel?

---

*Last updated: 2026-05-13*
