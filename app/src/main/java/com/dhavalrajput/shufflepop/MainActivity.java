package com.dhavalrajput.shufflepop;

import android.app.Activity;
import android.app.AlertDialog;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.RenderProcessGoneDetail;
import android.window.OnBackInvokedDispatcher;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

/** Bundled UI; network requests are restricted to the configured HTTPS room API. */
public final class MainActivity extends Activity {
    private WebView webView;
    private static final String HOST = "appassets.androidplatform.net";
    private static final String ENTRY = "https://" + HOST + "/assets/index.html";
    private static final Map<String, String> ASSETS = new HashMap<>();
    static {
        ASSETS.put("/assets/index.html", "text/html");
        ASSETS.put("/assets/engine.js", "application/javascript");
        ASSETS.put("/assets/app.js", "application/javascript");
        ASSETS.put("/assets/online.js", "application/javascript");
        ASSETS.put("/assets/api-config.js", "application/javascript");
    }
    @Override public void onCreate(Bundle savedState) {
        super.onCreate(savedState);
        createGameView();
        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::handleBack);
        }
    }
    @SuppressWarnings("SetJavaScriptEnabled")
    private void createGameView() {
        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(16, 19, 30));
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        CookieManager.getInstance().setAcceptCookie(false);
        webView.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                Uri api = Uri.parse(BuildConfig.MULTIPLAYER_API_BASE);
                if (!BuildConfig.MULTIPLAYER_API_BASE.isEmpty() && "https".equals(uri.getScheme()) &&
                    api.getAuthority().equals(uri.getAuthority()) && uri.getPath() != null && uri.getPath().startsWith("/v1/rooms/")) {
                    return null;
                }
                String mime = ASSETS.get(uri.getPath());
                if ("GET".equals(request.getMethod()) && "https".equals(uri.getScheme()) && HOST.equals(uri.getHost()) && mime != null) {
                    try {
                        java.io.InputStream stream = "/assets/api-config.js".equals(uri.getPath())
                            ? new ByteArrayInputStream(("window.SHUFFLEPOP_API_BASE = " + JSONObject.quote(BuildConfig.MULTIPLAYER_API_BASE) + ";").getBytes(StandardCharsets.UTF_8))
                            : getAssets().open(uri.getPath().substring(8));
                        WebResourceResponse response = new WebResourceResponse(mime, "UTF-8", stream);
                        Map<String, String> headers = new HashMap<>();
                        String connect = BuildConfig.MULTIPLAYER_API_BASE.isEmpty() ? "'none'" : BuildConfig.MULTIPLAYER_API_BASE;
                        headers.put("Content-Security-Policy", "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src " + connect + "; frame-src 'none'; base-uri 'none'; form-action 'none'");
                        headers.put("X-Content-Type-Options", "nosniff");
                        response.setResponseHeaders(headers);
                        return response;
                    } catch (IOException ignored) { }
                }
                return new WebResourceResponse("text/plain", "UTF-8", 403, "Blocked", Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !ENTRY.equals(request.getUrl().toString());
            }
            @Override public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                view.destroy();
                createGameView();
                return true;
            }
        });
        setContentView(webView);
        webView.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets safe = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                view.setPadding(safe.left, safe.top, safe.right, safe.bottom);
            } else {
                view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return insets;
        });
        webView.requestApplyInsets();
        webView.loadUrl(ENTRY);
    }
    private void handleBack() {
        webView.evaluateJavascript("window.Pocket ? window.Pocket.back() : false", handled -> {
            if (!"true".equals(handled)) {
                webView.evaluateJavascript("window.Pocket && window.Pocket.pause()", null);
                new AlertDialog.Builder(this).setTitle("Leave ShufflePop?")
                    .setMessage("Your game is saved on this phone.")
                    .setPositiveButton("Leave", (dialog, which) -> finish())
                    .setNegativeButton("Keep playing", (dialog, which) -> webView.evaluateJavascript("window.Pocket && window.Pocket.resume()", null))
                    .setOnCancelListener(dialog -> webView.evaluateJavascript("window.Pocket && window.Pocket.resume()", null)).show();
            }
        });
    }
    @Override public void onBackPressed() { handleBack(); }
    @Override protected void onPause() {
        if (webView != null) {
            webView.evaluateJavascript("window.Pocket && window.Pocket.pause()", null);
            webView.onPause();
        }
        super.onPause();
    }
    @Override protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.onResume();
            webView.evaluateJavascript("window.Pocket && window.Pocket.resume()", null);
        }
    }
    @Override protected void onDestroy() {
        if (webView != null) { webView.stopLoading(); webView.destroy(); webView = null; }
        super.onDestroy();
    }
}
