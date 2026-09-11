import { REGISTRY } from './effects.js';
import { CATALOG, CHAPTERS } from './catalog.js';
import { controlsFor, validateSettings, parseExperimentHash, experimentHash } from './state.js';

const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
const newSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];
const getPreference = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
const setPreference = (key, value) => { try { localStorage.setItem(key, value); } catch { /* Session controls still work without storage. */ } };
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let motionPreference = getPreference('anthology-motion');
let allPaused = motionPreference ? motionPreference === 'paused' : reducedMotion.matches;
let favorites = new Set();
try { const saved = JSON.parse(getPreference('anthology-favorites') || '[]'); if (Array.isArray(saved)) favorites = new Set(saved.filter(id => Object.hasOwn(CATALOG, id))); } catch { /* Ignore stale preferences. */ }
const collection = $('#explore-dialog');
const studio = $('#studio-dialog');
let activeStudio = null;
let studioAnchor = null;
let studioOpener = null;
let filter = 'all';
let toastTimer;
let raf = 0;
let previousTime = null;

const paths = {
  pause: '<path d="M8 5v14M16 5v14"/>',
  play: '<path d="m8 5 11 7-11 7Z"/>',
  step: '<path d="m5 5 10 7-10 7ZM19 5v14"/>',
  reset: '<path d="M3 11a9 9 0 1 1 2 7M3 4v7h7"/>',
  expand: '<path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"/>',
  save: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  share: '<path d="m10 13 4-4m-6 7-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m4 0 2-2a4 4 0 1 1 6 6l-4 4a4 4 0 0 1-6 0" transform="translate(1 -1) scale(.95)"/>',
  favorite: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',
};
function icon(name) { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.play}</svg>`; }
function tool(action, label, title = label) {
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'tool-button'; button.dataset.action = action;
  button.title = title; button.setAttribute('aria-label', title);
  button.innerHTML = `${icon(action)}<span class="tool-label">${label}</span>`;
  return button;
}
function toast(message) {
  const box = $('.toast'); box.textContent = message; box.classList.add('is-visible');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => box.classList.remove('is-visible'), 3500);
}
function formatValue(control, value) {
  if (control.labels) return control.labels[value];
  const digits = control.step < .001 ? 4 : control.step < .1 ? 2 : control.step < 1 ? 2 : 0;
  return `${Number(value.toFixed(digits))}${control.unit || ''}`;
}

const records = $$('[data-specimen]').map(article => {
  const id = article.dataset.specimen;
  const chapter = CHAPTERS.find(c => c.effects.includes(id));
  return { id, article, chapter, meta: CATALOG[id], title: $('.specimen-title', article).textContent.trim(),
    number: $('.specimen-num', article).textContent.trim(), canvas: $('canvas', article), stage: $('.experiment-stage', article),
    settings: validateSettings(id), seed: newSeed(), instance: null, visible: false, paused: allPaused,
    accumulator: 0, pointerId: null, pointerOrigin: null, dragged: false, controls: new Map(), failed: false };
});
const byId = new Map(records.map(r => [r.id, r]));

function draw(record) { record.instance?.render(); }
function createInstance(record) {
  if (record.instance || record.failed) return record.instance;
  try {
    record.instance = new REGISTRY[record.id](record.canvas, { seed: record.seed, settings: record.settings });
    // A few initial frames give paused experiments a useful, static first view.
    const frames = ({ fire: 65, flow: 50, reaction: 24, attractor: 35, lsystem: 70, phyllotaxis: 140, dla: 6, langton: 20, fluidgl: 2, lbm: 1 })[record.id] || 1;
    for (let i = 0; i < frames; i++) record.instance.frame();
    record.instance.pmx = record.instance.mx;
    record.instance.pmy = record.instance.my;
    record.canvas.dataset.ready = 'true';
    return record.instance;
  } catch (error) {
    console.error(`Unable to start ${record.id}:`, error);
    record.instance?.destroy(); record.instance = null; record.failed = true;
    const message = document.createElement('div'); message.className = 'render-error'; message.setAttribute('role', 'status');
    message.textContent = record.id === 'fluidgl' ? 'This device cannot run GPU fluid. You can still paint with the classic fluid experiment.' : 'This experiment could not start. Try resetting it or choose another from the collection.';
    if (record.id === 'fluidgl') { const link = document.createElement('a'); link.href = '#fluid'; link.textContent = 'Open Stable fluids'; message.append(link); }
    $('.canvas-frame', record.stage).append(message);
    record.paused = true;
    updateStatus(record);
    return null;
  }
}

function resetRecord(record, { reseed = false } = {}) {
  record.instance?.destroy(); record.instance = null; record.failed = false;
  if (reseed) record.seed = newSeed();
  $('.render-error', record.stage)?.remove();
  // A new canvas also releases a WebGL context and all old pointer listeners.
  const replacement = record.canvas.cloneNode(false);
  replacement.removeAttribute('width'); replacement.removeAttribute('height'); replacement.removeAttribute('data-ready');
  record.canvas.replaceWith(replacement); record.canvas = replacement;
  record.pointerId = null; record.pointerOrigin = null;
  record.accumulator = 0;
  bindCanvas(record);
  if (record.visible || activeStudio === record) createInstance(record);
  updateSettings(record); updateStatus(record); wake();
}

function updateStatus(record) {
  record.article.classList.toggle('is-paused', record.paused);
  const button = $('[data-action="pause"]', record.stage);
  const label = record.paused ? 'Play' : 'Pause';
  button.innerHTML = `${icon(record.paused ? 'play' : 'pause')}<span class="tool-label">${label}</span>`;
  button.setAttribute('aria-label', `${label} ${record.title}`); button.title = `${label} ${record.title}`;
  button.setAttribute('aria-pressed', String(record.paused));
  $('.live', record.stage).textContent = record.failed ? 'Unavailable' : record.paused ? 'Paused' : 'Playing';
  for (const action of ['save', 'step', 'pause']) $(`[data-action="${action}"]`, record.stage).disabled = record.failed;
}

function updateSettings(record) {
  for (const [key, nodes] of record.controls) {
    const value = record.settings[key];
    if (nodes.input) nodes.input.value = String(value);
    if (nodes.output) nodes.output.textContent = formatValue(nodes.control, value);
    nodes.buttons?.forEach((b, index) => b.setAttribute('aria-pressed', String(value === index)));
  }
  if (record.id === 'boids') {
    // The original metadata contains a fixed agent count; the current value belongs in the control.
    const live = $('.live', record.stage); live.title = `${record.settings.count} agents`;
  }
}

function changeSetting(record, key, value) {
  record.settings = validateSettings(record.id, { ...record.settings, [key]: value });
  if (key === 'speed') { updateSettings(record); return; }
  resetRecord(record);
  record.article.classList.add('has-interacted');
}

function buildControls(record) {
  const toolbar = $('.experiment-tools', record.stage);
  for (const [action, label, title] of [
    ['pause','Pause',`Pause ${record.title}`], ['step','Step','Advance one simulation frame'],
    ['reset','Reset','Restart with the same seed and controls'], ['save','Save image','Save artwork as PNG'],
    ['share','Copy link','Copy link with starting seed and controls'], ['favorite','Save','Save to your collection'],
    ['expand','Expand',`Expand ${record.title}`],
  ]) {
    const button = tool(action,label,title); toolbar.append(button);
    button.addEventListener('click', () => handleAction(record, action, button));
  }
  const favorite = $('[data-action="favorite"]', record.stage);
  favorite.setAttribute('aria-pressed', String(favorites.has(record.id)));
  const settings = $('.experiment-settings', record.stage);
  for (const control of controlsFor(record.id)) {
    const wrapper = document.createElement('div'); wrapper.className = 'setting';
    const label = document.createElement('label'); label.className = 'setting-label';
    const labelText = document.createElement('span'); labelText.textContent = control.label; label.append(labelText);
    const inputId = `${record.id}-${control.key}`; label.htmlFor = inputId;
    const output = document.createElement('output'); output.htmlFor = inputId; output.textContent = formatValue(control, record.settings[control.key]);
    label.append(output); wrapper.append(label);
    const nodes = { control, output };
    if (record.id === 'fire' && control.labels) {
      label.removeAttribute('for');
      const swatches = document.createElement('div'); swatches.className = 'preset-swatches'; swatches.setAttribute('role','group'); swatches.setAttribute('aria-label','Fire palette');
      nodes.buttons = control.labels.map((name, index) => {
        const b = document.createElement('button'); b.type = 'button'; b.textContent = name;
        b.style.setProperty('--swatch', ['#ff965f','#87d8e1','#b2dc74','#e35b49'][index]);
        b.setAttribute('aria-pressed', String(index === record.settings.preset));
        b.addEventListener('click', () => changeSetting(record, control.key, index)); swatches.append(b); return b;
      });
      wrapper.append(swatches);
    } else {
      const input = document.createElement(control.labels ? 'select' : 'input'); input.id = inputId;
      if (control.labels) control.labels.forEach((text,index) => input.add(new Option(text,String(index))));
      else { input.type = 'range'; input.min = control.min; input.max = control.max; input.step = control.step; }
      input.value = record.settings[control.key]; nodes.input = input;
      input.addEventListener('input', () => { output.textContent = formatValue(control, Number(input.value)); });
      input.addEventListener('change', () => changeSetting(record, control.key, Number(input.value)));
      wrapper.append(input);
    }
    record.controls.set(control.key,nodes); settings.append(wrapper);
  }
  if (record.meta.action) {
    const action = document.createElement('button'); action.type = 'button'; action.className = 'tool-button effect-action'; action.textContent = record.meta.action;
    action.addEventListener('click', () => interact(record, record.instance?.w / 2, record.instance?.h / 2));
    settings.append(action);
  }
  // Touch visitors explicitly enter play mode so scrolling across a canvas remains natural.
  if (!['fire','flow','terrain','mode7','curl','life','reaction','attractor','dla','lsystem','phyllotaxis','wfc','plasma','langton'].includes(record.id)) {
    const play = document.createElement('button'); play.type = 'button'; play.className = 'tool-button touch-play'; play.textContent = 'Touch to play'; play.setAttribute('aria-pressed','false');
    play.addEventListener('click', () => {
      const enabled = $('.canvas-frame',record.stage).classList.toggle('is-interactive');
      play.textContent = enabled ? 'Done playing' : 'Touch to play'; play.setAttribute('aria-pressed',String(enabled));
      record.paused = enabled ? false : record.paused; updateStatus(record); wake();
      if (enabled) toast('Drag on the artwork. Tap “Done playing” to scroll across it again.');
    });
    settings.append(play);
  }
  if (record.id === 'raycast') buildDrivePad(record,settings);
  updateStatus(record);
}

function interact(record, x, y) {
  const inst = createInstance(record); if (!inst) return;
  record.article.classList.add('has-interacted');
  if (record.meta.reseed) { resetRecord(record,{reseed:true}); return; }
  if (record.id === 'phyllotaxis') {
    const choices = [137.5077,137.3,138,90];
    const next = (choices.findIndex(v=>Math.abs(v-record.settings.angle)<.001)+1)%choices.length;
    changeSetting(record,'angle',choices[next]); return;
  }
  inst.onClick?.(Number.isFinite(x)?x:inst.w/2, Number.isFinite(y)?y:inst.h/2);
  if (record.controls.has('preset')) {
    record.settings.preset = inst.presetIdx ?? inst.paletteIdx ?? inst.idx ?? inst.mapIdx ?? inst.pi ?? 0;
    updateSettings(record);
  }
  if (record.id === 'mandelbrot') {
    record.settings.real = inst.cReal; record.settings.imaginary = inst.cImag; updateSettings(record);
    toast(inst.frozen ? 'Julia set held. Tap again to explore.' : 'Julia set follows your pointer again.');
  }
  if (record.paused) inst.frame();
  wake();
}

function clearPointer(record) {
  const inst = record.instance;
  if (inst) { inst.mx = inst.my = inst.pmx = inst.pmy = null; inst.keys?.clear(); if (record.id === 'raycast') inst.manualMode = false; }
  record.pointerId = null;
}

function bindCanvas(record) {
  const canvas = record.canvas;
  canvas.setAttribute('aria-describedby', `keyboard-${record.id}`);
  if (!$(`#keyboard-${record.id}`,record.article)) {
    const help = document.createElement('p'); help.className='sr-only'; help.id=`keyboard-${record.id}`;
    help.textContent = 'Use arrow keys to move within the experiment, Enter to interact, and Space to pause or play. Tab moves to the controls. Escape releases the pointer.';
    record.article.append(help);
  }
  const move = (event) => {
    if (event.pointerType !== 'mouse' && record.pointerId !== event.pointerId) return;
    const inst = createInstance(record); if (!inst) return;
    const rect = canvas.getBoundingClientRect();
    inst.pmx = inst.mx; inst.pmy = inst.my;
    inst.mx = Math.max(0,Math.min(inst.w,event.clientX-rect.left)); inst.my = Math.max(0,Math.min(inst.h,event.clientY-rect.top));
    if (record.pointerOrigin && Math.hypot(event.clientX-record.pointerOrigin.x,event.clientY-record.pointerOrigin.y)>8) record.dragged=true;
    record.article.classList.add('has-interacted');
    if (record.paused) { inst.frame(); inst.pmx=inst.mx; inst.pmy=inst.my; }
  };
  canvas.addEventListener('pointerdown', event => {
    record.pointerOrigin={x:event.clientX,y:event.clientY}; record.dragged=false;
    record.pointerId=event.pointerId;
    if (event.pointerType==='mouse'||$('.canvas-frame',record.stage).classList.contains('is-interactive')) canvas.setPointerCapture(event.pointerId);
    canvas.focus({preventScroll:true}); move(event);
  });
  canvas.addEventListener('pointermove',move);
  canvas.addEventListener('pointerup', event => {
    if (record.pointerId!==event.pointerId) return;
    if (!record.dragged) { const rect=canvas.getBoundingClientRect(); interact(record,event.clientX-rect.left,event.clientY-rect.top); }
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    record.pointerId=null; record.pointerOrigin=null;
    if (event.pointerType!=='mouse') clearPointer(record);
  });
  canvas.addEventListener('pointercancel',()=>{ record.pointerOrigin=null; clearPointer(record); });
  canvas.addEventListener('pointerleave',()=>{ if(record.pointerId===null) clearPointer(record); });
  canvas.addEventListener('blur',()=>clearPointer(record));
  canvas.addEventListener('keydown',event=>{
    if (event.key===' '){ event.preventDefault(); handleAction(record,'pause'); return; }
    if (event.key==='Enter'){ event.preventDefault(); interact(record,record.instance?.mx,record.instance?.my); return; }
    if (event.key==='Escape'){ clearPointer(record); return; }
    const inst=createInstance(record); if(!inst) return;
    const key=event.key.toLowerCase();
    if (record.id==='raycast' && ['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)) {
      event.preventDefault(); inst.manualMode=true; inst.keys.add(key); if(record.paused) inst.frame(); return;
    }
    if (!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    inst.pmx=inst.mx??inst.w/2; inst.pmy=inst.my??inst.h/2;
    inst.mx=Math.max(0,Math.min(inst.w,inst.pmx+(event.key==='ArrowRight'?18:event.key==='ArrowLeft'?-18:0)));
    inst.my=Math.max(0,Math.min(inst.h,inst.pmy+(event.key==='ArrowDown'?18:event.key==='ArrowUp'?-18:0)));
    record.article.classList.add('has-interacted'); if(record.paused) inst.frame();
  });
  canvas.addEventListener('keyup',event=>record.instance?.keys?.delete(event.key.toLowerCase()));
}

function buildDrivePad(record,parent) {
  const pad=document.createElement('div'); pad.className='drive-pad'; pad.setAttribute('role','group'); pad.setAttribute('aria-label','Drive through the map');
  for(const [key,label,symbol] of [['a','Turn left','↶'],['w','Move forward','↑'],['s','Move backward','↓'],['d','Turn right','↷']]) {
    const b=document.createElement('button'); b.type='button'; b.textContent=symbol; b.setAttribute('aria-label',label);
    const press=()=>{const inst=createInstance(record); if(inst){inst.manualMode=true;inst.keys.add(key);if(record.paused)inst.frame();wake();}};
    const release=()=>record.instance?.keys.delete(key);
    b.addEventListener('pointerdown',e=>{e.preventDefault();b.focus({preventScroll:true});b.setPointerCapture(e.pointerId);press();});
    for(const event of ['pointerup','pointercancel','lostpointercapture','blur']) b.addEventListener(event,release);
    b.addEventListener('keydown',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();press();}});
    b.addEventListener('keyup',release);pad.append(b);
  }
  parent.append(pad);
}

function shouldRun(record) {
  return record.instance && !record.failed && !record.paused && !document.hidden && !collection.open &&
    (activeStudio ? activeStudio===record : record.visible);
}
function tick(time) {
  raf=0;
  const elapsed=previousTime===null?1000/60:Math.min(50,time-previousTime); previousTime=time;
  for(const record of records) {
    if(!shouldRun(record)){record.accumulator=0;continue;}
    record.accumulator+=elapsed*record.settings.speed;
    let steps=0;
    while(record.accumulator>=1000/60&&steps<3){
      try {
        record.instance.frame();record.accumulator-=1000/60;steps++;
        record.instance.pmx=record.instance.mx;record.instance.pmy=record.instance.my;
      } catch (error) {
        // One failed renderer must not stop the other experiments.
        console.error(`Animation failed for ${record.id}:`, error);
        record.paused=true;record.failed=true;updateStatus(record);
        const message=document.createElement('div');message.className='render-error';message.setAttribute('role','status');
        message.textContent='This experiment stopped unexpectedly. Reset it to try again.';
        $('.canvas-frame',record.stage).append(message);break;
      }
    }
  }
  if(records.some(shouldRun)) raf=requestAnimationFrame(tick); else previousTime=null;
}
function wake(){if(!raf&&records.some(shouldRun)) raf=requestAnimationFrame(tick);}

function syncGlobalMotion(){
  document.documentElement.dataset.motion=allPaused?'paused':'playing';
  const button=$('.motion-toggle');button.textContent=allPaused?'Play all':'Pause all';button.title=allPaused?'Play all animations':'Pause all animations';button.setAttribute('aria-pressed',String(allPaused));
}
$('.motion-toggle').addEventListener('click',()=>{
  allPaused=!allPaused;motionPreference=allPaused?'paused':'playing';setPreference('anthology-motion',motionPreference);
  for(const record of records){record.paused=allPaused;updateStatus(record);}syncGlobalMotion();wake();
});
reducedMotion.addEventListener('change',event=>{
  if(motionPreference)return;allPaused=event.matches;for(const r of records){r.paused=allPaused;updateStatus(r);}syncGlobalMotion();wake();
});
document.addEventListener('visibilitychange',()=>{previousTime=null;records.forEach(clearPointer);wake();});
window.addEventListener('blur',()=>records.forEach(clearPointer));

for(const record of records){buildControls(record);bindCanvas(record);}
syncGlobalMotion();
const observer=new IntersectionObserver(entries=>{
  for(const entry of entries){const record=byId.get(entry.target.dataset.specimen);record.visible=entry.isIntersecting;if(record.visible)createInstance(record);else clearPointer(record);}
  wake();
},{rootMargin:'120px 0px',threshold:0});
records.forEach(r=>observer.observe(r.article));
const currentObserver=new IntersectionObserver(entries=>{
  const entered=entries.filter(e=>e.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top);
  if(!entered.length)return;const r=byId.get(entered[0].target.dataset.specimen);
  $('.topbar-current-num').textContent=r.number;$('.topbar-current-name').textContent=r.title;
},{rootMargin:'-20% 0px -60% 0px'});
records.forEach(r=>currentObserver.observe(r.article));

function updateFavorite(record){
  const button=$('[data-action="favorite"]',record.stage);const saved=favorites.has(record.id);
  button.setAttribute('aria-pressed',String(saved));button.title=saved?'Remove from your saved collection':'Save to your collection';button.setAttribute('aria-label',button.title);
}

async function handleAction(record,action,button){
  if(action==='pause'){
    record.paused=!record.paused;createInstance(record);updateStatus(record);wake();
  }else if(action==='step'){
    record.paused=true;const inst=createInstance(record);inst?.frame();updateStatus(record);
  }else if(action==='reset'){
    resetRecord(record);toast(`${record.title} restarted with the same settings.`);
  }else if(action==='expand'){
    openStudio(record,button);
  }else if(action==='save'){
    await saveArtwork(record);
  }else if(action==='share'){
    await shareExperiment(record);
  }else if(action==='favorite'){
    if(favorites.has(record.id))favorites.delete(record.id);else favorites.add(record.id);
    setPreference('anthology-favorites',JSON.stringify([...favorites]));updateFavorite(record);
    toast(favorites.has(record.id)?'Added to Saved in the collection.':'Removed from your saved collection.');
  }
}

function openCollection(){
  records.forEach(clearPointer);renderCollection();collection.showModal();document.body.classList.add('dialog-open');$('#experiment-search').focus();
}
function renderCollection(){
  const query=$('#experiment-search').value.trim().toLowerCase();
  const matching=records.filter(r=>(filter==='all'||filter==='favorites'&&favorites.has(r.id)||filter===r.chapter.id)&&
    `${r.title} ${r.number} ${r.chapter.label} ${r.meta.summary} ${r.meta.steps.join(' ')}`.toLowerCase().includes(query));
  const grid=$('.collection-grid');grid.replaceChildren();
  for(const r of matching){
    const card=document.createElement('button');card.type='button';card.className='collection-card';card.style.setProperty('--chapter-accent',r.chapter.color);
    const img=document.createElement('img');img.src=`previews/${r.id}.webp`;img.alt='';img.width=320;img.height=200;img.loading='lazy';
    const number=document.createElement('span');number.className='card-number';number.textContent=r.number;
    const title=document.createElement('span');title.className='card-title';title.textContent=r.title;
    const category=document.createElement('span');category.className='card-category';category.textContent=`${r.chapter.label}${favorites.has(r.id)?' · Saved':''}`;
    card.append(img,number,title,category);card.addEventListener('click',()=>{collection.close();navigateTo(r,true);});grid.append(card);
  }
  $('#collection-count').textContent=`${matching.length} ${matching.length===1?'experiment':'experiments'}${filter==='favorites'?' saved on this device':''}`;
  $('.collection-empty').hidden=matching.length>0;
  if(!matching.length)$('.collection-empty').textContent=filter==='favorites'?'Save an experiment with its star button. Your favorites will appear here.':'No experiments found. Try another word or category.';
}
$$('[data-open-explore]').forEach(button=>button.addEventListener('click',openCollection));
$('#experiment-search').addEventListener('input',renderCollection);
$$('[data-filter]').forEach(button=>button.addEventListener('click',()=>{
  filter=button.dataset.filter;$$('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));renderCollection();
}));

function navigateTo(record,updateHistory=false){
  if(updateHistory)history.pushState(null,'',`#${record.id}`);
  record.article.scrollIntoView({behavior:reducedMotion.matches||allPaused?'instant':'smooth',block:'start'});
  const heading=$('.specimen-title',record.article);heading.tabIndex=-1;heading.focus({preventScroll:true});
}
$$('[data-surprise]').forEach(button=>button.addEventListener('click',()=>{
  const candidates=records.filter(r=>!r.visible);const pool=candidates.length?candidates:records;
  navigateTo(pool[newSeed()%pool.length],true);
}));

function openStudio(record,opener){
  if(studio.open)return;
  activeStudio=record;studioOpener=opener;studioAnchor=document.createComment(`Return ${record.id} here`);
  record.stage.before(studioAnchor);$('.studio-content').append(record.stage);
  studio.style.setProperty('--chapter-accent',record.chapter.color);
  $('#studio-title').textContent=record.title;$('#studio-number').textContent=`${record.number} / ${record.chapter.label}`;
  $('.studio-hint').textContent=`${record.meta.hint}. ${record.meta.challenge}`;
  $('[data-action="expand"]',record.stage).hidden=true;
  $('.canvas-frame',record.stage).classList.add('is-interactive');
  records.forEach(clearPointer);studio.showModal();document.body.classList.add('dialog-open');
  createInstance(record);requestAnimationFrame(()=>{record.instance?._setSize();draw(record);wake();});
}
studio.addEventListener('close',()=>{
  if(!activeStudio)return;
  const record=activeStudio;studioAnchor.replaceWith(record.stage);
  $('[data-action="expand"]',record.stage).hidden=false;
  $('.canvas-frame',record.stage).classList.remove('is-interactive');
  const touch=$('.touch-play',record.stage);if(touch){touch.textContent='Touch to play';touch.setAttribute('aria-pressed','false');}
  clearPointer(record);activeStudio=null;studioAnchor=null;
  studioOpener?.focus({preventScroll:true});studioOpener=null;
  requestAnimationFrame(()=>{record.instance?._setSize();draw(record);wake();});
});
for(const dialog of [collection,studio]){
  $('.close-dialog',dialog).addEventListener('click',()=>dialog.close());
  // Native dialogs provide focus containment and Escape handling.
  dialog.addEventListener('click',event=>{
    if(event.target!==dialog)return;const rect=dialog.getBoundingClientRect();
    if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();
  });
  dialog.addEventListener('close',()=>{if(!collection.open&&!studio.open)document.body.classList.remove('dialog-open');previousTime=null;wake();});
}

async function saveArtwork(record){
  if(!createInstance(record))return;
  try{
    // Draw and copy synchronously so WebGL's default framebuffer has not been discarded.
    draw(record);
    const output=document.createElement('canvas');
    output.width=record.canvas.width;output.height=record.canvas.height+Math.round(68*record.instance.dpr);
    const ctx=output.getContext('2d');ctx.fillStyle='#0a0a0c';ctx.fillRect(0,0,output.width,output.height);ctx.drawImage(record.canvas,0,0);
    const scale=record.instance.dpr;ctx.fillStyle='#f4f1ea';ctx.font=`${16*scale}px Georgia,serif`;
    ctx.fillText(`${record.number} / ${record.title}`,20*scale,record.canvas.height+29*scale,output.width-40*scale);
    ctx.fillStyle='#a49f96';ctx.font=`${10*scale}px monospace`;ctx.fillText('GRAPHICS ANTHOLOGY · pbnewman.github.io',20*scale,record.canvas.height+49*scale,output.width-40*scale);
    const blob=await new Promise(resolve=>output.toBlob(resolve,'image/png'));
    if(!blob)throw new Error('Image conversion failed');
    const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`graphics-anthology-${record.id}.png`;
    document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
    toast('Your artwork is ready to keep.');
  }catch(error){console.error(error);toast('The image could not be saved. Try again in your browser.');}
}

async function shareExperiment(record){
  if(record.id==='mandelbrot'&&record.instance){record.settings.real=record.instance.cReal;record.settings.imaginary=record.instance.cImag;updateSettings(record);}
  const url=new URL(location.href);url.hash=experimentHash(record.id,record.seed,record.settings);url.search='';
  try{
    if(!navigator.clipboard?.writeText)throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(url.href);toast('Link copied with the starting seed and controls.');
  }catch{
    // A selectable URL keeps sharing usable when clipboard permission is unavailable.
    let box=$('.share-fallback',record.stage);
    if(!box){box=document.createElement('label');box.className='share-fallback';box.textContent='Copy this link';const input=document.createElement('input');input.type='text';input.readOnly=true;box.append(input);record.stage.append(box);}
    const input=$('input',box);input.value=url.href;input.focus();input.select();toast('Select and copy the link below the controls.');
  }
}

function restoreHash(){
  const saved=parseExperimentHash(location.hash);if(!saved)return;
  const record=byId.get(saved.id);
  if(saved.seed!==null){record.seed=saved.seed;record.settings=saved.settings;resetRecord(record);}
  if(collection.open)collection.close();if(studio.open)studio.close();
  requestAnimationFrame(()=>navigateTo(record));
}
window.addEventListener('hashchange',restoreHash);
restoreHash();
