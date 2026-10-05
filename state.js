import { CATALOG, SPEED } from './catalog.js';

export function controlsFor(id) {
  return [...(CATALOG[id]?.controls || []), SPEED];
}

export function validateSettings(id, supplied = {}) {
  const settings = {};
  for (const control of controlsFor(id)) {
    const raw = supplied[control.key];
    const number = raw === '' || raw == null ? NaN : Number(raw);
    if (!Number.isFinite(number)) settings[control.key] = control.value;
    else if (control.labels) settings[control.key] = Math.min(control.labels.length - 1, Math.max(0, Math.round(number)));
    else {
      const bounded = Math.min(control.max, Math.max(control.min, number));
      // Integer-valued simulation inputs (array sizes and pixel offsets) must stay integral.
      settings[control.key] = control.step >= 1 ? Math.round(bounded) : bounded;
    }
  }
  return settings;
}

export function parseExperimentHash(hash) {
  if (!hash || hash.length > 2048) return null;
  const [id, query = ''] = hash.replace(/^#/, '').split('?');
  if (!Object.hasOwn(CATALOG, id)) return null;
  const params = new URLSearchParams(query);
  const seedValue = params.get('seed');
  const seed = seedValue !== null && /^\d{1,10}$/.test(seedValue) && Number(seedValue) <= 4294967295 ? Number(seedValue) : null;
  return { id, seed, settings: validateSettings(id, Object.fromEntries(params)) };
}

export function experimentHash(id, seed, settings) {
  if (!Object.hasOwn(CATALOG, id)) throw new Error('Unknown experiment');
  const params = new URLSearchParams({ seed: String(seed >>> 0) });
  for (const [key, value] of Object.entries(validateSettings(id, settings))) params.set(key, String(value));
  return `#${id}?${params}`;
}
