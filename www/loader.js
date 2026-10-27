/* Astrologers' Workbench Mobile — module store.
   Each original HTML module is stored as deduplicated, gzip-compressed parts.
   This file rebuilds a module byte-for-byte and checks its SHA-256 before use.
   Shared by the page and the service worker. AGPL-3.0-or-later. */
(function (g) {
  'use strict';
  const PARTS_CACHE = 'aw-parts-v1';
  let manifestPromise = null;
  const base = () => new URL('./', g.AW_BASE || (g.location && g.location.href));

  function manifest() {
    if (!manifestPromise) {
      manifestPromise = (async () => {
        const url = new URL('m/manifest.json', base());
        let res;
        if (g.AW_NATIVE) { const r = await fetch(url); return r.json(); }
        try { res = await fetch(url, { cache: 'no-cache' }); if (!res.ok) throw Error(res.status); }
        catch (e) {
          const c = await caches.open(PARTS_CACHE); res = await c.match(url);
          if (!res) throw new Error('The tool list could not be loaded. Connect to the internet once to set up the app.');
        }
        const copy = res.clone();
        caches.open(PARTS_CACHE).then(c => c.put(url, copy)).catch(() => {});
        return res.json();
      })();
      manifestPromise.catch(() => { manifestPromise = null; });
    }
    return manifestPromise;
  }

  async function inflate(bytes) {
    if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return bytes; // server already decoded it
    if (typeof DecompressionStream === 'function') {
      const s = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
      return new Uint8Array(await new Response(s).arrayBuffer());
    }
    if (!g.fflate) {
      if (typeof importScripts === 'function') importScripts(new URL('fflate.min.js', base()).href);
      else await new Promise((ok, bad) => { const s = document.createElement('script'); s.src = new URL('fflate.min.js', base()); s.onload = ok; s.onerror = bad; document.head.append(s); });
    }
    return g.fflate.gunzipSync(bytes);
  }

  async function chunk(cache, h, i, onBytes) {
    const url = new URL('m/p/' + h + '.' + i + '.bin', base());
    if (g.AW_NATIVE) { // bundled inside the app: read straight from the package
      const r = await fetch(url); if (!r.ok) throw new Error('A tool file is missing from the app (' + r.status + ').');
      const b = new Uint8Array(await r.arrayBuffer()); onBytes && onBytes(b.length); return b;
    }
    let res = await cache.match(url);
    if (!res) {
      res = await fetch(url);
      if (!res.ok) throw new Error('Download failed (' + res.status + ').');
      await cache.put(url, res.clone());
      const b = new Uint8Array(await res.arrayBuffer()); onBytes && onBytes(b.length); return b;
    }
    const b = new Uint8Array(await res.arrayBuffer()); onBytes && onBytes(b.length, true); return b;
  }

  async function part(cache, info, h, onBytes) {
    const p = info.parts[h]; const pieces = [];
    for (let i = 0; i < p.n; i++) pieces.push(await chunk(cache, h, i, onBytes));
    const joined = pieces.length === 1 ? pieces[0] : new Uint8Array(await new Blob(pieces).arrayBuffer());
    return inflate(joined);
  }

  function hex(buf) { return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join(''); }

  /* Returns a Blob of the original module HTML. onProgress(doneBytes, totalBytes). */
  async function build(id, onProgress) {
    const info = await manifest(); const mod = info.modules[id];
    if (!mod) throw new Error('Unknown tool: ' + id);
    const cache = await caches.open(PARTS_CACHE);
    const unique = [...new Set(mod.parts)];
    const total = unique.reduce((s, h) => s + info.parts[h].gz, 0); let done = 0;
    const tick = n => { done += n; onProgress && onProgress(done, total); };
    const decoded = {};
    // Fetch up to three parts at a time.
    let next = 0;
    await Promise.all([0, 1, 2].map(async () => { while (next < unique.length) { const h = unique[next++]; decoded[h] = await part(cache, info, h, tick); } }));
    const blob = new Blob(mod.parts.map(h => decoded[h]), { type: 'text/html;charset=utf-8' });
    if (blob.size !== mod.size) throw new Error('This tool did not rebuild correctly (size check failed). Clear offline copies and try again.');
    if (g.crypto && crypto.subtle) {
      const digest = hex(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()));
      if (digest !== mod.sha256) throw new Error('This tool did not rebuild correctly (checksum failed). Clear offline copies and try again.');
    }
    return blob;
  }

  async function status() {
    const info = await manifest();
    if (g.AW_NATIVE) { const all = Object.keys(info.parts).reduce((s, h) => s + info.parts[h].gz, 0); const out = {}; for (const id in info.modules) out[id] = true; return { modules: out, total: all, stored: all }; } const cache = await caches.open(PARTS_CACHE);
    const keys = new Set((await cache.keys()).map(r => new URL(r.url).pathname.split('/').pop()));
    const have = h => { const p = info.parts[h]; for (let i = 0; i < p.n; i++) if (!keys.has(h + '.' + i + '.bin')) return false; return true; };
    const out = {};
    for (const [id, m] of Object.entries(info.modules)) out[id] = m.parts.every(have);
    const all = Object.keys(info.parts);
    return { modules: out, total: all.reduce((s, h) => s + info.parts[h].gz, 0), stored: all.filter(have).reduce((s, h) => s + info.parts[h].gz, 0) };
  }

  async function downloadAll(onProgress) {
    const info = await manifest(); const cache = await caches.open(PARTS_CACHE);
    const all = Object.keys(info.parts); const total = all.reduce((s, h) => s + info.parts[h].gz, 0); let done = 0;
    let next = 0;
    await Promise.all([0, 1, 2].map(async () => { while (next < all.length) { const h = all[next++]; for (let i = 0; i < info.parts[h].n; i++) await chunk(cache, h, i, n => { done += n; onProgress && onProgress(done, total); }); } }));
  }

  /* Android app: unpack a tool once into the app's own storage, part by part, so the
     phone never holds more than one part in memory. Each part is checked against its
     SHA-256 name; the file size is checked at the end. Returns a URL for the iframe. */
  function toB64(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  async function installNative(id, onProgress) {
    const C = g.Capacitor, FS = C.Plugins.Filesystem;
    const info = await manifest(); const mod = info.modules[id];
    if (!mod) throw new Error('Unknown tool: ' + id);
    const path = 'tools/' + id + '-' + mod.sha256.slice(0, 16) + '.html';
    try { const st = await FS.stat({ path, directory: 'DATA' }); if (Number(st.size) === mod.size) return C.convertFileSrc(st.uri); } catch (e) {}
    const total = mod.parts.reduce((s, h) => s + info.parts[h].raw, 0); let done = 0;
    const tmp = path + '.part'; let first = true;
    for (const h of mod.parts) {
      const raw = await part(null, info, h);
      if (g.crypto && crypto.subtle) {
        const d = hex(await crypto.subtle.digest('SHA-256', raw));
        if (!d.startsWith(h)) throw new Error('A part of this tool failed its checksum. Reinstall the app.');
      }
      for (let i = 0; i < raw.length; i += 3 * 1024 * 1024) {
        const data = toB64(raw.subarray(i, i + 3 * 1024 * 1024));
        if (first) { await FS.writeFile({ path: tmp, data, directory: 'DATA', recursive: true }); first = false; }
        else await FS.appendFile({ path: tmp, data, directory: 'DATA' });
      }
      done += raw.length; onProgress && onProgress(done, total);
    }
    try { await FS.deleteFile({ path, directory: 'DATA' }); } catch (e) {}
    await FS.rename({ from: tmp, to: path, directory: 'DATA', toDirectory: 'DATA' });
    const st = await FS.stat({ path, directory: 'DATA' });
    if (Number(st.size) !== mod.size) { try { await FS.deleteFile({ path, directory: 'DATA' }); } catch (e) {} throw new Error('This tool did not unpack correctly. Please try again.'); }
    return C.convertFileSrc(st.uri);
  }

  /* Makes sure every stored part of one tool is on this device, with progress. */
  async function prefetch(id, onProgress) {
    const info = await manifest(); const mod = info.modules[id];
    if (!mod) throw new Error('Unknown tool: ' + id);
    const cache = await caches.open(PARTS_CACHE); const unique = [...new Set(mod.parts)];
    const total = unique.reduce((s, h) => s + info.parts[h].gz, 0); let done = 0, next = 0;
    await Promise.all([0, 1, 2].map(async () => { while (next < unique.length) { const h = unique[next++]; for (let i = 0; i < info.parts[h].n; i++) { const url = new URL('m/p/' + h + '.' + i + '.bin', base()); if (await cache.match(url)) { done += Math.min(12e6, info.parts[h].gz - i * 12e6); onProgress && onProgress(done, total); continue; } await chunk(cache, h, i, n => { done += n; onProgress && onProgress(done, total); }); } } }));
  }

  async function clear() { await caches.delete(PARTS_CACHE); manifestPromise = null; }

  g.AWStore = { manifest, build, prefetch, installNative, status, downloadAll, clear };
})(self);
