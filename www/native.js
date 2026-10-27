/* Astrologers' Workbench Mobile — Android app bridge. AGPL-3.0-or-later.
   Inactive in a normal browser. Inside the Android app it makes tool exports save to
   Documents/Astrologers Workbench, opens PDFs and web links outside the app, and
   handles the Back button. */
(function () {
  'use strict';
  const C = window.Capacitor;
  const native = !!(C && C.isNativePlatform && C.isNativePlatform());
  window.AW_NATIVE = native;
  if (!native) { window.AWNative = { hookFrame() {}, native: false }; return; }
  const P = C.Plugins;
  const FOLDER = 'Astrologers Workbench';

  const b64 = blob => new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1] || ''); r.onerror = () => bad(r.error); r.readAsDataURL(blob); });
  const safeName = n => (String(n || 'export').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim() || 'export').slice(0, 150);

  async function saveBlob(blob, name) {
    name = safeName(name);
    const data = await b64(blob);
    let uri = null, where = null;
    try {
      const r = await P.Filesystem.writeFile({ path: FOLDER + '/' + name, data, directory: 'DOCUMENTS', recursive: true });
      uri = r.uri; where = 'Documents › ' + FOLDER;
    } catch (e) {
      const r = await P.Filesystem.writeFile({ path: 'exports/' + name, data, directory: 'CACHE', recursive: true });
      uri = r.uri;
    }
    window.AWSaved && window.AWSaved(name, where, () => P.Share.share({ title: name, files: [uri] }).catch(() => {}));
    if (!where) P.Share.share({ title: name, files: [uri] }).catch(() => {});
  }

  async function openPdf(href) {
    const url = new URL(href, location.href); const name = url.pathname.split('/').pop();
    const blob = await (await fetch(url)).blob();
    const r = await P.Filesystem.writeFile({ path: 'guides/' + name, data: await b64(blob), directory: 'CACHE', recursive: true });
    await P.FileOpener.open({ filePath: r.uri, contentType: 'application/pdf' }).catch(() => P.Share.share({ title: name, files: [r.uri] }));
  }

  function external(href) { return /^https?:/i.test(href) && new URL(href).origin !== location.origin; }

  /* Returns true when the anchor was handled natively. */
  function handleAnchor(a, blobs, w) {
    const href = a.href || a.getAttribute('href') || '';
    if (a.hasAttribute('download') && /^(blob:|data:)/.test(href)) {
      const name = a.getAttribute('download') || 'export';
      const known = blobs && blobs.get(href);
      (known ? Promise.resolve(known) : (w || window).fetch(href).then(r => r.blob()))
        .then(b => saveBlob(b, name)).catch(err => window.AWToast && AWToast('Could not save ' + name + ': ' + (err.message || err)));
      return true;
    }
    if (external(href)) { P.Browser.open({ url: href }); return true; }
    if (/\.pdf($|[?#])/i.test(href) && new URL(href, location.href).origin === location.origin) { openPdf(href).catch(() => AWToast && AWToast('Could not open the guide.')); return true; }
    return false;
  }

  function hookWindow(w) {
    if (w.__awHooked) return; w.__awHooked = true;
    const blobs = new Map();
    const U = w.URL, create = U.createObjectURL.bind(U), revoke = U.revokeObjectURL.bind(U);
    U.createObjectURL = o => { const u = create(o); if (o instanceof w.Blob || o instanceof Blob) blobs.set(u, o); return u; };
    U.revokeObjectURL = u => setTimeout(() => { blobs.delete(u); revoke(u); }, 60000); // keep exports readable while saving
    const click = w.HTMLAnchorElement.prototype.click;
    w.HTMLAnchorElement.prototype.click = function () { if (handleAnchor(this, blobs, w)) return; return click.call(this); };
    w.document.addEventListener('click', e => { const a = e.target && e.target.closest && e.target.closest('a[href]'); if (a && handleAnchor(a, blobs, w)) e.preventDefault(); }, true);
    const open = w.open && w.open.bind(w);
    w.open = (url, ...rest) => { if (url && external(String(new URL(url, w.location.href)))) { P.Browser.open({ url: String(new URL(url, w.location.href)) }); return null; } return open ? open(url, ...rest) : null; };
  }

  hookWindow(window);
  window.AWNative = { native: true, hookFrame(frame) { try { hookWindow(frame.contentWindow); } catch (e) {} } };

  // Android Back: close the top sheet or menu, then return to the library, then ask before leaving.
  if (P.App) P.App.addListener('backButton', () => { window.AWBack ? window.AWBack() : P.App.exitApp(); });
})();
