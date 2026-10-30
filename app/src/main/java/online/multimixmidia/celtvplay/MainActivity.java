package online.multimixmidia.celtvplay;

import android.app.Activity;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.provider.Settings;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {
    private WebView web;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        try { s.setAllowUniversalAccessFromFileURLs(true); } catch (Exception e) {}
        try { s.setAllowFileAccessFromFileURLs(true); } catch (Exception e) {}
        // Responsivo: respeita <meta viewport> (width=device-width)
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        // IGNORA o tamanho de fonte/zoom do sistema Android (evita ficar "grande")
        s.setTextZoom(100);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);

        web.addJavascriptInterface(new Bridge(), "AndroidApp");
        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient());
        web.setBackgroundColor(0xFF06080D);
        setContentView(web);
        web.loadUrl("file:///android_asset/www/index.html");
    }

    // Ponte JS: window.AndroidApp.exit() / deviceId()
    public class Bridge {
        @JavascriptInterface
        public void exit() {
            runOnUiThread(new Runnable() { public void run() { finishAndRemoveTask(); } });
        }
        @JavascriptInterface
        public String deviceId() {
            try { return "a" + Settings.Secure.getString(getContentResolver(), Settings.Secure.ANDROID_ID); }
            catch (Exception e) { return ""; }
        }
    }

    // Envia as teclas do controle (TV) para o app via window.cpKey(code)
    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (event.getAction() == KeyEvent.ACTION_DOWN && web != null) {
            int js = mapKey(event.getKeyCode());
            if (js != 0) {
                web.evaluateJavascript("window.cpKey && window.cpKey(" + js + ")", null);
                return true;
            }
        }
        return super.dispatchKeyEvent(event);
    }

    private int mapKey(int k) {
        switch (k) {
            case KeyEvent.KEYCODE_DPAD_LEFT:  return 37;
            case KeyEvent.KEYCODE_DPAD_UP:    return 38;
            case KeyEvent.KEYCODE_DPAD_RIGHT: return 39;
            case KeyEvent.KEYCODE_DPAD_DOWN:  return 40;
            case KeyEvent.KEYCODE_DPAD_CENTER:
            case KeyEvent.KEYCODE_ENTER:      return 13;
            case KeyEvent.KEYCODE_BACK:       return 10009;
            case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE: return 10252;
            case KeyEvent.KEYCODE_MEDIA_STOP: return 413;
            default: return 0;
        }
    }
}
