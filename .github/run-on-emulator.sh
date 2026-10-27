set -x
mkdir -p /tmp/emu
APK=$(ls signed/*.apk | head -1)
adb install -r "$APK" > /tmp/emu/install.txt 2>&1
adb shell cat /proc/meminfo | head -3 > /tmp/emu/meminfo.txt
adb shell dumpsys package com.google.android.webview | grep versionName | head -2 >> /tmp/emu/meminfo.txt
launch () { adb shell monkey -p nz.co.ashnet.astrologersworkbench -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1; sleep 15; }
tap () {
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1; adb pull /sdcard/ui.xml /tmp/emu/ui-$2.xml >/dev/null 2>&1
  B=$(python3 - "$1" /tmp/emu/ui-$2.xml <<'PY'
import re,sys
s=open(sys.argv[2],encoding='utf-8',errors='ignore').read(); t=sys.argv[1]
for m in re.finditer(r'<node [^>]*>',s):
    n=m.group(); tx=re.search(r' text="([^"]*)"',n).group(1); cd=re.search(r'content-desc="([^"]*)"',n).group(1)
    if t in (tx, cd, '★ '+tx) or tx=='★ '+t or tx.startswith(t+'. ') or cd.startswith(t+'. '):
        x1,y1,x2,y2=map(int,re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"',n).groups()); print((x1+x2)//2,(y1+y2)//2); break
PY
)
  echo "$2: tap '$1' at '$B'" >> /tmp/emu/steps.txt; [ -n "$B" ] && adb shell input tap $B
}
check () { P=$(adb shell pidof nz.co.ashnet.astrologersworkbench); echo "$1: pid=$P" >> /tmp/emu/steps.txt; adb exec-out screencap -p > /tmp/emu/$1.png; }
adb logcat -c
launch; check 1-launch
tap "The Sieve" a; sleep 30; check 2-medium
adb shell input keyevent KEYCODE_BACK; sleep 3
tap "Central Scrutinizer" b; sleep 40; check 3-mid-large
adb shell input keyevent KEYCODE_BACK; sleep 3
tap "Polaris2" c; sleep 45; check 4-large
adb logcat -d -b crash > /tmp/emu/crash.txt; adb logcat -d -b all > /tmp/emu/all.txt
grep -iE "astrologers|lowmemory|lmkd|Killing|FATAL|RenderProcess|Capacitor|chromium"  /tmp/emu/all.txt | grep -v simple_ | tail -200 > /tmp/emu/logcat.txt
rm /tmp/emu/all.txt
exit 0
