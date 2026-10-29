set -x
mkdir -p /tmp/emu
PKG=nz.co.ashnet.astrologersworkbench
APK=$(ls signed/*.apk | head -1)
adb install -r "$APK" > /tmp/emu/install.txt 2>&1
sleep 20
adb shell monkey -p $PKG -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1; sleep 25
echo "release launch pid=$(adb shell pidof $PKG)" >> /tmp/emu/steps.txt
adb exec-out screencap -p > /tmp/emu/1-release-launch.png
# Debug build: same app, WebView debugging on, driven over DevTools
adb uninstall $PKG >> /tmp/emu/steps.txt 2>&1
adb install -r test/app-debug.apk >> /tmp/emu/install.txt 2>&1
for try in 1 2 3; do adb shell monkey -p $PKG -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1; sleep 30; [ -n "$(adb shell pidof $PKG | tr -d '\r')" ] && break; echo "debug launch retry $try" >> /tmp/emu/steps.txt; done
PID=$(adb shell pidof $PKG | tr -d '\r')
SOCK=$(adb shell cat /proc/net/unix | tr -d '\r' | grep -o "webview_devtools_remote_$PID" | head -1)
echo "debug pid=$PID socket=$SOCK" >> /tmp/emu/steps.txt
adb forward tcp:9222 localabstract:$SOCK
adb push test/charts-test.awbdb /sdcard/Download/charts-test.awbdb >/dev/null 2>&1 || true
timeout 2400 node .github/cdp-test.js > /tmp/emu/cdp.txt 2>&1
adb exec-out screencap -p > /tmp/emu/9-end.png
adb shell 'ls -la "/sdcard/Documents/Astrologers Workbench/"' >> /tmp/emu/steps.txt 2>&1
adb logcat -d -b crash > /tmp/emu/crash.txt
exit 0
