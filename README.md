# Graphics Anthology

A field guide to 30 interactive graphics experiments, hosted with GitHub Pages.
The site uses native browser APIs and has no build step or third-party runtime dependencies.

## Local preview

Serve this directory over HTTP (ES modules require a server):

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000`.

## Explore and play

- Four chapters organize the original experiments. **Explore** opens a searchable visual index, with category and saved-item filters.
- **Surprise me** jumps to another experiment. Each experiment has a stable link such as `#reaction`.
- **Pause**, **Step**, and **Reset** are available on every experiment. Reset restarts with the same seed and controls; “New field” and similar actions choose a fresh seed.
- Named presets and focused controls expose palettes, patterns, wind, flock size, spacing, field detail, and the phyllotaxis angle. Every experiment also has a speed control.
- **Expand** opens a focused view. **Save image** downloads the current artwork as a PNG with a small title credit.
- **Copy link** includes the starting seed and exposed controls. Links reproduce the starting configuration, not elapsed simulation time or pointer strokes. Results can vary with canvas dimensions and GPU implementation.
- Stars save favorites on the current device. Favorites and the global motion preference use local storage, with a session-only fallback if storage is unavailable.
- **How it works** reveals the algorithm's steps, the original field notes, and a small challenge.

## Input and motion

Mouse and pen input work on the canvases. On touch devices, **Touch to play** enables free dragging; **Done playing** restores page scrolling across the canvas. Expanded experiments enable dragging directly.

Focus a canvas with Tab. Arrow keys move its virtual pointer, Enter performs its primary action, Space toggles playback, and Escape releases pointer control. Ray casting supports WASD and arrows while its canvas is focused, plus on-screen driving controls. All toolbar controls are keyboard accessible. Native dialogs contain focus and close with Escape.

The system reduced-motion preference pauses autoplay on the first visit. **Play all** or an individual Play button allows explicit opt-in. A single bounded animation clock pauses offscreen experiments and hidden tabs. Renderer instances are initialized on demand.

## Files

- `index.html`: semantic content, chapters, and dialog shells.
- `gallery.css`: visual system, responsive layout, and interaction states.
- `catalog.js`: chapter membership, hints, challenges, and control definitions.
- `effects.js`: the original 30 simulation renderers, with seeded randomness and a shared lifecycle.
- `gallery.js`: input, lazy rendering, controls, navigation, collection, dialogs, and image export.
- `state.js`: validation and serialization of shareable controls.
- `previews/`: static thumbnails rendered from the actual experiments. Opening the collection does not start 30 live simulations.
- `tools/render-previews.mjs`: regenerates `previews/` from the live experiments with a fixed seed. It needs Playwright, which is not a site dependency: `npm install --no-save playwright && node tools/render-previews.mjs` (pass experiment ids to render only those).

## Checks

```sh
node --test tests/state.test.mjs
node --check gallery.js
node --check effects.js
```

The tests cover complete chapter membership, all experiment link round trips, invalid URL inputs, independent seeded random streams, and a preview image for every experiment. Before publishing UI changes, check the gallery on narrow and wide viewports, keyboard navigation, reduced motion, touch dragging, expanded-view restoration, and PNG export (including GPU fluid).
