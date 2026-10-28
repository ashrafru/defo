package nz.co.ashnet.astrologersworkbench;

import android.content.SharedPreferences;
import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // After every install or update, drop the WebView's cached copies of the app's
        // pages so the new version's files are always the ones shown.
        try {
            long installed = getPackageManager().getPackageInfo(getPackageName(), 0).lastUpdateTime;
            SharedPreferences prefs = getSharedPreferences("workbench", MODE_PRIVATE);
            if (prefs.getLong("webCacheFor", -1) != installed) {
                WebView webView = getBridge().getWebView();
                webView.clearCache(true);
                prefs.edit().putLong("webCacheFor", installed).apply();
                webView.reload();
            }
        } catch (Exception ignored) {
        }
    }
}
