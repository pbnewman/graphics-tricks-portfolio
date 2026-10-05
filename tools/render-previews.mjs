// Renders previews/<id>.webp for the collection index from the live experiments.
// Requires Playwright (not a site dependency):
//   npm install --no-save playwright && node tools/render-previews.mjs [id ...]
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { CATALOG } from '../catalog.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'previews');
const WIDTH = 640, HEIGHT = 400, QUALITY = 0.82, SEED = 20240611;
// Experiments that only come alive with input get a scripted pointer path.
const STIR = new Set(['fluid', 'fluidgl', 'rope', 'sdf', 'curl', 'lbm', 'spring', 'hash', 'boids']);
// Slow growers need longer before their structure is recognizable.
const SETTLE = { dla: 25000, wfc: 20000 };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.svg': 'image/svg+xml' };

const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  try {
    const body = await readFile(join(root, path.endsWith('/') ? `${path}index.html` : path));
    res.writeHead(200, { 'content-type': TYPES[extname(path) || '.html'] || 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/`;

const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(CATALOG);
const unknown = ids.filter(id => !Object.hasOwn(CATALOG, id));
if (unknown.length) throw new Error(`Unknown experiment: ${unknown.join(', ')}`);

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'no-preference' });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await mkdir(outDir, { recursive: true });

async function capture(id) {
  await page.goto('about:blank');
  await page.goto(`${base}#${id}?seed=${SEED}`);
  await page.addStyleTag({ content: '.canvas-overlay, .interaction-cue { visibility: hidden !important; }' });
  const canvas = page.locator(`article[data-specimen="${id}"] canvas`);
  // Experiments start lazily once visible; keep the canvas in view until it reports ready.
  await page.waitForFunction(i => {
    const el = document.querySelector(`article[data-specimen="${i}"] canvas`);
    if (el?.dataset.ready === 'true') return true;
    el?.scrollIntoView({ block: 'center' });
    return false;
  }, id, { timeout: 60000, polling: 250 });
  if (STIR.has(id)) {
    const box = await canvas.boundingBox();
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.5);
    await page.mouse.down();
    for (let t = 0; t <= 1; t += 1 / 60) {
      await page.mouse.move(box.x + box.width * (0.5 + 0.3 * Math.cos(t * 2 * Math.PI)), box.y + box.height * (0.5 + 0.3 * Math.sin(t * 2 * Math.PI)));
      await page.waitForTimeout(16);
    }
    await page.mouse.up();
    await page.mouse.move(0, 0);
    // Pointer input focuses the canvas; drop its focus ring before capture.
    await page.evaluate(() => document.activeElement?.blur());
  }
  await page.waitForTimeout(SETTLE[id] ?? 3000);
  if (await page.locator(`article[data-specimen="${id}"] .render-error`).count()) errors.push('render-error shown');
  const png = (await canvas.screenshot()).toString('base64');
  // Center-crop to the card's 8:5 frame and encode as WebP in the browser.
  const dataUrl = await page.evaluate(async ({ png, WIDTH, HEIGHT, QUALITY }) => {
    const img = new Image(); img.src = `data:image/png;base64,${png}`; await img.decode();
    const scale = Math.max(WIDTH / img.width, HEIGHT / img.height);
    const sw = WIDTH / scale, sh = HEIGHT / scale;
    const out = document.createElement('canvas'); out.width = WIDTH; out.height = HEIGHT;
    const ctx = out.getContext('2d'); ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, WIDTH, HEIGHT);
    return out.toDataURL('image/webp', QUALITY);
  }, { png, WIDTH, HEIGHT, QUALITY });
  if (!dataUrl.startsWith('data:image/webp')) throw new Error('This browser cannot encode WebP');
  if (errors.length) throw new Error(errors.join('; '));
  const bytes = Buffer.from(dataUrl.split(',')[1], 'base64');
  await writeFile(join(outDir, `${id}.webp`), bytes);
  return bytes.length;
}

// A failed experiment keeps its previous preview; the run continues and exits non-zero.
let failed = 0;
for (const id of ids) {
  errors.length = 0;
  try { console.log(`✓ ${id} (${((await capture(id)) / 1024).toFixed(1)} KB)`); }
  catch (error) { failed++; console.error(`✗ ${id}: ${error.message.split('\n')[0]}`); }
}

await browser.close();
server.close();
process.exitCode = failed ? 1 : 0;
