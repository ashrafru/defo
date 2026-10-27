set -x
mkdir -p /tmp/emu
APK=$(ls signed/*.apk | head -1)
adb install -r "$APK" > /tmp/emu/install.txt 2>&1
adb shell monkey -p nz.co.ashnet.astrologersworkbench -c android.intent.category.LAUNCHER 1
sleep 25
adb exec-out screencap -p > /tmp/emu/1-launch.png
tap_text () {
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1; adb pull /sdcard/ui.xml /tmp/emu/ui.xml >/dev/null 2>&1
  B=$(python3 - "$1" <<'PY'
import re,sys
s=open('/tmp/emu/ui.xml',encoding='utf-8',errors='ignore').read()
for m in re.finditer(r'<node [^>]*>',s):
    n=m.group()
    if ('text="%s"'%sys.argv[1]) in n or ('content-desc="%s"'%sys.argv[1]) in n:
        b=re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"',n)
        if b:
            x1,y1,x2,y2=map(int,b.groups()); print((x1+x2)//2,(y1+y2)//2); break
PY
)
  echo "tap $1 at $B"; [ -n "$B" ] && adb shell input tap $B
}
tap_text "Polaris2"
sleep 40
adb exec-out screencap -p > /tmp/emu/2-polaris2.png
adb shell input keyevent KEYCODE_BACK; sleep 3
tap_text "PSSR Aspects"
sleep 35
adb exec-out screencap -p > /tmp/emu/3-pssr.png
adb shell input keyevent KEYCODE_BACK; sleep 2; adb shell input keyevent KEYCODE_BACK; sleep 2
adb exec-out screencap -p > /tmp/emu/4-back.png
adb logcat -d | grep -iE "chromium|Capacitor|console|AndroidRuntime|FATAL" | tail -150 > /tmp/emu/logcat.txt
exit 0
