THE ASTROLOGERS' WORKBENCH 2.0.1 | MOBILE EDITION
36 modules | iPhone, iPad, Android phones and tablets | installable web app

WHAT THIS IS
The complete workbench as a web app that installs to the home screen and works
offline. The 36 original HTML tools are unchanged: they are stored as compressed,
deduplicated parts (64 MB instead of 270 MB) and rebuilt on the device byte for
byte. Each tool is checked against its SHA-256 checksum before it opens.

PUT IT ONLINE (once)
Upload the contents of this folder to any web space served over HTTPS, for example
a folder on your own website (cPanel File Manager), GitHub Pages, Cloudflare Pages
or Netlify. Keep the folder structure. No server software, database or build step
is needed. Opening index.html straight from a file on a phone will not work: it
must be served over https (or http://localhost for testing).

INSTALL ON A PHONE
Android (Chrome): open the address, then More > Install app (or browser menu >
Install app / Add to Home screen).
iPhone / iPad (Safari): open the address, tap Share > Add to Home Screen.

USING IT
Library: tap a tool to open it. Star tools to pin them at the top.
Open: switch between running tools. Each keeps its inputs and results.
Compare: two tools at once, stacked when upright, side by side when turned.
Drag the bar between them to resize.
Tool bar: zoom (50-150%), and the ... menu for New copy, Print, Reload, Close.
More: User Manual, Quick Reference, offline storage, install, help, licences.
A tool is saved on the device the first time it opens. More > Save all tools
offline stores the full suite (about 64 MB).
Save or export inside each tool before closing it, as on the desktop.
Calculations run on the device. City lookups and external links need internet.

UPDATING A MODULE
Put the new HTML files in a copy of _internal/modules, then run
  python tools/pack-modules.py <modules folder> m
from this folder, and upload the new m folder. Raise VERSION in sw.js so
installed copies pick up the new app files.

CREDITS AND LICENCES
By James Alexander in collaboration with Isaac Starkman and Juan Estadella.
Original tools: James Alexander, https://james-alexander.de/
The launcher (index.html, app.js, app.css, loader.js, sw.js) is AGPL-3.0-or-later,
like the desktop controller. See licences.html and the licenses folder.
