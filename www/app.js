/* Astrologers' Workbench Mobile — launcher. Adapted from the Polaris Launcher controller 1.5.2 frontend.
   AGPL-3.0-or-later. The 36 HTML tools are served unchanged. */
'use strict';
const BUILD = '2.0.1-4'; // changes with every release so updated files are never served from an old cache
const $ = s => document.querySelector(s);
const defaultFavorites = ['SimpleRectification', 'Polaris2','CentralScrutinizer', 'PSSR_Aspects', 'Timeline'];
const LIVE = new Set(['AgeHarmonicsLive', 'AscensionalTransits_LIVE']);
let catalog = [], favorites = [], tabs = [], active = null, secondary = null, split = false, library = true, sequence = 0, ratio = 50;
let stored = {}, useSW = false, installEvent = null;

const store = {
  get(k, d) { try { const v = localStorage.getItem('aw.mobile.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('aw.mobile.' + k, JSON.stringify(v)); } catch {} }
};
let toastTimer;
function toast(text) { const t = $('#toast'); t.textContent = text; t.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('visible'), 3200); }
window.AWToast = toast;
const NATIVE = !!window.AW_NATIVE;
let savedTimer;
window.AWSaved = (name, where, share) => {
  const bar = $('#saved'); $('#savedText').textContent = where ? 'Saved ' + name + ' to ' + where : 'Choose where to keep ' + name;
  $('#savedShare').onclick = () => { bar.hidden = true; share(); };
  bar.hidden = false; clearTimeout(savedTimer); savedTimer = setTimeout(() => bar.hidden = true, 7000);
};
window.AWBack = async () => {
  if (!$('#menu').hidden) return hideMenu();
  const open = [...document.querySelectorAll('dialog[open]')].pop(); if (open) { if (open.id === 'confirmDialog') $('#confirmNo').click(); else open.close(); return; }
  if (!library) { library = true; render(); return; }
  if (!tabs.length || await ask('Leave the workbench?', 'Open tools and anything you have not saved or exported will be closed.', 'Leave')) { tabs = []; window.Capacitor.Plugins.App.exitApp(); }
};
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function button(text, action, cls = '') { const b = el('button', cls, text); b.type = 'button'; b.onclick = action; return b; }
const mb = n => (n / 1e6).toFixed(n < 1e7 ? 1 : 0) + ' MB';

/* ---------- Confirm (in-page) ---------- */
function ask(title, text, yes = 'Close tool') {
  return new Promise(resolve => {
    const d = $('#confirmDialog'); $('#confirmTitle').textContent = title; $('#confirmText').textContent = text; $('#confirmYes').textContent = yes;
    const done = v => { d.close(); resolve(v); };
    $('#confirmYes').onclick = () => done(true); $('#confirmNo').onclick = () => done(false);
    d.oncancel = e => { e.preventDefault(); done(false); };
    d.showModal(); $('#confirmNo').focus();
  });
}

/* ---------- Favorites ---------- */
function toggleFavorite(id) { favorites = favorites.includes(id) ? favorites.filter(x => x !== id) : [...favorites, id]; store.set('favorites', favorites); renderLibrary(); }
function star(m) {
  const on = favorites.includes(m.id);
  const b = button(on ? '★' : '☆', () => toggleFavorite(m.id), 'star' + (on ? ' on' : ''));
  b.setAttribute('aria-label', (on ? 'Unpin ' : 'Pin ') + m.name); b.setAttribute('aria-pressed', on); return b;
}

/* ---------- Library ---------- */
function renderLibrary() {
  const q = $('#search').value.toLowerCase().trim();
  const filtered = catalog.filter(m => [m.name, m.short, m.group, m.description, m.keywords].join(' ').toLowerCase().includes(q));
  const favs = $('#favorites'); favs.replaceChildren();
  favorites.map(id => filtered.find(m => m.id === id)).filter(Boolean).forEach(m => favs.append(button(m.short, () => openTool(m.id), 'fav')));
  const cards = $('#cards'); cards.replaceChildren();
  const groups = [...new Set(catalog.map(m => m.group))];
  groups.forEach((group, i) => {
    const items = filtered.filter(m => m.group === group); if (!items.length) return;
    const section = el('section', 'tool-group'); const h = el('div', 'cards-group'); h.append(el('span', '', String(i + 1).padStart(2, '0')), document.createTextNode(group)); section.append(h);
    const grid = el('div', 'grid'); section.append(grid);
    items.forEach(m => {
      const card = el('article', 'card' + (tabs.some(t => t.module.id === m.id) ? ' running' : ''));
      const open = button('', () => openTool(m.id), 'card-open'); open.setAttribute('aria-label', m.name + '. ' + m.description);
      const h3 = el('h3', '', m.name);
      if (stored[m.id]) { const dot = el('i', 'stored'); dot.title = 'Saved on this device'; h3.append(dot); }
      if (LIVE.has(m.id)) h3.append(el('span', 'badge live', 'Live'));
      if (m.builtIn) h3.append(el('span', 'badge new', 'New'));
      open.append(h3, el('p', '', m.description));
      card.append(open, star(m)); grid.append(card);
    });
    cards.append(section);
  });
  $('#empty').hidden = filtered.length > 0;
}

/* ---------- Tools ---------- */
const zoomLevels = [50, 60, 70, 80, 90, 100, 110, 125, 150];
function applyZoom(tab) { try { tab.frame.contentDocument.documentElement.style.zoom = tab.zoom + '%'; } catch {} }

async function loadInto(tab) {
  const { module, frame, host } = tab;
  const cover = el('div', 'loading'); const label = el('div', '', 'Preparing ' + module.short + '…'); const meter = el('div', 'meter'); const bar = el('i'); meter.append(bar); cover.append(label, meter); host.append(cover);
  try {
    const progress = (done, total) => { bar.style.width = Math.min(100, done / total * 100) + '%'; label.textContent = done < total ? 'Downloading ' + module.short + ' · ' + mb(done) + ' of ' + mb(total) : 'Opening ' + module.short + '…'; };
    if (module.builtIn) {
      frame.src = module.builtIn + '?v=' + BUILD;
    } else if (NATIVE) {
      const unpack = (done, total) => { bar.style.width = Math.min(100, done / total * 100) + '%'; label.textContent = done < total ? 'Preparing ' + module.short + ' for first use · ' + Math.round(done / total * 100) + '%' : 'Opening ' + module.short + '…'; };
      frame.src = await AWStore.installNative(module.id, unpack);
    } else if (useSW) {
      await AWStore.prefetch(module.id, progress);
      frame.src = 'modules/' + module.id + '.html';
    } else {
      const blob = await AWStore.build(module.id, progress);
      tab.blobUrl = URL.createObjectURL(blob); frame.src = tab.blobUrl;
    }
    frame.addEventListener('load', () => { cover.remove(); applyZoom(tab); window.AWNative && AWNative.hookFrame(frame); try { frame.contentWindow.addEventListener('keydown', shortcuts); } catch {} }, { once: true });
    if (!module.builtIn && !stored[module.id]) { stored[module.id] = true; renderLibrary(); requestPersistence(); }
  } catch (err) {
    cover.classList.add('error'); label.textContent = err.message || String(err); meter.remove();
    cover.append(button('Try again', () => { cover.remove(); loadInto(tab); }));
  }
}

function openTool(id, forceNew = false) {
  let tab = !forceNew && tabs.find(t => t.module.id === id);
  if (!tab) {
    const module = catalog.find(m => m.id === id); const key = ++sequence;
    const host = el('div', 'tool-host'); host.dataset.key = key;
    const toolbar = el('div', 'tool-toolbar');
    const title = el('strong');
    const zoom = el('select'); zoom.setAttribute('aria-label', 'Zoom ' + module.short);
    const z = store.get('zoom.' + id, 100);
    zoomLevels.forEach(v => { const o = el('option', '', v + '%'); o.value = v; o.selected = v === z; zoom.append(o); });
    const more = button('⋯', e => toolMenu(tab, e.currentTarget), 'tb'); more.setAttribute('aria-label', 'More for ' + module.short); more.setAttribute('aria-haspopup', 'menu');
    const close = button('×', () => closeTab(key), 'tb'); close.setAttribute('aria-label', 'Close ' + module.short);
    toolbar.append(title, zoom, more, close);
    const frame = el('iframe'); frame.title = module.name; frame.setAttribute('allow', 'clipboard-write; fullscreen');
    host.append(toolbar, frame);
    $('#stage').append(host); // iframes never move parents afterwards: moving one would reload it
    tab = { key, module, host, frame, title, zoom: z };
    zoom.onchange = () => { tab.zoom = Number(zoom.value); store.set('zoom.' + id, tab.zoom); applyZoom(tab); };
    tabs.push(tab);
    loadInto(tab);
  }
  library = false;
  if (split && secondary === null && active !== null && active !== tab.key) secondary = tab.key;
  else if (tab.key !== secondary) active = tab.key;
  render();
  return tab;
}

/* Used by Simple Rectification: a URL for an unchanged engine module, and a hand-over to the full tool. */
window.AWEngineURL = async (id, onProgress) => {
  if (NATIVE) return AWStore.installNative(id, onProgress);
  if (useSW) { await AWStore.prefetch(id, onProgress); return new URL('modules/' + id + '.html', location.href).href; }
  return URL.createObjectURL(await AWStore.build(id, onProgress));
};
window.AWOpenWithProject = (id, text) => {
  const tab = openTool(id, true);
  const t0 = Date.now();
  const tryOpen = () => {
    let w = null; try { w = tab.frame.contentWindow; } catch {}
    if (w && w.RectificationTest && /ready/i.test(w.document.getElementById('engineState')?.textContent || '')) {
      try { w.RectificationTest.openProject(text); toast('Case opened in ' + label(tab) + '. Press Scan there to see every detail.'); } catch (e) { toast('Could not open the case: ' + e.message); }
    } else if (Date.now() - t0 < 120000) setTimeout(tryOpen, 400);
  };
  tryOpen();
};

function toolMenu(tab, anchor) {
  const menu = $('#menu'); menu.replaceChildren();
  const item = (text, fn, cls = '') => { const b = button(text, () => { hideMenu(); fn(); }, cls); b.setAttribute('role', 'menuitem'); menu.append(b); };
  item('New copy', () => openTool(tab.module.id, true));
  if (!NATIVE) item('Print', () => { try { tab.frame.contentWindow.focus(); tab.frame.contentWindow.print(); } catch { toast('Printing is not available here.'); } });
  item('Reload tool', async () => { if (await ask('Reload ' + tab.module.short + '?', 'Unsaved input and results in this tool will be lost.', 'Reload')) tab.frame.contentWindow.location.reload(); });
  if (split && secondary !== null) item('Swap panes', () => { [active, secondary] = [secondary, active]; render(); });
  item('Close tool', () => closeTab(tab.key), 'danger-text');
  menu.hidden = false;
  const r = anchor.getBoundingClientRect(); const w = menu.offsetWidth, h = menu.offsetHeight;
  menu.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.right - w)) + 'px';
  menu.style.top = Math.min(innerHeight - h - 8, r.bottom + 4) + 'px';
  setTimeout(() => menu.querySelector('button').focus(), 0);
}
function hideMenu() { $('#menu').hidden = true; }
document.addEventListener('pointerdown', e => { if (!$('#menu').hidden && !$('#menu').contains(e.target)) hideMenu(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') hideMenu(); });

async function closeTab(key) {
  const tab = tabs.find(t => t.key === key); if (!tab) return;
  if (!await ask('Close ' + tab.module.short + '?', 'Use the tool’s save or export controls first if you want to keep your input or results.')) return;
  tab.host.remove(); if (tab.blobUrl) URL.revokeObjectURL(tab.blobUrl);
  tabs = tabs.filter(t => t.key !== key);
  if (secondary === key) secondary = null;
  if (active === key) { active = secondary ?? tabs.at(-1)?.key ?? null; secondary = null; }
  if (!tabs.length) { library = true; split = false; }
  $('#openSheet').open && renderOpenList();
  render();
}

function label(t) { const same = tabs.filter(x => x.module.id === t.module.id); return t.module.short + (same.length > 1 ? ' · ' + (same.indexOf(t) + 1) : ''); }

/* ---------- Layout ---------- */
function vertical() { return innerWidth >= innerHeight || innerWidth >= 900; } // side by side?
function render() {
  $('#library').hidden = !library; $('#workspace').hidden = library;
  $('#libraryBtn').classList.toggle('selected', library);
  $('#openBtn').classList.toggle('selected', !library && !split);
  $('#compare').classList.toggle('selected', split && !library);
  $('#openBtn').disabled = !tabs.length; $('#compare').disabled = !tabs.length;
  $('#openCount').hidden = !tabs.length; $('#openCount').textContent = tabs.length;
  const current = tabs.find(t => t.key === active);
  $('#breadcrumb').textContent = library ? 'Tool library' : split ? 'Compare' : (current?.module.name || 'Tools');
  const side = vertical(); const d = $('#divider');
  tabs.forEach(t => {
    t.title.textContent = label(t);
    const isA = t.key === active, isB = split && t.key === secondary; const s = t.host.style;
    t.host.hidden = !(isA || isB);
    t.host.classList.toggle('secondary', isB); t.host.classList.toggle('primary', isA); t.host.classList.toggle('split', split);
    if (!split) { s.inset = '0'; s.width = s.height = ''; return; }
    if (side) { s.top = '0'; s.bottom = '0'; s.height = ''; s.left = isB ? `calc(${ratio}% + 5px)` : '0'; s.right = ''; s.width = isB ? `calc(${100 - ratio}% - 5px)` : `calc(${ratio}% - 5px)`; }
    else { s.left = '0'; s.right = '0'; s.width = ''; s.top = isB ? `calc(${ratio}% + 5px)` : '0'; s.bottom = ''; s.height = isB ? `calc(${100 - ratio}% - 5px)` : `calc(${ratio}% - 5px)`; }
  });
  d.hidden = !split || library; d.className = side ? 'v' : 'h'; d.setAttribute('aria-orientation', side ? 'vertical' : 'horizontal');
  Object.assign(d.style, side ? { top: '0', bottom: '0', left: `calc(${ratio}% - 5px)`, width: '10px', right: '', height: '' } : { left: '0', right: '0', top: `calc(${ratio}% - 5px)`, height: '10px', bottom: '', width: '' });
  $('#stage .split-placeholder')?.remove();
  if (split && secondary === null && !library) {
    const p = el('div', 'split-placeholder');
    Object.assign(p.style, side ? { left: `calc(${ratio}% + 5px)`, right: '0', top: '0', bottom: '0' } : { top: `calc(${ratio}% + 5px)`, bottom: '0', left: '0', right: '0' });
    p.append(el('h2', '', 'A second perspective.'), el('p', '', 'Choose a tool for this pane: one you already have open, a fresh copy of the current tool, or anything from the library.'));
    if (current) { const b = button('', () => openTool(current.module.id, true), 'pick'); b.append('New copy of ' + current.module.short, el('small', '', 'An independent second instance')); p.append(b); }
    tabs.filter(t => t.key !== active).forEach(t => { const b = button('', () => { secondary = t.key; render(); }, 'pick'); b.append(label(t), el('small', '', 'Already open')); p.append(b); });
    const lib = button('', () => { library = true; render(); toast('Choose the second tool from the library.'); }, 'pick'); lib.append('Choose from the library', el('small', '', 'It opens in this pane')); p.append(lib);
    $('#stage').append(p);
  }
  renderLibrary();
}
addEventListener('resize', () => split && render());

let dragging = false;
const dv = $('#divider');
dv.onpointerdown = e => { dragging = true; dv.setPointerCapture(e.pointerId); tabs.forEach(t => t.frame.style.pointerEvents = 'none'); };
dv.onpointermove = e => {
  if (!dragging) return; const r = $('#workspace').getBoundingClientRect();
  ratio = Math.max(20, Math.min(80, vertical() ? (e.clientX - r.left) / r.width * 100 : (e.clientY - r.top) / r.height * 100));
  dv.setAttribute('aria-valuenow', Math.round(ratio)); render();
};
function stopDrag() { dragging = false; tabs.forEach(t => t.frame.style.pointerEvents = ''); store.set('ratio', ratio); }
dv.onpointerup = stopDrag; dv.onpointercancel = stopDrag;
dv.onkeydown = e => { const back = ['ArrowLeft', 'ArrowUp'], fwd = ['ArrowRight', 'ArrowDown']; if (![...back, ...fwd].includes(e.key)) return; e.preventDefault(); ratio = Math.max(20, Math.min(80, ratio + (back.includes(e.key) ? -5 : 5))); render(); };

/* ---------- Sheets ---------- */
document.querySelectorAll('dialog').forEach(d => {
  d.addEventListener('click', e => { if (e.target === d) d.close(); }); // tap on backdrop
  d.querySelectorAll('[data-close]').forEach(b => b.onclick = () => d.close());
});
function renderOpenList() {
  const list = $('#openList'); list.replaceChildren();
  tabs.forEach(t => {
    const row = el('div', 'open-item' + (t.key === active && !library ? ' current' : ''));
    const go = button('', () => { $('#openSheet').close(); library = false; if (split && t.key !== active) secondary = t.key; else active = t.key; render(); });
    go.append(label(t), el('small', '', t.key === active ? (split ? 'Main pane' : 'Showing') : t.key === secondary && split ? 'Second pane' : t.module.group));
    const x = button('×', () => closeTab(t.key), 'x'); x.setAttribute('aria-label', 'Close ' + label(t));
    row.append(go, x); list.append(row);
  });
}
$('#libraryBtn').onclick = () => { library = true; render(); };
$('#openBtn').onclick = () => { if (tabs.length === 1 && library) { library = false; split = false; render(); return; } renderOpenList(); $('#openSheet').showModal(); };
$('#compare').onclick = () => { if (library && split) { library = false; render(); return; } split = !split; library = false; if (!split) secondary = null; render(); };
$('#moreBtn').onclick = () => { refreshOffline(); $('#moreSheet').showModal(); };
$('#home').onclick = () => $('#aboutDialog').showModal();
$('#aboutBtn').onclick = () => { $('#moreSheet').close(); $('#aboutDialog').showModal(); };
$('#helpBtn').onclick = () => { $('#moreSheet').close(); $('#helpDialog').showModal(); };
$('#licLink').onclick = e => { if (!NATIVE) return; e.preventDefault(); e.stopPropagation(); $('#moreSheet').close(); const f = $('#licDialog iframe'); if (!f.src) f.src = 'licences.html'; $('#licDialog').showModal(); };
$('#search').oninput = renderLibrary;
$('#search').onkeydown = e => { if (e.key === 'Enter') { const first = $('#cards .card-open'); if (first) { first.click(); $('#search').blur(); } } };
function shortcuts(e) { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); library = true; render(); $('#search').focus(); $('#search').select(); } }
document.addEventListener('keydown', shortcuts);
addEventListener('beforeunload', e => { if (tabs.length) { e.preventDefault(); e.returnValue = ''; } });

/* ---------- Offline ---------- */
async function refreshOffline() {
  try {
    const s = await AWStore.status(); stored = s.modules;
    const n = Object.values(stored).filter(Boolean).length;
    $('#offlineText').textContent = n === catalog.length ? `All ${n} tools are saved on this device (${mb(s.total)}). The app works without internet.` : `${n} of ${catalog.length} tools saved on this device · ${mb(s.stored)} of ${mb(s.total)}. Tools are saved when you first open them.`;
    $('#offlineMeter').style.width = (s.stored / s.total * 100) + '%';
    $('#saveAll').hidden = n === catalog.length; $('#clearAll').hidden = n === 0;
    renderLibrary();
  } catch (e) { $('#offlineText').textContent = e.message; }
}
$('#saveAll').onclick = async () => {
  const b = $('#saveAll'); b.disabled = true; requestPersistence();
  try { await AWStore.downloadAll((d, t) => { $('#offlineMeter').style.width = (d / t * 100) + '%'; $('#offlineText').textContent = 'Saving tools… ' + mb(d) + ' of ' + mb(t); }); toast('All tools are saved for offline use.'); }
  catch (e) { toast('Saving stopped: ' + e.message); }
  b.disabled = false; refreshOffline();
};
$('#clearAll').onclick = async () => {
  if (!await ask('Clear offline copies?', 'Tools will download again the next time you open them. Your saved settings inside each tool are kept.', 'Clear')) return;
  await AWStore.clear(); stored = {}; refreshOffline(); toast('Offline copies cleared.');
};
let persistAsked = false;
function requestPersistence() { if (persistAsked) return; persistAsked = true; try { navigator.storage?.persist?.(); } catch {} }
function netState() { $('#netState').hidden = navigator.onLine; }
addEventListener('online', netState); addEventListener('offline', netState);

/* ---------- Install ---------- */
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
if (!NATIVE && !standalone && iOS) { $('#installGroup').hidden = false; $('#installText').textContent = 'In Safari, tap Share, then “Add to Home Screen”. The workbench then opens full screen like an app.'; }
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvent = e; $('#installGroup').hidden = false; $('#installText').textContent = 'Add the workbench to your home screen. It opens full screen and works offline.'; $('#installBtn').hidden = false; });
$('#installBtn').onclick = async () => { if (!installEvent) return; installEvent.prompt(); await installEvent.userChoice; installEvent = null; $('#installGroup').hidden = true; };

/* ---------- Start ---------- */
async function start() {
  netState();
  ratio = store.get('ratio', 50);
  if (NATIVE) { document.querySelector('.offline').hidden = true; document.body.classList.add('native'); }
  if (!NATIVE && 'serviceWorker' in navigator && location.protocol !== 'file:') {
    try {
      const reg = await navigator.serviceWorker.register('sw.js');
      if (!navigator.serviceWorker.controller) await Promise.race([new Promise(ok => navigator.serviceWorker.addEventListener('controllerchange', ok, { once: true })), new Promise(ok => setTimeout(ok, 4000))]);
      useSW = !!navigator.serviceWorker.controller; void reg;
    } catch { useSW = false; }
  }
  try {
    catalog = await (await fetch('catalog.json?v=' + BUILD)).json();
  } catch { $('#cards').textContent = 'The tool list could not load. Connect to the internet and reopen the app.'; return; }
  const saved = store.get('favorites', null);
  favorites = Array.isArray(saved) ? saved.filter(id => catalog.some(m => m.id === id)) : [...defaultFavorites];
  if (!Array.isArray(saved)) store.set('favorites', favorites);
  const n = $('#aboutToolCount'); if (n) n.textContent = catalog.length;
  render();
  refreshOffline();
}
start();
