package online.multimixmidia.celtvplay;

import android.app.Activity;
import android.os.Build;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
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
        s.setAllowFileAccessFromFileURLs(true);
        s.setAllowUniversalAccessFromFileURLs(true); // libera acesso aos servidores IPTV (sem bloqueio CORS)
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        if (Build.VERSION.SDK_INT >= 21) s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        web.setBackgroundColor(0xFF06080D);
        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient());
        web.addJavascriptInterface(new Bridge(), "AndroidApp");
        web.setFocusable(true);
        web.setFocusableInTouchMode(true);
        setContentView(web);
        hideBars();
        web.loadUrl("file:///android_asset/www/index.html");
        web.requestFocus();
    }

    private void hideBars() {
        web.setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    }

    private void js(int code) { web.evaluateJavascript("window.cpKey&&window.cpKey(" + code + ")", null); }

    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        if (e.getAction() != KeyEvent.ACTION_DOWN) {
            int k = e.getKeyCode();
            if (k == KeyEvent.KEYCODE_BACK || k == KeyEvent.KEYCODE_CHANNEL_UP || k == KeyEvent.KEYCODE_CHANNEL_DOWN
                    || k == KeyEvent.KEYCODE_PROG_RED || k == KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE) return true;
            return super.dispatchKeyEvent(e);
        }
        switch (e.getKeyCode()) {
            case KeyEvent.KEYCODE_BACK: js(10009); return true;
            case KeyEvent.KEYCODE_CHANNEL_UP: js(427); return true;
            case KeyEvent.KEYCODE_CHANNEL_DOWN: js(428); return true;
            case KeyEvent.KEYCODE_PROG_RED: js(403); return true;
            case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE: js(10252); return true;
            case KeyEvent.KEYCODE_DPAD_CENTER: js(13); return true;
        }
        return super.dispatchKeyEvent(e);
    }

    @Override
    protected void onResume() { super.onResume(); hideBars(); web.onResume(); }

    @Override
    protected void onPause() { web.onPause(); super.onPause(); }

    class Bridge {
        @JavascriptInterface
        public void exit() { runOnUiThread(new Runnable() { public void run() { finish(); } }); }
    }
}
