import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { CHAPTERS, CATALOG } from '../catalog.js';
import { REGISTRY, makeRandom } from '../effects.js';
import { validateSettings, parseExperimentHash, experimentHash, controlsFor } from '../state.js';

test('every original experiment appears in exactly one chapter with a renderer', () => {
  const ids = CHAPTERS.flatMap(c => c.effects);
  assert.equal(ids.length, 30);
  assert.equal(new Set(ids).size, 30);
  assert.deepEqual([...ids].sort(), Object.keys(REGISTRY).sort());
  assert.deepEqual([...ids].sort(), Object.keys(CATALOG).sort());
});

test('share links restore the seed and every exposed control for all experiments', () => {
  for (const id of Object.keys(CATALOG)) {
    const supplied = Object.fromEntries(controlsFor(id).map(c => [c.key, c.labels ? c.labels.length - 1 : c.max]));
    const decoded = parseExperimentHash(experimentHash(id, 4294967295, supplied));
    assert.equal(decoded.id, id);
    assert.equal(decoded.seed, 4294967295);
    assert.deepEqual(decoded.settings, validateSettings(id, supplied));
  }
});

test('untrusted URL controls are finite, bounded, and allowlisted', () => {
  assert.deepEqual(validateSettings('boids', { count: 'Infinity', separation: '-999', speed: '999', secret: 'ignored' }), { count: 140, separation: 8, speed: 2 });
  assert.equal(validateSettings('reaction', { preset: 999 }).preset, 4);
  assert.equal(validateSettings('reaction', { preset: 2.8 }).preset, 3);
  assert.equal(validateSettings('fire', { wind: '' }).wind, 0);
  assert.equal(validateSettings('fire', { wind: '.8' }).wind, 1);
  assert.equal(validateSettings('boids', { count: '141.9' }).count, 142);
});

test('malformed and unrelated hashes do not become experiments', () => {
  for (const hash of ['', '#chapter-nature', '#__proto__', '#constructor', '#' + 'x'.repeat(3000)]) assert.equal(parseExperimentHash(hash), null);
  for (const seed of ['-1', 'NaN', 'Infinity', '4294967296', '1.5']) assert.equal(parseExperimentHash(`#fire?seed=${seed}`).seed, null);
  assert.equal(parseExperimentHash('#fire?seed=0').seed, 0);
});

test('equal seeds give independent, repeatable random streams', () => {
  const a = makeRandom(42), b = makeRandom(42), c = makeRandom(43);
  const first = Array.from({ length: 200 }, a);
  assert.deepEqual(first, Array.from({ length: 200 }, b));
  assert.notDeepEqual(first, Array.from({ length: 200 }, c));
  assert.ok(first.every(n => n >= 0 && n < 1));
});

test('every experiment has a collection preview image', () => {
  const missing = Object.keys(CATALOG).filter(id => !existsSync(new URL(`../previews/${id}.webp`, import.meta.url)));
  assert.deepEqual(missing, [], 'Run tools/render-previews.mjs to render missing previews');
});
