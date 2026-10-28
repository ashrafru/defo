/* Simple Rectification — a plain input and output screen for the Polaris2 engine.
   AGPL-3.0-or-later. Polaris2.html runs unchanged in a hidden frame. This page only
   hands it a standard Polaris2 project (the same format as its own "Save project"),
   starts its scan, and reads its ranked results. No calculation happens here. */
'use strict';
const $ = id => document.getElementById(id);
const DRAFT = 'aw.simple.draft.v1';
const UNCERTAINTY = [5, 15, 30, 60, 120, 180]; // minutes either side
const GROUPS = [
  ['Family births', [1, 2, 3, 4, 5, 6]],
  ['Love and marriage', [7, 8, 9, 10]],
  ['Deaths', [11, 12, 13, 14, 15, 16, 17, 18, 20]],
  ['Career and status', [21, 22, 23, 24, 38, 40]],
  ['Travel and moving home', [25, 26, 27, 39]],
  ['Military and legal', [28, 29, 30]],
  ['Health and accidents', [31, 32, 33]],
  ['Money and conflict', [34, 35, 36, 37]],
  ['House themes', [41, 42, 43, 44, 45, 46, 47, 48, 49, 50]]
];

let E = null, RT = null;            // engine window and its RectificationTest interface
let defaults = null, rules = null;  // engine defaults, read once it loads
let base = null;                    // settings carried over from an opened case (else defaults)
let state = blank(), order = 'tpd', selected = null, running = false, poll = null, lastProject = null;

function blank() { return { name: '', birthDate: '', place: '', lat: '', latH: 'N', lon: '', lonH: 'E', tz: '', basis: 'offset', offset: '', time: '12:00', unc: 60, events: [] }; }
function toast(t) { const el = $('toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 3200); }
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function rid() { return (crypto.randomUUID && crypto.randomUUID()) || Date.now() + '-' + Math.random(); }
function save() { try { localStorage.setItem(DRAFT, JSON.stringify({ state, base, rules: base ? rules : null })); } catch (e) {} }
function fail(msg) { const el = $('error'); el.textContent = msg; el.hidden = !msg; }
const pad = n => String(n).padStart(2, '0');
function clock(sec) { const d = Math.floor(sec / 86400), t = ((sec % 86400) + 86400) % 86400; return { time: pad(Math.floor(t / 3600)) + ':' + pad(Math.floor(t % 3600 / 60)) + ':' + pad(t % 60), day: d ? (d > 0 ? '+1 day' : '−1 day') : '' }; }
const engineFn = name => { try { return E[name] || E.eval(name); } catch (e) { return null; } };
function ruleName(id) { return rules?.find(r => r.id === id)?.name || ('Category ' + id); }

/* ---------- Engine ---------- */
async function startEngine() {
  const frame = $('engineFrame');
  try {
    let url;
    if (parent !== window && parent.AWEngineURL) url = await parent.AWEngineURL('Polaris2', (d, t) => { $('engineText').textContent = 'Preparing the Polaris2 engine · ' + Math.round(d / t * 100) + '%'; });
    else url = '../modules/Polaris2.html';
    frame.src = url;
    await new Promise((ok, bad) => { frame.onload = ok; frame.onerror = () => bad(Error('The engine could not load.')); });
    E = frame.contentWindow;
    const t0 = Date.now();
    while (!(E.RectificationTest && /ready/i.test(E.document.getElementById('engineState')?.textContent || ''))) {
      if (Date.now() - t0 > 90000) throw Error('The calculation engine did not start. Close this tool and open it again.');
      await new Promise(r => setTimeout(r, 200));
    }
    RT = E.RectificationTest;
    defaults = RT.formData();
    rules = JSON.parse(JSON.stringify(RT.getState().rules));
    const draftRules = loadDraftRules(); if (draftRules) rules = draftRules;
    $('engine').className = 'engine ready';
    $('engineText').textContent = 'Polaris2 engine ready · ' + E.document.getElementById('engineState').textContent.trim() + ' · calculations unchanged';
    buildCategories(); renderEvents(); updateButtons();
  } catch (err) {
    $('engine').className = 'engine error'; $('engineText').textContent = err.message || String(err);
  }
}
function loadDraftRules() { try { const d = JSON.parse(localStorage.getItem(DRAFT) || 'null'); return d && d.rules; } catch (e) { return null; } }

/* ---------- Step 1: person and place ---------- */
function tzOffsetMinutes(tz, dateStr, timeStr) {
  const [y, m, d] = dateStr.split('-').map(Number), [h, mi] = timeStr.split(':').map(Number);
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' });
  const offAt = ms => { const p = fmt.formatToParts(new Date(ms)).find(x => x.type === 'timeZoneName').value; const r = /GMT([+-])(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?/.exec(p); return r ? (r[1] === '-' ? -1 : 1) * (Number(r[2]) * 60 + Number(r[3] || 0) + Number(r[4] || 0) / 60) : 0; };
  const wall = Date.UTC(y, m - 1, d, h, mi); let off = offAt(wall); off = offAt(wall - off * 60000); return off;
}
function fmtOffset(min) { const s = min < 0 ? '-' : '+'; min = Math.abs(min); return s + pad(Math.floor(min / 60)) + ':' + pad(Math.round(min % 60)); }
function suggestOffset() {
  if (!state.tz || !state.birthDate) return;
  try {
    const min = tzOffsetMinutes(state.tz, state.birthDate, state.time || '12:00');
    if (Math.abs(min - Math.round(min)) > 0.001) { // the zone kept local mean time then
      state.basis = 'lmt'; $('offsetHint').textContent = 'Before standard time zones: ' + state.tz + ' used local mean time on this date.';
    } else {
      state.basis = 'offset'; state.offset = fmtOffset(min);
      $('offsetHint').textContent = 'Suggested from ' + state.tz + ' for this date and time, including daylight saving. Check it against a historical time-zone source.';
    }
  } catch (e) { $('offsetHint').textContent = 'Enter the UTC offset that applied at birth.'; }
  fill();
}
let cityTimer = null;
function citySearch() {
  const q = $('place').value.trim(), list = $('cityList');
  if (!E?.OfflineCities || q.length < 2) { list.hidden = true; return; }
  const found = E.OfflineCities.search(q).slice(0, 12);
  list.innerHTML = found.length ? found.map((c, i) => `<button type="button" role="option" data-i="${i}">${esc(c.label)}<small>${Math.abs(c.latitude)}° ${c.latitude < 0 ? 'S' : 'N'} · ${Math.abs(c.longitudeWest)}° ${c.longitudeWest > 0 ? 'W' : 'E'} · ${esc(c.timezone || 'time zone unknown')}</small></button>`).join('') : '<button type="button" disabled>No match in the offline city list. Type the coordinates under “Adjust”.</button>';
  list.hidden = false;
  list.onclick = e => { const b = e.target.closest('[data-i]'); if (!b) return; const c = found[+b.dataset.i];
    Object.assign(state, { place: c.label, lat: String(Math.abs(c.latitude)), latH: c.latitude < 0 ? 'S' : 'N', lon: String(Math.abs(c.longitudeWest)), lonH: c.longitudeWest > 0 ? 'W' : 'E', tz: c.timezone || '' });
    list.hidden = true; fill(); suggestOffset(); save(); };
}
function placeBox() {
  const b = $('placeBox');
  if (!state.lat || !state.lon) { b.hidden = true; return; }
  b.hidden = false;
  b.innerHTML = `<span><b>${esc(state.lat)}° ${state.latH}</b>, <b>${esc(state.lon)}° ${state.lonH}</b></span><span>${state.tz ? esc(state.tz) + ' · ' : ''}${state.basis === 'lmt' ? '<b>Local mean time</b>' : 'UTC offset <b>' + esc(state.offset || '?') + '</b>'}</span>`;
}

/* ---------- Step 2: time range ---------- */
function rangeSeconds() {
  const [h, m] = (state.time || '12:00').split(':').map(Number), c = h * 3600 + m * 60, u = state.unc * 60;
  let s = c - u, e = c + u, sd = 0, ed = 0;
  if (s < 0) { s += 86400; sd = -1; } if (e >= 86400) { e -= 86400; ed = 1; }
  const hms = t => pad(Math.floor(t / 3600)) + ':' + pad(Math.floor(t % 3600 / 60)) + ':' + pad(t % 60);
  const step = Number((base || defaults || {}).step || 4);
  return { start: hms(s), end: hms(e), startDay: String(sd), endDay: String(ed), count: Math.floor(2 * u / step) + 1, step };
}
function renderRange() {
  $('unc').innerHTML = UNCERTAINTY.concat(UNCERTAINTY.includes(state.unc) ? [] : [state.unc]).map(m => `<button type="button" data-m="${m}" aria-pressed="${m === state.unc}">± ${m < 60 ? m + ' min' : m / 60 + ' h'}</button>`).join('');
  const r = rangeSeconds();
  $('range').innerHTML = `Search from <b>${r.start}</b>${r.startDay === '-1' ? ' (day before)' : ''} to <b>${r.end}</b>${r.endDay === '1' ? ' (day after)' : ''} · ${r.count.toLocaleString()} candidate times, every ${r.step} seconds.`;
}

/* ---------- Step 3: events ---------- */
function buildCategories() {
  const sel = $('evCat'); const enabled = new Set(rules.filter(r => r.enabled).map(r => r.id));
  sel.innerHTML = '<option value="">Choose…</option>' + GROUPS.map(([g, ids]) => `<optgroup label="${esc(g)}">${ids.filter(id => enabled.has(id)).map(id => `<option value="${id}">${esc(ruleName(id))}</option>`).join('')}</optgroup>`).join('');
}
function renderEvents() {
  const list = $('events');
  $('evCount').textContent = state.events.length + ' event' + (state.events.length === 1 ? '' : 's');
  if (!state.events.length) { list.innerHTML = '<p class="empty">No events yet. Add births, marriages, deaths, moves and other dated turning points.</p>'; return; }
  list.innerHTML = state.events.map((e, i) => `<div class="event"><span class="d">${esc(e.monthOnly ? e.date.slice(0, 7) : e.date)}</span><span class="c">${esc(ruleName(e.category))}${e.description ? `<small>${esc(e.description)}</small>` : ''}</span><button class="x" type="button" data-del="${i}" aria-label="Remove event ${esc(e.date)}">×</button></div>`).join('');
}
function addEvent() {
  fail('');
  const d = $('evDate').value, cat = Number($('evCat').value), month = $('evMonth').checked;
  if (!d) return fail('Enter the event date.');
  if (!cat) return fail('Choose what happened.');
  state.events.push({ date: month ? d.slice(0, 7) : d, monthOnly: month, category: cat, description: $('evNote').value.trim() });
  state.events.sort((a, b) => a.date.localeCompare(b.date));
  $('evNote').value = ''; $('evDate').value = ''; $('evMonth').checked = false; $('evCat').value = '';
  renderEvents(); save(); updateButtons(); $('evDate').focus();
}

/* ---------- Project for the engine ---------- */
function project() {
  const r = rangeSeconds();
  const data = { ...(base || defaults), name: state.name, birthDate: state.birthDate, place: state.place,
    lat: `${state.lat} ${state.latH}`, lon: `${state.lon} ${state.lonH}`, basis: state.basis, offset: state.offset || '+00:00',
    start: r.start, end: r.end, startDay: r.startDay, endDay: r.endDay };
  const events = state.events.map(e => ({ id: rid(), date: e.monthOnly ? e.date.slice(0, 7) + '-15' : e.date, monthOnly: !!e.monthOnly, category: e.category, description: e.description || '', use: true, mode: 'score' }));
  let tableVersion; try { tableVersion = E.eval('ScoreEngine.tableVersion'); } catch (e) {}
  return { format: 'topocentric-rectification-project', version: 2, tableVersion, data, events, rules };
}
function check() {
  if (!state.birthDate) return 'Enter the birth date.';
  if (!state.lat || !state.lon) return 'Choose the birthplace, or type its coordinates under “Adjust coordinates and time zone”.';
  if (state.basis === 'offset' && !/^[+\-−]?\d{1,2}(:\d{2})?$/.test((state.offset || '').trim())) return 'Enter the UTC offset at birth, for example +02:00 or -05:00.';
  if (!state.events.length) return 'Add at least one life event.';
  return '';
}

/* ---------- Run ---------- */
function updateButtons() { $('runBtn').disabled = !RT || running; $('sampleBtn').disabled = !RT || running; $('cancelBtn').hidden = !running; }
function run() {
  fail(''); const problem = check(); if (problem) return fail(problem);
  try {
    lastProject = project();
    RT.openProject(JSON.stringify(lastProject));
    RT.startScan();
  } catch (err) { return fail(err.message || String(err)); }
  const doc = E.document;
  if (!doc.getElementById('scan').disabled) { // the engine refused the input
    return fail(doc.getElementById('status').textContent || 'The engine could not start the scan.');
  }
  running = true; selected = null; updateButtons(); $('results').hidden = true; $('meter').hidden = false;
  clearInterval(poll);
  poll = setInterval(() => {
    $('meter').firstElementChild.style.width = (Number(doc.getElementById('progress').value) * 100) + '%';
    $('status').textContent = doc.getElementById('status').textContent;
    const snap = RT.getState().snapshot;
    if (snap && snap.state) { clearInterval(poll); running = false; updateButtons(); $('meter').hidden = true; finished(snap); }
  }, 300);
}
function finished(snap) {
  if (snap.state === 'error') return fail('The scan stopped: ' + (snap.stopMessage || E.document.getElementById('status').textContent));
  if (snap.state === 'cancelled') toast('Stopped. Results cover only the part of the range already scanned.');
  showResults(); $('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ---------- Results ---------- */
function candidates() {
  E.document.getElementById('candidateDisplay').value = 'distinct'; // the engine's own grouping of near-identical times
  const list = engineFn('displayCandidates')(order === 'combined' ? 'combined' : 'tpd');
  if (order === 'combined') list.sort((a, b) => a.combined.rank - b.combined.rank); // the engine's own Combined rank
  return list.slice(0, 5);
}
function score(r) { return order === 'combined' ? r.combined : r; }
function showResults() {
  const st = RT.getState(), snap = st.snapshot; if (!snap) return;
  const top = candidates(), zod = engineFn('truncatedZodiac');
  $('results').hidden = false;
  $('resMeta').textContent = snap.totalScoring + ' events · ' + st.results.length.toLocaleString() + ' times scanned';
  document.querySelectorAll('[data-order]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.order === order)));
  if (!top.length) { $('cands').innerHTML = '<p class="empty">No candidate has a score in this order. Try Primary directions.</p>'; $('checks').innerHTML = ''; return; }
  if (selected === null || !top.some(r => r.seconds === selected)) selected = top[0].seconds;
  const best = score(top[0]).points || 1;
  $('cands').innerHTML = top.map((r, i) => { const s = score(r), c = clock(r.seconds);
    return `<button class="cand" type="button" data-sec="${r.seconds}" aria-pressed="${r.seconds === selected}"><span class="rk">#${i + 1}</span><span class="t">${c.time}${c.day ? `<small>${c.day}</small>` : ''}</span><span class="ang">Asc ${esc(zod(r.ascendant))} · MC ${esc(zod(r.midheaven))}</span><span class="sc">Score ${s.points} · explains ${s.witnessed} of ${snap.totalScoring}<span class="bar" aria-hidden="true"><i style="width:${Math.max(4, s.points / best * 100)}%"></i></span></span></button>`; }).join('');
  showChecks(st.results.find(r => r.seconds === selected), snap);
  const d = snap.data;
  $('engineNote').textContent = `Calculated by the unchanged Polaris2 engine (${d.scoringMode === 'binary' ? 'equal-hit' : 'Polaris weighted'} scoring, TPD orbs ${d.tpdConjOppOrb}′ / ${d.tpdOtherOrb}′, ${d.step}-second steps). Times closer than ${engineFn('DISTINCT_SECONDS') || 23} seconds are grouped, as in Polaris2’s distinct list. “Directions + progressions + returns” adds ${Number(d.combinedSecondaryPercent)}% of the Secondaries score and ${Number(d.combinedPssrPercent)}% of the PSSR score to the TPD score, for Polaris2’s shortlisted times only.`;
}
function showChecks(r, snap) {
  if (!r) return;
  const hit = engineFn('hitText'), c = clock(r.seconds);
  $('checkTitle').textContent = 'Which events ' + c.time + ' explains';
  const evOf = (layer, id) => layer?.evidence?.find(x => x.id === id);
  $('checks').innerHTML = snap.events.map((ev, i) => {
    const tpd = evOf(r, ev.id), sec = evOf(r.secondary, ev.id), pssr = evOf(r.pssr, ev.id), comb = evOf(r.combined, ev.id);
    const yes = order === 'combined' ? (comb?.points || 0) > 0 : (tpd?.points || 0) > 0;
    const n = tpd?.groups?.length || 0, local = state.events[i];
    const date = ev.monthOnly ? ev.date.slice(0, 7) : ev.date;
    const sys = r.secondary || r.pssr ? `<div class="sys"><span class="${(tpd?.points || 0) > 0 ? 'on' : ''}">Directions${(tpd?.points || 0) > 0 ? ' ✓' : ''}</span><span class="${(sec?.points || 0) > 0 ? 'on' : ''}">Secondaries${(sec?.points || 0) > 0 ? ' ✓' : ''}</span><span class="${(pssr?.points || 0) > 0 ? 'on' : ''}">Solar returns${(pssr?.points || 0) > 0 ? ' ✓' : ''}</span></div>` : '';
    return `<div class="chk ${yes ? 'yes' : 'no'}"><span class="m" aria-label="${yes ? 'Explained' : 'Not explained'}">${yes ? '✓' : '✗'}</span><span class="h"><span>${esc(date)}</span>${esc(ruleName(ev.category))}</span><span class="s">${esc(local?.description || ev.description || '')}${n ? (local?.description || ev.description ? ' · ' : '') + n + ' direction' + (n === 1 ? '' : 's') + ' · ' + (tpd.points) + ' points' : (yes ? '' : ' No qualifying direction')}</span>${n ? `<span class="hits">${tpd.groups.slice(0, 3).map(g => esc(hit(g.hit))).join('<br>')}${n > 3 ? '<br>+ ' + (n - 3) + ' more' : ''}</span>` : ''}${sys}</div>`;
  }).join('');
}

/* ---------- Save, open, export ---------- */
function download(text, type, name) {
  const url = URL.createObjectURL(new Blob([text], { type })), a = document.createElement('a');
  a.href = url; a.download = name; a.hidden = true; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
}
const fileBase = () => (state.name || 'Case').normalize('NFC').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/\s+/g, '_');
function saveCase() {
  const problem = check(); if (problem && !state.events.length && !state.birthDate) return fail(problem);
  download(JSON.stringify(project(), null, 2), 'application/json', fileBase() + '_Rectification_Project.json');
}
function exportCsv() {
  const snap = RT.getState().snapshot; if (!snap) return;
  const top = candidates(), zod = engineFn('truncatedZodiac'), q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const head = ['Rank', 'Birth time', 'Day', 'Ascendant', 'MC', 'Score', 'Events explained', ...snap.events.map((e, i) => (e.monthOnly ? e.date.slice(0, 7) : e.date) + ' ' + ruleName(e.category) + (state.events[i]?.description ? ' (' + state.events[i].description + ')' : ''))];
  const rows = top.map((r, i) => { const s = score(r), c = clock(r.seconds);
    return [i + 1, c.time, c.day || 'birth date', zod(r.ascendant), zod(r.midheaven), s.points, s.witnessed + ' of ' + snap.totalScoring,
      ...snap.events.map(ev => { const x = (order === 'combined' ? r.combined : r).evidence.find(v => v.id === ev.id); return x && x.points > 0 ? 'yes · ' + x.points + ' pts' : 'no'; })]; });
  const meta = [['Ranked by', order === 'combined' ? 'Directions + progressions + returns (Polaris2 Combined)' : 'Primary directions (Polaris2 TPD rank)'], ['Name', state.name], ['Birth date', state.birthDate], ['Place', state.place], ['Search', snap.data.start + ' to ' + snap.data.end]];
  const text = '﻿' + [...meta, [], head, ...rows].map(r => r.map(q).join(',')).join('\r\n');
  download(text, 'text/csv;charset=utf-8', fileBase() + '_Best_Birth_Times.csv');
}
function adoptEngineCase() {
  // Read a case back from the engine after openProject or its sample.
  const d = RT.formData(), st = RT.getState();
  const coord = (t, isLat) => engineFn('PDCore').coordinateValue(t, isLat);
  const lat = coord(d.lat, true), lonE = coord(d.lon, false); // the engine returns east-positive degrees
  const toSec = (t, day) => { const [h, m, s] = t.split(':').map(Number); return h * 3600 + m * 60 + (s || 0) + Number(day || 0) * 86400; };
  const a = toSec(d.start, d.startDay), b = toSec(d.end, d.endDay), mid = Math.round((a + b) / 2), half = Math.max(1, Math.round((b - a) / 120));
  const t = ((mid % 86400) + 86400) % 86400;
  rules = JSON.parse(JSON.stringify(st.rules));
  base = { ...d };
  state = { ...blank(), name: d.name, birthDate: d.birthDate, place: d.place, lat: String(+Math.abs(lat).toFixed(5)), latH: lat < 0 ? 'S' : 'N', lon: String(+Math.abs(lonE).toFixed(5)), lonH: lonE < 0 ? 'W' : 'E',
    basis: d.basis, offset: d.offset, time: pad(Math.floor(t / 3600)) + ':' + pad(Math.floor(t % 3600 / 60)), unc: half,
    events: st.events.filter(e => e.use && e.mode === 'score').map(e => ({ date: e.monthOnly ? e.date.slice(0, 7) : e.date, monthOnly: !!e.monthOnly, category: e.category, description: e.description || '' })) };
  const skipped = st.events.filter(e => !(e.use && e.mode === 'score')).length;
  buildCategories(); fill(); renderEvents(); save(); updateButtons(); $('results').hidden = true;
  return skipped;
}
async function openCase(file) {
  fail('');
  try {
    const text = await file.text(); RT.openProject(text);
    const skipped = adoptEngineCase();
    toast('Case opened' + (skipped ? ` · ${skipped} unused or validation-only event${skipped === 1 ? '' : 's'} left out` : '') + '. Its Polaris2 settings are kept.');
  } catch (err) { fail('This file could not be opened as a Polaris2 case: ' + (err.message || err)); }
}

/* ---------- Form wiring ---------- */
function fill() {
  for (const k of ['name', 'birthDate', 'place', 'lat', 'latH', 'lon', 'lonH', 'basis', 'offset', 'time']) if (document.activeElement !== $(k)) $(k).value = state[k] ?? '';
  $('offset').disabled = state.basis === 'lmt'; placeBox(); renderRange();
}
for (const k of ['name', 'birthDate', 'lat', 'latH', 'lon', 'lonH', 'basis', 'offset', 'time']) {
  $(k).addEventListener('input', () => { state[k] = $(k).value; if (k === 'basis') $('offset').disabled = state.basis === 'lmt'; placeBox(); renderRange(); save(); });
  $(k).addEventListener('change', () => { if (['birthDate', 'time'].includes(k) && state.tz) suggestOffset(); });
}
$('place').addEventListener('input', () => { state.place = $('place').value; save(); clearTimeout(cityTimer); cityTimer = setTimeout(citySearch, 200); });
document.addEventListener('click', e => { if (!e.target.closest('.city')) $('cityList').hidden = true; });
$('unc').addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (!b) return; state.unc = Number(b.dataset.m); renderRange(); save(); });
$('evAdd').onclick = addEvent;
$('events').addEventListener('click', e => { const b = e.target.closest('[data-del]'); if (!b) return; state.events.splice(+b.dataset.del, 1); renderEvents(); save(); });
$('evImportBtn').onclick = () => { $('importBox').hidden = !$('importBox').hidden; };
$('importGo').onclick = () => {
  fail('');
  try {
    const rows = RT.parseTable($('importText').value);
    if (!rows.length) throw Error('Paste at least one row.');
    const h = rows[0].map(x => x.trim().toLowerCase()), header = h.includes('date') && h.includes('category');
    const ix = header ? { d: h.indexOf('date'), c: h.indexOf('category'), n: h.indexOf('description') } : { d: 0, c: 1, n: 2 };
    const add = rows.slice(header ? 1 : 0).map((row, i) => {
      const d = (row[ix.d] || '').trim(), name = (row[ix.c] || '').trim(), rule = rules.find(r => r.name.toLowerCase() === name.toLowerCase());
      if (!/^\d{4}-\d{2}(-\d{2})?$/.test(d)) throw Error(`Row ${i + 1}: use a date like 1989-09-19 or 1989-09.`);
      if (!rule || !rule.enabled) throw Error(`Row ${i + 1}: unknown category “${name}”. Use a name from the “What happened” list.`);
      return { date: d, monthOnly: d.length === 7, category: rule.id, description: (ix.n >= 0 ? row[ix.n] : '') || '' };
    });
    state.events.push(...add); state.events.sort((a, b) => a.date.localeCompare(b.date));
    $('importText').value = ''; $('importBox').hidden = true; renderEvents(); save(); toast('Added ' + add.length + ' event' + (add.length === 1 ? '' : 's') + '.');
  } catch (err) { fail(err.message || String(err)); }
};
$('runBtn').onclick = run;
$('cancelBtn').onclick = () => { try { E.document.getElementById('cancel').click(); } catch (e) {} };
$('sampleBtn').onclick = () => { fail(''); RT.sample(); adoptEngineCase(); base = null; save(); toast('Example loaded: the Polaris2 sample case.'); };
$('clearBtn').onclick = () => { state = blank(); base = null; if (RT) { rules = JSON.parse(JSON.stringify(RT.getState().rules)); try { RT.openProject(JSON.stringify({ format: 'topocentric-rectification-project', version: 2, data: defaults, events: [], rules })); } catch (e) {} } $('results').hidden = true; fail(''); fill(); renderEvents(); save(); };
$('openFile').onchange = e => { if (e.target.files[0]) openCase(e.target.files[0]); e.target.value = ''; };
document.querySelector('.order').addEventListener('click', e => { const b = e.target.closest('[data-order]'); if (!b) return; order = b.dataset.order; selected = null; showResults(); });
$('cands').addEventListener('click', e => { const b = e.target.closest('[data-sec]'); if (!b) return; selected = Number(b.dataset.sec); showResults(); });
$('saveCase').onclick = saveCase;
$('exportCsv').onclick = exportCsv;
$('openFull').onclick = () => {
  if (parent !== window && parent.AWOpenWithProject) parent.AWOpenWithProject('Polaris2', JSON.stringify(lastProject || project()));
  else toast('Save the case, then open it in Polaris2 with “Open project”.');
};

/* ---------- Start ---------- */
try { const d = JSON.parse(localStorage.getItem(DRAFT) || 'null'); if (d && d.state) { state = { ...blank(), ...d.state }; base = d.base || null; } } catch (e) {}
fill(); renderEvents(); updateButtons(); startEngine();
