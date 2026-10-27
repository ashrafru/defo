set -x
mkdir -p /tmp/emu
APK=$(ls signed/*.apk | head -1)
adb install -r "$APK" > /tmp/emu/install.txt 2>&1
adb shell cat /proc/meminfo | head -3 > /tmp/emu/meminfo.txt
adb shell dumpsys package com.google.android.webview | grep versionName | head -2 >> /tmp/emu/meminfo.txt
launch () { sleep 30; adb shell monkey -p nz.co.ashnet.astrologersworkbench -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1; sleep 20; }
dismiss () {
  for k in 1 2 3; do
    adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1; adb pull /sdcard/ui.xml /tmp/emu/ui-$1.xml >/dev/null 2>&1
    grep -q "isn.t responding" /tmp/emu/ui-$1.xml || return 0
    W=$(python3 -c "import re;s=open('/tmp/emu/ui-$1.xml').read();m=re.search(r'text=\"Wait\"[^>]*bounds=\"\[(\d+),(\d+)\]\[(\d+),(\d+)\]',s);print((int(m[1])+int(m[3]))//2,(int(m[2])+int(m[4]))//2) if m else print('')")
    echo "dismissed ANR at $W" >> /tmp/emu/steps.txt; [ -n "$W" ] && adb shell input tap $W; sleep 3
    adb shell monkey -p nz.co.ashnet.astrologersworkbench -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1; sleep 3
  done
}
tap () {
  dismiss $2
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
tap "Polaris2" a; sleep 60; check 2-polaris2
adb shell input keyevent KEYCODE_BACK; sleep 3
tap "The Sieve" b; sleep 30; check 3-sieve
tap "Download project" c; sleep 6; check 4-export
adb shell ls -la "/sdcard/Documents/Astrologers Workbench/" >> /tmp/emu/steps.txt 2>&1
adb shell input keyevent KEYCODE_BACK; sleep 3
tap "Central Scrutinizer" d; sleep 45; check 5-scrutinizer
adb shell input keyevent KEYCODE_BACK; sleep 3; adb shell input keyevent KEYCODE_BACK; sleep 3; check 6-leave
adb shell run-as nz.co.ashnet.astrologersworkbench ls -la files/tools >> /tmp/emu/steps.txt 2>&1
adb logcat -d -b crash > /tmp/emu/crash.txt; adb logcat -d -b all > /tmp/emu/all.txt
grep -iE "astrologers|lowmemory|lmkd|Killing|FATAL|RenderProcess|Capacitor|chromium"  /tmp/emu/all.txt | grep -v simple_ | tail -200 > /tmp/emu/logcat.txt
rm /tmp/emu/all.txt
exit 0
# rerun
