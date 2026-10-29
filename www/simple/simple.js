/* Simple Rectification — a plain input and output screen for the Polaris2 engine.
   AGPL-3.0-or-later. Polaris2.html runs unchanged in a hidden frame. This page only
   hands it a standard Polaris2 project (the same format as its own "Save project"),
   starts its scan, and reads its ranked results. No calculation happens here. */
'use strict';
const $ = id => document.getElementById(id);
const DRAFT = 'aw.simple.draft.v1';
// Search windows: minutes either side of the best guess, or the whole birth date.
const WINDOWS = [
  { m: 5, label: '± 5 min' }, { m: 15, label: '± 15 min' }, { m: 30, label: '± 30 min' },
  { m: 60, label: '± 1 h' }, { m: 120, label: '± 2 h' },
  { m: 180, label: '6 hours' }, { m: 360, label: '12 hours' }, { m: 'day', label: '24 hours' }
];
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
    $('chartsBtn').disabled = false; try { renderCharts(); } catch (e) {}
    try { $('placeCountry').innerHTML = [...E.document.getElementById('cityCountry').options].map(o => `<option value="${esc(o.value)}">${esc(o.value ? o.textContent : 'Any country')}</option>`).join(''); } catch (e) {}
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
  const q = $('place').value.trim(), list = $('cityList'), cc = $('placeCountry').value, warn = $('placeWarn');
  if (!E?.OfflineCities || q.length < 2) { list.hidden = true; warn.hidden = true; return; }
  const found = E.OfflineCities.search(q, cc).slice(0, 12);
  const key = x => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/['’`]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const wanted = key(q.split(',')[0]), exactOnes = found.filter(c => key(c.label.split(',')[0]) === wanted), exact = exactOnes.length > 0;
  const countryOf = c => c.label.split(', ').pop(), countries = [...new Set((exact ? exactOnes : found).map(countryOf))];
  const where = cc ? ' in ' + $('placeCountry').selectedOptions[0].textContent : '';
  warn.hidden = exact && countries.length < 2;
  warn.textContent = exact ? `Places matching “${q.split(',')[0]}” exist in ${countries.length} countries (${countries.slice(0, 4).join(', ')}${countries.length > 4 ? '…' : ''}). Check the country before choosing, or set the Country filter. If the birthplace is not listed, pick the nearest town or type the coordinates under “Adjust coordinates and time zone”.`
    : found.length
    ? `No place called “${q.split(',')[0]}”${where} in the offline list. The places below only have similar names: check the country before choosing, pick the nearest town instead, or type the coordinates under “Adjust coordinates and time zone”.`
    : `No match for “${q}”${where} in the offline list. Try the nearest larger town, change the country, or type the coordinates under “Adjust coordinates and time zone”.`;
  list.innerHTML = found.length ? found.map((c, i) => { const parts = c.label.split(', '), country = parts.length > 1 ? parts.pop() : ''; return `<button type="button" role="option" data-i="${i}">${esc(parts.join(', '))}${country ? ` · <b>${esc(country)}</b>` : ''}<small>${Math.abs(c.latitude)}° ${c.latitude < 0 ? 'S' : 'N'} · ${Math.abs(c.longitudeWest)}° ${c.longitudeWest > 0 ? 'W' : 'E'} · ${esc(c.timezone || 'time zone unknown')}</small></button>`; }).join('') : '';
  list.hidden = !found.length;
  list.onclick = e => { const b = e.target.closest('[data-i]'); if (!b) return; const c = found[+b.dataset.i];
    Object.assign(state, { place: c.label, lat: String(Math.abs(c.latitude)), latH: c.latitude < 0 ? 'S' : 'N', lon: String(Math.abs(c.longitudeWest)), lonH: c.longitudeWest > 0 ? 'W' : 'E', tz: c.timezone || '' });
    list.hidden = true; warn.hidden = true; fill(); suggestOffset(); save(); };
}
function placeBox() {
  const b = $('placeBox');
  if (!state.lat || !state.lon) { b.hidden = true; return; }
  b.hidden = false;
  b.innerHTML = `${state.place ? `<span><b>${esc(state.place)}</b></span>` : ''}<span><b>${esc(state.lat)}° ${state.latH}</b>, <b>${esc(state.lon)}° ${state.lonH}</b></span><span>${state.tz ? esc(state.tz) + ' · ' : ''}${state.basis === 'lmt' ? '<b>Local mean time</b>' : 'UTC offset <b>' + esc(state.offset || '?') + '</b>'}</span>`;
}

/* ---------- Step 2: time range ---------- */
function rangeSeconds() {
  const hms = t => pad(Math.floor(t / 3600)) + ':' + pad(Math.floor(t % 3600 / 60)) + ':' + pad(t % 60);
  const step = Number((base || defaults || {}).step || 4);
  const count = span => Math.floor(span / step) + 1 + (span % step ? 1 : 0); // as the engine builds its list
  if (state.unc === 'day') return { start: '00:00:00', end: '23:59:59', startDay: '0', endDay: '0', count: count(86399), step, day: true };
  const [h, m] = (state.time || '12:00').split(':').map(Number), c = h * 3600 + m * 60, u = state.unc * 60;
  let s = c - u, e = c + u, sd = 0, ed = 0;
  if (s < 0) { s += 86400; sd = -1; } if (e >= 86400) { e -= 86400; ed = 1; }
  return { start: hms(s), end: hms(e), startDay: String(sd), endDay: String(ed), count: count(2 * u), step };
}
function durationText(r) {
  // Measured on a desktop: about 2 ms per candidate time per event; phones are slower.
  const sec = r.count * Math.max(1, state.events.length) * 0.0006;
  if (sec < 45) return '';
  const lo = Math.max(1, Math.round(sec / 60)), hi = Math.max(lo + 1, Math.round(sec * 3 / 60));
  return ` Expect about ${lo}–${hi} minutes (longer on older phones). Keep the screen on until it finishes.`;
}
function renderRange() {
  const list = WINDOWS.some(w => w.m === state.unc) ? WINDOWS : [...WINDOWS, { m: state.unc, label: '± ' + (state.unc < 60 ? state.unc + ' min' : +(state.unc / 60).toFixed(2) + ' h') }];
  $('unc').innerHTML = list.map(w => `<button type="button" data-m="${w.m}" aria-pressed="${w.m === state.unc}">${w.label}</button>`).join('');
  const r = rangeSeconds();
  $('time').disabled = !!r.day;
  $('range').innerHTML = (r.day ? `Search the whole birth date, <b>00:00:00</b> to <b>23:59:59</b>. The best guess is not used.`
    : `Search from <b>${r.start}</b>${r.startDay === '-1' ? ' (day before)' : ''} to <b>${r.end}</b>${r.endDay === '1' ? ' (day after)' : ''}.`)
    + ` ${r.count.toLocaleString()} candidate times, every ${r.step} seconds.` + durationText(r);
  const n = state.events.length, span = r.day ? 86399 : state.unc * 120, w = $('rangeWarn');
  const blocks = blocksFor(0, span, r.step).length;
  w.hidden = !(span >= 6 * 3600 - 4 && n < 15);
  w.textContent = `A ${r.day ? 'whole-day' : Math.round(span / 3600) + '-hour'} search with ${n} event${n === 1 ? '' : 's'} usually cannot single out one time: in tests, unrelated times across the day fitted the same events, and the top answer changed when events were added. If you know anything about the time (morning or evening, a family memory, a hospital note), tap a time clue above instead. More dated events also help.`;
  if (blocks > 1) $('range').innerHTML += ` Runs as ${blocks} blocks of 3 hours to keep memory low.`;
}

/* ---------- Step 3: events ---------- */
function buildCategories() {
  const sel = $('evCat'); const enabled = new Set(rules.filter(r => r.enabled).map(r => r.id));
  sel.innerHTML = '<option value="">Choose…</option>' + GROUPS.map(([g, ids]) => `<optgroup label="${esc(g)}">${ids.filter(id => enabled.has(id)).map(id => `<option value="${id}">${esc(ruleName(id))}</option>`).join('')}</optgroup>`).join('');
}
function renderEvents() {
  const list = $('events'); renderRange();
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
  $('evNote').value = ''; $('evDate').value = ''; $('evMonth').checked = false; $('evCat').value = ''; $('evFind').value = ''; $('evSugg').innerHTML = '';
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

/* ---------- Run ----------
   Windows wider than 3 hours run as consecutive 3-hour blocks on the same 4-second grid.
   Each candidate time's TPD score is computed independently of the other times, so the merged
   TPD ranking equals one long scan; blocks only keep the engine's memory use small. */
let OUT = null, cancelReq = false;
const hmsS = t => { t = ((t % 86400) + 86400) % 86400; return pad(Math.floor(t / 3600)) + ':' + pad(Math.floor(t % 3600 / 60)) + ':' + pad(t % 60); };
const DISTINCT = 23; // Polaris2 groups times closer than this many seconds
function updateButtons() { $('runBtn').disabled = !RT || running; $('sampleBtn').disabled = !RT || running; $('cancelBtn').hidden = !running; }
function spanOf() {
  const r = rangeSeconds(), toS = (t, d) => { const [h, m, x] = t.split(':').map(Number); return h * 3600 + m * 60 + x + Number(d) * 86400; };
  return { s: toS(r.start, r.startDay), e: toS(r.end, r.endDay), step: r.step };
}
function blocksFor(s, e, step) {
  const size = step * Math.round(10800 / step), out = [];
  if (e - s <= size) return [[s, e]];
  for (let b = s; b <= e; b += size) out.push([b, Math.min(b + size - step, e)]);
  out[out.length - 1][1] = e;                                   // the last block always ends exactly where a single scan would
  if (out.length > 1 && out[out.length - 1][0] >= e) { out.pop(); out[out.length - 1][1] = e; } // no one-time tail block
  return out;
}
function projectRange(s, e) { const p = project(); Object.assign(p.data, { start: hmsS(s), end: hmsS(e), startDay: String(Math.floor(s / 86400)), endDay: String(Math.floor(e / 86400)) }); return p; }
function scanOnce(proj, onProgress) {
  return new Promise((resolve, reject) => {
    try { RT.openProject(JSON.stringify(proj)); RT.startScan(); } catch (err) { reject(err); return; }
    const doc = E.document;
    if (!doc.getElementById('scan').disabled) { reject(Error(doc.getElementById('status').textContent || 'The engine could not start the scan.')); return; }
    const iv = setInterval(() => {
      onProgress(Number(doc.getElementById('progress').value), doc.getElementById('status').textContent);
      const snap = RT.getState().snapshot;
      if (snap && snap.state) { clearInterval(iv); resolve(snap); }
    }, 500);
  });
}
function norm1(r, snap) {
  const ids = snap.events.map(e => e.id), hit = engineFn('hitText');
  const ev = layer => layer && layer.evidence ? ids.map(id => +(layer.evidence.find(x => x.id === id)?.points || 0)) : null;
  return { seconds: r.seconds, points: r.points, witnessed: r.witnessed, hits: r.hits, multi: r.multi, asc: r.ascendant, mc: r.midheaven, partility: r.partility && Number.isFinite(r.partility.mean) ? { mean: r.partility.mean } : undefined,
    tpd: ids.map(id => { const x = r.evidence.find(v => v.id === id); return x ? { points: x.points, n: x.groups.length, hits: x.groups.slice(0, 3).map(g => hit(g.hit)) } : { points: 0, n: 0, hits: [] }; }),
    sec: ev(r.secondary), pssr: ev(r.pssr), shortlisted: !!(r.secondary || r.pssr),
    comb: r.combined ? { points: r.combined.points, witnessed: r.combined.witnessed, ev: ev(r.combined) } : null };
}
const tpdCompare = (a, b) => b.points - a.points || b.witnessed - a.witnessed || b.hits - a.hits || b.multi - a.multi || a.seconds - b.seconds; // Polaris2's ScoreEngine.compare
function distinctOf(list) { // Polaris2's own distinct grouping (it uses each time's projected partility time)
  const dc = engineFn('distinctCandidates'); if (dc) return dc(list);
  const out = []; for (const c of list) if (out.every(o => Math.abs(o.seconds - c.seconds) > DISTINCT)) out.push(c); return out;
}
async function run() {
  fail(''); const problem = check(); if (problem) return fail(problem);
  const { s, e, step } = spanOf(), blocks = blocksFor(s, e, step);
  lastProject = projectRange(s, e);
  running = true; cancelReq = false; selected = null; OUT = null; updateButtons(); $('results').hidden = true; $('meter').hidden = false; keepAwake(true);
  const t0 = Date.now(), light = [], detail = new Map(); let first = null, endState = 'complete', msg = '';
  try {
    for (let i = 0; i < blocks.length; i++) {
      const [bs, be] = blocks[i];
      const snap = await scanOnce(blocks.length === 1 ? lastProject : projectRange(bs, be), (p, text) => {
        const el = (Date.now() - t0) / 1000;
        $('meter').firstElementChild.style.width = ((i + p) / blocks.length * 100) + '%';
        $('status').textContent = (blocks.length > 1 ? `Block ${i + 1} of ${blocks.length} (${hmsS(bs)}–${hmsS(be)}) · ` : '') + text + (el >= 10 ? ` · ${Math.floor(el / 60)}:${pad(Math.floor(el % 60))} elapsed` : '');
      });
      if (snap.state === 'error') { endState = 'error'; msg = snap.stopMessage || ''; break; }
      const g = RT.getState(), dc = engineFn('displayCandidates');
      E.document.getElementById('candidateDisplay').value = 'distinct';
      if (!first) first = { data: { ...snap.data }, events: snap.events.map(x => ({ date: x.date, monthOnly: !!x.monthOnly, category: x.category, description: x.description })), totalScoring: snap.totalScoring };
      const tpdList = dc('tpd'), combList = dc('combined').filter(r => r.combined).sort((a, b) => a.combined.rank - b.combined.rank);
      for (const r of [...tpdList.slice(0, blocks.length === 1 ? 60 : 15), ...g.results.filter(x => x.combined)]) if (!detail.has(r.seconds)) detail.set(r.seconds, norm1(r, snap));
      for (const r of g.results) light.push({ seconds: r.seconds, points: r.points, witnessed: r.witnessed, hits: r.hits, multi: r.multi, asc: r.ascendant, mc: r.midheaven, partility: r.partility && Number.isFinite(r.partility.mean) ? { mean: r.partility.mean } : undefined });
      if (blocks.length === 1) { first.tpdOrder = tpdList.map(r => r.seconds); first.tpdScores = tpdList.map(r => r.points); first.combOrder = combList.map(r => r.seconds); }
      if (snap.state === 'cancelled' || cancelReq) { endState = 'cancelled'; break; }
    }
  } catch (err) { fail(err.message || String(err)); endState = 'failed'; }
  running = false; keepAwake(false); updateButtons(); $('meter').hidden = true;
  if (endState === 'failed' || !first) return;
  if (endState === 'error') return fail('The scan stopped: ' + (msg || E.document.getElementById('status').textContent));
  let tpdOrder = first.tpdOrder, tpdScores = first.tpdScores, combOrder = first.combOrder;
  if (blocks.length > 1) {
    const d = distinctOf(light.slice().sort(tpdCompare));
    tpdOrder = d.map(c => c.seconds); tpdScores = d.map(c => c.points);
    combOrder = distinctOf([...detail.values()].filter(c => c.comb).sort((a, b) => b.comb.points - a.comb.points || b.comb.witnessed - a.comb.witnessed || tpdCompare(a, b))).map(c => c.seconds);
  }
  const lightBy = new Map(light.map(c => [c.seconds, c]));
  OUT = { ...first, scanned: light.length, blocks: blocks.length, detail, lightBy, tpdOrder, tpdScores, combOrder, span: e - s, state: endState };
  $('status').textContent = (endState === 'cancelled' ? 'Stopped early: ' : 'Complete: ') + light.length.toLocaleString() + ' candidate times' + (blocks.length > 1 ? ` in ${blocks.length} blocks of 3 hours` : '') + ` · ${first.totalScoring} events · ${Math.round((Date.now() - t0) / 1000)} s.`;
  if (endState === 'cancelled') toast('Stopped. Results cover only the part of the range already scanned.');
  showResults(); $('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && navigator.wakeLock) wakeLock = await navigator.wakeLock.request('screen');
    else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) { wakeLock = null; }
}

/* ---------- Results ---------- */
function cand(sec) { return OUT.detail.get(sec) || { ...OUT.lightBy.get(sec), missing: true }; }
function candidates() { return (order === 'combined' ? OUT.combOrder : OUT.tpdOrder).slice(0, 5).map(cand); }
function score(r) { return order === 'combined' ? r.comb : r; }
function confidence() {
  const scores = order === 'combined' ? OUT.combOrder.slice(0, 50).map(s => cand(s).comb?.points || 0) : OUT.tpdScores.slice(0, 50);
  const n = OUT.totalScoring, s1 = scores[0] || 0, s2 = scores[1] || 0, gap = s1 ? (s1 - s2) / s1 : 0;
  const near = scores.filter(x => x >= 0.95 * s1).length, wide = OUT.span >= 6 * 3600 - 4, pts = [];
  pts.push(gap < 0.05 ? `#1 is only ${Math.round(gap * 100)}% ahead of #2.` : `#1 is ${Math.round(gap * 100)}% ahead of #2.`);
  if (near >= 3) pts.push(`${near} different times score within 5% of the best.`);
  if (n < 6) pts.push(`Only ${n} events: too few to tell times apart reliably. Aim for 10–15 dated events.`);
  else if (n < 10) pts.push(`${n} events: more dated events would make this firmer.`);
  if (wide) pts.push(n < 15 ? 'Wide search: over many hours, unrelated times can fit the same events. A rough time clue narrows it more than extra events do.'
    : 'Wide search: over many hours the leading time can change when events are added or removed. Confirm it with a narrower search around it.');
  pts.push('Treat these as candidates to check against what you know, not a proven birth time.');
  const level = (n < 6 || gap < 0.05 || near >= 3 || (wide && n < 10)) ? 'low' : (gap < 0.12 || n < 10 || wide) ? 'mid' : 'high';
  const title = { low: 'Low confidence: several times fit almost equally well', mid: 'Moderate confidence', high: 'Clearer leader' }[level];
  $('confidence').className = 'confidence ' + level;
  $('confidence').innerHTML = `<b>${title}</b><ul>${pts.map(p => '<li>' + esc(p) + '</li>').join('')}</ul>`;
}
function showResults() {
  if (!OUT) return;
  const top = candidates(), zod = engineFn('truncatedZodiac');
  $('results').hidden = false;
  $('resMeta').textContent = OUT.totalScoring + ' events · ' + OUT.scanned.toLocaleString() + ' times scanned' + (OUT.blocks > 1 ? ' in ' + OUT.blocks + ' blocks' : '');
  document.querySelectorAll('[data-order]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.order === order)));
  if (!top.length) { $('confidence').className = 'confidence'; $('confidence').innerHTML = ''; $('cands').innerHTML = '<p class="empty">No candidate has a score in this order. Try Primary directions.</p>'; $('checks').innerHTML = ''; return; }
  confidence();
  if (selected === null || !top.some(r => r.seconds === selected)) selected = top[0].seconds;
  const best = score(top[0]).points || 1;
  $('cands').innerHTML = top.map((r, i) => { const sc = score(r), c = clock(r.seconds);
    return `<button class="cand" type="button" data-sec="${r.seconds}" aria-pressed="${r.seconds === selected}"><span class="rk">#${i + 1}</span><span class="t">${c.time}${c.day ? `<small>${c.day}</small>` : ''}</span><span class="ang">Asc ${esc(zod(r.asc))} · MC ${esc(zod(r.mc))}</span><span class="sc">Score ${sc.points} · explains ${sc.witnessed} of ${OUT.totalScoring}<span class="bar" aria-hidden="true"><i style="width:${Math.max(4, sc.points / best * 100)}%"></i></span></span></button>`; }).join('');
  showChecks(cand(selected));
  const d = OUT.data;
  $('engineNote').textContent = `Calculated by the unchanged Polaris2 engine (${d.scoringMode === 'binary' ? 'equal-hit' : 'Polaris weighted'} scoring, TPD orbs ${d.tpdConjOppOrb}′ / ${d.tpdOtherOrb}′, ${d.step}-second steps). Times closer than ${DISTINCT} seconds are grouped, as in Polaris2’s distinct list. “Directions + progressions + returns” adds ${Number(d.combinedSecondaryPercent)}% of the Secondaries score and ${Number(d.combinedPssrPercent)}% of the PSSR score to the TPD score, for Polaris2’s shortlisted times only.` +
    (OUT.blocks > 1 ? ` This wide search ran as ${OUT.blocks} blocks of 3 hours to keep memory low on phones. Each time’s directions score does not depend on other times, so that ranking is the same as one long scan; the combined score is compared across each block’s shortlist.` : '');
}
function showChecks(r) {
  if (!r) return;
  const c = clock(r.seconds);
  $('checkTitle').textContent = 'Which events ' + c.time + ' explains';
  if (r.missing) { $('checks').innerHTML = '<p class="empty">Event details were not kept for this time. Use “Open in full Polaris2” to see them.</p>'; return; }
  $('checks').innerHTML = OUT.events.map((ev, i) => {
    const tpd = r.tpd[i] || { points: 0, n: 0, hits: [] }, sec = r.sec?.[i] || 0, pssr = r.pssr?.[i] || 0, comb = r.comb?.ev?.[i] || 0;
    const yes = order === 'combined' ? comb > 0 : tpd.points > 0;
    const local = state.events[i], note = local?.description || ev.description || '';
    const date = ev.monthOnly ? ev.date.slice(0, 7) : ev.date;
    const sys = r.shortlisted ? `<div class="sys"><span class="${tpd.points > 0 ? 'on' : ''}">Directions${tpd.points > 0 ? ' ✓' : ''}</span><span class="${sec > 0 ? 'on' : ''}">Secondaries${sec > 0 ? ' ✓' : ''}</span><span class="${pssr > 0 ? 'on' : ''}">Solar returns${pssr > 0 ? ' ✓' : ''}</span></div>` : '';
    return `<div class="chk ${yes ? 'yes' : 'no'}"><span class="m" aria-label="${yes ? 'Explained' : 'Not explained'}">${yes ? '✓' : '✗'}</span><span class="h"><span>${esc(date)}</span>${esc(ruleName(ev.category))}</span><span class="s">${esc(note)}${tpd.n ? (note ? ' · ' : '') + tpd.n + ' direction' + (tpd.n === 1 ? '' : 's') + ' · ' + tpd.points + ' points' : (yes ? '' : ' No qualifying direction')}</span>${tpd.n ? `<span class="hits">${tpd.hits.map(esc).join('<br>')}${tpd.n > 3 ? '<br>+ ' + (tpd.n - 3) + ' more' : ''}</span>` : ''}${sys}</div>`;
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
  if (!OUT) return;
  const top = candidates(), zod = engineFn('truncatedZodiac'), q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const head = ['Rank', 'Birth time', 'Day', 'Ascendant', 'MC', 'Score', 'Events explained', ...OUT.events.map((e, i) => (e.monthOnly ? e.date.slice(0, 7) : e.date) + ' ' + ruleName(e.category) + (state.events[i]?.description ? ' (' + state.events[i].description + ')' : ''))];
  const rows = top.map((r, i) => { const sc = score(r), c = clock(r.seconds);
    return [i + 1, c.time, c.day || 'birth date', zod(r.asc), zod(r.mc), sc.points, sc.witnessed + ' of ' + OUT.totalScoring,
      ...OUT.events.map((ev, k) => { if (r.missing) return ''; const v = order === 'combined' ? (r.comb?.ev?.[k] || 0) : (r.tpd[k]?.points || 0); return v > 0 ? 'yes · ' + v + ' pts' : 'no'; })]; });
  const meta = [['Ranked by', order === 'combined' ? 'Directions + progressions + returns (Polaris2 Combined)' : 'Primary directions (Polaris2 TPD rank)'], ['Name', state.name], ['Birth date', state.birthDate], ['Place', state.place], ['Search', lastProject ? lastProject.data.start + ' to ' + lastProject.data.end : ''], ['Confidence', $('confidence').querySelector('b')?.textContent || '']];
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
  const t = ((mid % 86400) + 86400) % 86400, wholeDay = a === 0 && b >= 86396 && b < 86400;
  rules = JSON.parse(JSON.stringify(st.rules));
  base = { ...d };
  state = { ...blank(), name: d.name, birthDate: d.birthDate, place: d.place, lat: String(+Math.abs(lat).toFixed(5)), latH: lat < 0 ? 'S' : 'N', lon: String(+Math.abs(lonE).toFixed(5)), lonH: lonE < 0 ? 'W' : 'E',
    basis: d.basis, offset: d.offset, time: pad(Math.floor(t / 3600)) + ':' + pad(Math.floor(t % 3600 / 60)), unc: wholeDay ? 'day' : half,
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
$('unc').addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (!b) return; state.unc = b.dataset.m === 'day' ? 'day' : Number(b.dataset.m); renderRange(); save(); });
$('evAdd').onclick = addEvent;
// Everyday words -> the engine's 50 event categories. Specific phrases first.
const EVENT_WORDS = [
  [/(father|dad|grandfather|grandpa)\b.*(died|death|passed)|death of (father|dad|grandfather)/i, [11]],
  [/(mother|mum|mom|grandmother|grandma)\b.*(died|death|passed)|death of (mother|mum|mom|grandmother)/i, [12]],
  [/son\b.*(died|death)|death of (a )?son/i, [13]], [/daughter\b.*(died|death)|death of (a )?daughter/i, [14]],
  [/wife\b.*(died|death)/i, [15]], [/husband\b.*(died|death)/i, [16]], [/brother\b.*(died|death)/i, [17]], [/sister\b.*(died|death)/i, [18]],
  [/grandson/i, [5]], [/granddaughter/i, [6]],
  [/(son|daughter|child)\b.*married|child.*wedding/i, [9]],
  [/brother\b.*born|birth of (a )?brother|baby brother/i, [1]], [/sister\b.*born|birth of (a )?sister|baby sister/i, [2]],
  [/son\b.*born|birth of (a )?son|baby boy|boy born/i, [3]], [/daughter\b.*born|birth of (a )?daughter|baby girl|girl born/i, [4]],
  [/immigra|emigra|moved abroad|moved to another country|relocat|new country|refugee/i, [39, 25], 'Immigration is usually entered as Move Home. Use Travel Overseas (positive) for a good journey abroad.'],
  [/divorc|separat|split up|broke up/i, [10]],
  [/wedding|married|marriage|engag|nikah|affair|relationship began/i, [7, 8], 'Choose (M) for a man’s chart and (F) for a woman’s chart.'],
  [/retire|resign|quit|left (the |my )?job/i, [24]],
  [/fired|dismiss|sacked|failure|failed|demoted/i, [23]],
  [/new job|job|hired|employ|career|promot|business/i, [22, 40]],
  [/graduat|degree|diploma|exam|publish|book/i, [38]],
  [/success|award|won|elected|prize|honou?r/i, [21]],
  [/hospital|surgery|operation|ill|sick|disease|cancer|diagnos/i, [32]],
  [/accident|crash|injur|fell|fracture/i, [31]],
  [/attack|assault|violen|war|shot|robbed/i, [33]],
  [/arrest|jail|prison|police|court/i, [30]],
  [/army|military|conscri|mobiliz|enlist/i, [28, 40]], [/discharg|demobil|released/i, [29]],
  [/moved|move house|new home|new house|flat|apartment|bought a house/i, [39]],
  [/travel|trip|journey|holiday|vacation|hajj|umrah|pilgrim/i, [25, 26, 27]],
  [/lost money|loss|theft|stolen|bankrupt|debt/i, [35]], [/lottery|gambl|casino/i, [37, 36]],
  [/scandal|betray|intrigue|conspir|cheated/i, [34]]
];
$('evFind').addEventListener('input', () => {
  const t = $('evFind').value.trim(), box = $('evSugg');
  if (t.length < 3) { box.innerHTML = ''; return; }
  const ids = [], notes = [];
  for (const [re, list, note] of EVENT_WORDS) if (re.test(t)) { for (const id of list) if (!ids.includes(id) && rules.find(r => r.id === id)?.enabled) ids.push(id); if (note && !notes.includes(note)) notes.push(note); }
  box.innerHTML = ids.length ? ids.slice(0, 4).map(id => `<button type="button" data-cat="${id}">${esc(ruleName(id))}</button>`).join('') + notes.map(n => `<small>${esc(n)}</small>`).join('')
    : '<small>No suggestion. Pick the closest item in “What happened”.</small>';
});
$('evSugg').addEventListener('click', e => { const b = e.target.closest('[data-cat]'); if (!b) return; $('evCat').value = b.dataset.cat; $('evSugg').innerHTML = `<small>Selected: ${esc(ruleName(+b.dataset.cat))}</small>`; if (!$('evNote').value) $('evNote').value = $('evFind').value; $('evFind').value = ''; });
$('clues').addEventListener('click', e => { const b = e.target.closest('[data-clue]'); if (!b) return; state.time = pad(+b.dataset.clue) + ':00'; state.unc = 180; fill(); save(); toast('Searching ' + b.textContent + ' (a 6-hour window).'); });
$('placeCountry').addEventListener('change', () => { if ($('place').value.trim().length >= 2) citySearch(); });
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
$('cancelBtn').onclick = () => { cancelReq = true; try { E.document.getElementById('cancel').click(); } catch (e) {} };
$('sampleBtn').onclick = () => { fail(''); RT.sample(); adoptEngineCase(); base = null; save(); toast('Example loaded: the Polaris2 sample case.'); };
$('clearBtn').onclick = () => { state = blank(); base = null; if (RT) { rules = JSON.parse(JSON.stringify(RT.getState().rules)); try { RT.openProject(JSON.stringify({ format: 'topocentric-rectification-project', version: 2, data: defaults, events: [], rules })); } catch (e) {} } OUT = null; $('results').hidden = true; fail(''); fill(); renderEvents(); save(); };
$('openFile').onchange = e => { if (e.target.files[0]) openCase(e.target.files[0]); e.target.value = ''; };
document.querySelector('.order').addEventListener('click', e => { const b = e.target.closest('[data-order]'); if (!b) return; order = b.dataset.order; selected = null; showResults(); });
$('cands').addEventListener('click', e => { const b = e.target.closest('[data-sec]'); if (!b) return; selected = Number(b.dataset.sec); showResults(); });
$('saveCase').onclick = saveCase;
$('exportCsv').onclick = exportCsv;
$('openFull').onclick = () => {
  if (parent !== window && parent.AWOpenWithProject) parent.AWOpenWithProject('Polaris2', JSON.stringify(lastProject || project()));
  else toast('Save the case, then open it in Polaris2 with “Open project”.');
};


/* ---------- Saved charts ----------
   Built-in: Polaris2's own embedded chart database, loaded with its own RectificationDatabase.loadRecord.
   Mine: charts saved or imported here, kept in Central Scrutinizer's backup format (.awbdb),
   plus any people saved in Central Scrutinizer on this device (read only). */
const MY_KEY = 'aw.simple.charts.v1', CS_KEY = 'astrologers.workbench.central.database.v1';
let builtin = null, chartSrc = 'all';
const norm = x => String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const validDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d || '');
const validTime = t => /^\d{2}:\d{2}:\d{2}$/.test(t || '');
function readStore(key) { try { const d = JSON.parse(localStorage.getItem(key) || 'null'); return d && Array.isArray(d.records) ? d.records : []; } catch (e) { return []; } }
function mine() { return readStore(MY_KEY); }
function writeMine(records) {
  try { localStorage.setItem(MY_KEY, JSON.stringify({ format: 'astrologers-workbench-database', version: 1, records })); }
  catch (e) { throw Error('This device has no room left to store more charts. Export your charts, then remove some.'); }
}
function checkCase(c) {
  if (!c || c.format !== 'astrologers-workbench-case' || !c.person || !c.person.birth || !Array.isArray(c.events)) throw Error('not a chart');
  const b = c.person.birth;
  if (!validDate(b.date) || !validTime(b.recordedTime || b.time) || String(b.latitude ?? '') === '' || String(b.longitudeWest ?? '') === '') throw Error('incomplete birth data');
  return c;
}
function loadBuiltin() {
  if (builtin) return builtin;
  try {
    const html = JSON.parse(E.document.getElementById('embeddedDatabaseViewer').textContent);
    const json = /<script[^>]*id="database"[^>]*>([\s\S]*?)<\/script>/.exec(html)[1];
    builtin = JSON.parse(json).people;
  } catch (e) { builtin = []; }
  return builtin;
}
function chartRows() {
  const rows = [], seen = new Set();
  for (const r of mine()) { try { checkCase(r.case); } catch (e) { continue; } seen.add(r.id); rows.push({ kind: 'mine', id: r.id, rec: r, name: r.case.person.name, date: r.case.person.birth.date, time: r.case.person.birth.recordedTime || r.case.person.birth.time, place: r.case.person.birth.place, n: r.case.events.length }); }
  for (const r of readStore(CS_KEY)) { if (seen.has(r.id)) continue; try { checkCase(r.case); } catch (e) { continue; } rows.push({ kind: 'cs', id: r.id, rec: r, name: r.case.person.name, date: r.case.person.birth.date, time: r.case.person.birth.recordedTime || r.case.person.birth.time, place: r.case.person.birth.place, n: r.case.events.length }); }
  for (const p of loadBuiltin()) rows.push({ kind: 'builtin', id: p.id, rec: p, name: p.name, date: p.date, time: p.time, place: [p.place, p.country].filter(Boolean).join(', '), n: p.events.length });
  return rows;
}
function renderCharts() {
  const all = chartRows(), myN = all.filter(r => r.kind !== 'builtin').length, biN = all.length - myN;
  $('mineCount').textContent = myN; $('builtinCount').textContent = biN.toLocaleString();
  $('chartsCount').textContent = ` · ${myN} yours · ${biN.toLocaleString()} built-in`;
  document.querySelectorAll('[data-src]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.src === chartSrc)));
  const words = norm($('chartSearch').value).split(/\s+/).filter(Boolean);
  const list = all.filter(r => (chartSrc === 'all' || (chartSrc === 'mine' ? r.kind !== 'builtin' : r.kind === 'builtin'))
    && words.every(w => norm(r.name + ' ' + r.place + ' ' + r.id + ' ' + r.date).includes(w)))
    .sort((a, b) => (a.kind === 'builtin') - (b.kind === 'builtin') || a.name.localeCompare(b.name));
  const shown = list.slice(0, 80);
  $('chartList').innerHTML = shown.length ? shown.map((r, i) => `<div class="chart" role="listitem"><button class="open" type="button" data-chart="${i}"><b>${esc(r.name)}</b><small>${esc(r.date)} · ${esc(r.time || '')}${r.place ? ' · ' + esc(r.place) : ''} <i>· ${r.n} events</i></small><span class="tag ${r.kind === 'builtin' ? '' : 'mine'}">${r.kind === 'builtin' ? 'Database #' + esc(r.id) : r.kind === 'cs' ? 'Central Scrutinizer' : 'My chart'}</span></button>${r.kind === 'mine' ? `<button class="del" type="button" data-del-chart="${esc(r.id)}" aria-label="Delete ${esc(r.name)}">×</button>` : '<span></span>'}</div>`).join('')
    : `<p class="empty">${chartSrc === 'mine' && !myN ? 'No charts of your own on this phone yet. Import a backup from your computer, or use “Save to my charts”.' : 'No chart matches this search.'}</p>`;
  $('chartNote').textContent = list.length > shown.length ? `${list.length.toLocaleString()} matches · showing the first ${shown.length}. Type more of a name to narrow the list.` : list.length ? `${list.length.toLocaleString()} chart${list.length === 1 ? '' : 's'}.` : '';
  $('chartList').onclick = e => {
    const del = e.target.closest('[data-del-chart]');
    if (del) { const r = mine().find(x => x.id === del.dataset.delChart); if (r && confirm('Delete ' + r.case.person.name + ' from my charts on this phone?')) { writeMine(mine().filter(x => x.id !== r.id)); renderCharts(); toast('Chart deleted.'); } return; }
    const b = e.target.closest('[data-chart]'); if (b) openChart(shown[+b.dataset.chart]);
  };
}
function clockPlain(t) { t = ((t % 86400) + 86400) % 86400; return pad(Math.floor(t / 3600)) + ':' + pad(Math.floor(t % 3600 / 60)) + ':' + pad(t % 60); }
function openChart(r) {
  fail('');
  if (running) return toast('Wait for the current search to finish.');
  try {
    if (r.kind === 'builtin') {
      const p = r.rec;
      E.RectificationDatabase.loadRecord(p, p.events.map(e => e[3] === '1')); // Polaris2's own loader and default event selection
      adoptEngineCase(); state.chartId = null;
      toast(`${p.name} · chart #${p.id}. Database birth times are GMT (offset +00:00). 20-minute search around ${p.time}.`);
    } else {
      const c = r.rec.case, b = c.person.birth, [h, m, sec] = (b.recordedTime || b.time).split(':').map(Number), mid = h * 3600 + m * 60 + (sec || 0);
      const lo = mid - 600, hi = mid + 600; // the same 20-minute window Polaris2 uses for database charts
      const data = { ...defaults, name: c.person.name, birthDate: b.recordedDate && validDate(b.recordedDate) ? b.recordedDate : b.date, place: b.place || '', lat: String(b.latitude), lon: String(b.longitudeWest),
        basis: b.timeBasis === 'lmt' ? 'lmt' : 'offset', offset: b.offset || '+00:00', start: clockPlain(lo), end: clockPlain(hi), startDay: String(Math.floor(lo / 86400)), endDay: String(Math.floor(hi / 86400)) };
      const events = c.events.filter(e => validDate(e.date) && rules.some(x => x.id === Number(e.category))).map(e => ({ id: rid(), date: e.date, monthOnly: e.monthOnly === true, category: Number(e.category), description: String(e.description || ''), use: rules.find(x => x.id === Number(e.category)).enabled !== false, mode: 'score' }));
      RT.openProject(JSON.stringify({ format: 'topocentric-rectification-project', version: 2, data, events, rules }));
      adoptEngineCase(); state.chartId = r.kind === 'mine' ? r.id : null; save();
      toast(`${c.person.name} loaded · ${events.length} events. 20-minute search around ${b.recordedTime || b.time}; widen the Search window if needed.`);
    }
    $('charts').hidden = true; $('chartsBtn').setAttribute('aria-expanded', 'false'); window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) { fail('This chart could not be opened: ' + (err.message || err)); }
}
function currentCase() {
  if (!state.name.trim()) throw Error('Enter a name first.');
  if (!state.birthDate) throw Error('Enter the birth date first.');
  if (!state.lat || !state.lon) throw Error('Choose the birthplace first.');
  const t = (state.time || '12:00') + ':00';
  return { format: 'astrologers-workbench-case', version: 1,
    person: { name: state.name.trim(), birth: { date: state.birthDate, time: t, recordedTime: t, recordedDate: state.birthDate, place: state.place || '',
      latitude: (state.latH === 'S' ? '-' : '') + state.lat, longitudeWest: (state.lonH === 'W' ? '' : '-') + state.lon, offset: state.offset || '+00:00', timeBasis: state.basis === 'lmt' ? 'lmt' : 'offset' } },
    events: state.events.map(e => ({ date: e.monthOnly ? e.date.slice(0, 7) + '-15' : e.date, category: e.category, ...(e.description ? { description: e.description.slice(0, 180) } : {}), ...(e.monthOnly ? { monthOnly: true } : {}) })),
    settings: { includePP: true, includeFortune: true, ahOrbMinutes: 82 }, workspace: { eventIndex: 0, view: 'all', highlightedOnly: true, sort: 'orb' } };
}
function saveChart() {
  fail('');
  try {
    const c = currentCase(), list = mine();
    let id = state.chartId && list.some(r => r.id === state.chartId) ? state.chartId : null;
    if (!id) { const same = list.find(r => norm(r.case.person.name) === norm(c.person.name) && r.case.person.birth.date === c.person.birth.date); id = same ? same.id : 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
    c.databaseId = id;
    const updated = list.some(r => r.id === id);
    writeMine(updated ? list.map(r => r.id === id ? { id, case: c } : r) : [...list, { id, case: c }]);
    state.chartId = id; save(); renderCharts();
    toast(`${c.person.name} ${updated ? 'updated in' : 'saved to'} my charts · ${mine().length} on this phone.`);
  } catch (err) { fail(err.message || String(err)); }
}
async function importDb(file) {
  fail('');
  try {
    if (file.size > 50e6) throw Error('The file is too large (over 50 MB).');
    const raw = JSON.parse(await file.text());
    const incoming = raw.format === 'astrologers-workbench-database' && Array.isArray(raw.records) ? raw.records
      : raw.format === 'astrologers-workbench-case' ? [{ id: raw.databaseId || 'm' + Date.now().toString(36), case: raw }] : null;
    if (!incoming) throw Error('Choose a Central Scrutinizer backup (.awbdb) or case (.awb) file.');
    let bad = 0; const good = [];
    for (const r of incoming) { try { if (!/^[A-Za-z0-9_-]{1,128}$/.test(r.id)) throw 0; checkCase(r.case); good.push({ id: r.id, case: r.case }); } catch (e) { bad++; } }
    if (!good.length) throw Error('No usable charts were found in this file.');
    const list = mine(), ids = new Set(good.map(r => r.id)), updated = list.filter(r => ids.has(r.id)).length;
    writeMine([...list.filter(r => !ids.has(r.id)), ...good]);
    chartSrc = 'mine'; $('chartSearch').value = ''; renderCharts();
    toast(`Imported ${good.length} chart${good.length === 1 ? '' : 's'}${updated ? ` (${updated} updated)` : ''}${bad ? ` · ${bad} skipped (incomplete)` : ''}.`);
  } catch (err) { fail('Import failed: ' + (err.message || err)); }
}
function exportDb() {
  const rows = chartRows().filter(r => r.kind !== 'builtin');
  if (!rows.length) return toast('There are no charts of your own to export yet.');
  download(JSON.stringify({ format: 'astrologers-workbench-database', version: 1, records: rows.map(r => ({ id: r.id, case: r.rec.case })) }, null, 2), 'application/json', 'Workbench_My_Charts_' + new Date().toISOString().slice(0, 10) + '.awbdb');
}
$('chartsBtn').onclick = () => { const open = $('charts').hidden; $('charts').hidden = !open; $('chartsBtn').setAttribute('aria-expanded', String(open)); if (open) { renderCharts(); $('charts').scrollIntoView({ behavior: 'smooth', block: 'start' }); } };
$('chartsClose').onclick = () => { $('charts').hidden = true; $('chartsBtn').setAttribute('aria-expanded', 'false'); };
document.querySelector('.chart-filter').addEventListener('click', e => { const b = e.target.closest('[data-src]'); if (b) { chartSrc = b.dataset.src; renderCharts(); } });
let chartTimer = null;
$('chartSearch').addEventListener('input', () => { clearTimeout(chartTimer); chartTimer = setTimeout(renderCharts, 150); });
$('importDb').onchange = e => { if (e.target.files[0]) importDb(e.target.files[0]); e.target.value = ''; };
$('exportDb').onclick = exportDb;
$('saveChartBtn').onclick = saveChart;

/* ---------- Start ---------- */
try { const d = JSON.parse(localStorage.getItem(DRAFT) || 'null'); if (d && d.state) { state = { ...blank(), ...d.state }; base = d.base || null; } } catch (e) {}
fill(); renderEvents(); updateButtons(); startEngine();
