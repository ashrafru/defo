set -x
mkdir -p /tmp/emu
PKG=nz.co.ashnet.astrologersworkbench
APK=$(ls signed/*.apk | head -1)
adb install -r "$APK" > /tmp/emu/install.txt 2>&1
sleep 20
adb shell monkey -p $PKG -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1; sleep 25
echo "release launch pid=$(adb shell pidof $PKG)" >> /tmp/emu/steps.txt
adb exec-out screencap -p > /tmp/emu/1-release-launch.png
# Update path, as on a phone: first Simple Rectification build -> windows build -> new build
open_simple () { adb shell monkey -p $PKG -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1; sleep 25; adb shell input tap 171 495; sleep 20; adb shell input swipe 540 1900 540 700 400; sleep 2; adb shell input swipe 540 1900 540 1100 400; sleep 3; }
adb uninstall $PKG >/dev/null 2>&1
adb install test/prev1-first-simple.apk >> /tmp/emu/install.txt 2>&1; open_simple; adb exec-out screencap -p > /tmp/emu/u1-first-build.png
adb shell am force-stop $PKG
echo "update to windows build: $(adb install -r test/prev2-windows.apk 2>&1 | tail -1)" >> /tmp/emu/steps.txt; open_simple; adb exec-out screencap -p > /tmp/emu/u2-windows-build.png
adb shell am force-stop $PKG
echo "update to new build: $(adb install -r "$APK" 2>&1 | tail -1)" >> /tmp/emu/steps.txt; open_simple; adb exec-out screencap -p > /tmp/emu/u3-new-build.png
adb shell dumpsys package $PKG | grep -E "versionCode|versionName" >> /tmp/emu/steps.txt
# Debug build: same app, WebView debugging on, driven over DevTools
adb uninstall $PKG >> /tmp/emu/steps.txt 2>&1
adb install -r test/app-debug.apk >> /tmp/emu/install.txt 2>&1
adb shell monkey -p $PKG -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1; sleep 25
PID=$(adb shell pidof $PKG | tr -d '\r')
SOCK=$(adb shell cat /proc/net/unix | tr -d '\r' | grep -o "webview_devtools_remote_$PID" | head -1)
echo "debug pid=$PID socket=$SOCK" >> /tmp/emu/steps.txt
adb forward tcp:9222 localabstract:$SOCK
timeout 2400 node .github/cdp-test.js > /tmp/emu/cdp.txt 2>&1
adb exec-out screencap -p > /tmp/emu/9-end.png
adb shell 'ls -la "/sdcard/Documents/Astrologers Workbench/"' >> /tmp/emu/steps.txt 2>&1
adb logcat -d -b crash > /tmp/emu/crash.txt
exit 0
