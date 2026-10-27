# The Astrologers' Workbench 2.0.1 — Android app

The 36 tools of The Astrologers' Workbench (by James Alexander in collaboration with
Isaac Starkman and Juan Estadella) packaged as an Android app with Capacitor.

* `www/` — the mobile launcher and the 36 original HTML tools, stored as deduplicated
  compressed parts (`www/m`). Each tool is rebuilt on the device byte for byte and
  checked against its SHA-256 checksum before it opens.
* `android/` — the Capacitor Android project.
* `.github/workflows/android.yml` — builds an unsigned release APK on every push to
  this branch and commits it to the `apk-builds` branch. Signing happens outside
  GitHub with the app's private key.

Build locally: `npm ci && npx cap sync android && cd android && ./gradlew assembleRelease`.

Licence: the launcher is AGPL-3.0-or-later. The original HTML tools keep their own
copyrights and notices (see `www/licences.html` and `www/licenses/`).
