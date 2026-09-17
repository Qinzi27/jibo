package app.leancrew.local;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Insets;
import android.graphics.Rect;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
import android.util.AtomicFile;
import android.view.ViewGroup;
import android.view.ActionMode;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.window.OnBackInvokedCallback;
import android.window.OnBackInvokedDispatcher;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import org.json.JSONObject;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Minimal offline Android shell. All HTML/CSS/JS/images ship in assets/www.
 * No third-party runtime library or analytics. Only UpdateManager can contact GitHub.
 * Successful compilation does not replace installation and functional device testing.
 */
public final class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START = "https://" + HOST + "/assets/www/index.html";
    private static final int REQUEST_IMPORT = 41;
    private static final int REQUEST_EXPORT = 42;
    private static final int REQUEST_CAMERA = 43;
    private static final int MAX_BYTES = 4 * 1024 * 1024;
    private static final int MAX_RUNTIME_BYTES = 2048;
    private static final long MAX_PHOTO_BYTES = 32L * 1024 * 1024;
    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private AtomicFile store;
    private final Object storeLock = new Object();
    private final Object exportLock = new Object();
    private String pendingExport;
    private Uri pendingCapture;
    private SharedPreferences runtime;
    private OnBackInvokedCallback backCallback;
    private boolean backCallbackRegistered;
    private boolean handlingBack;
    private boolean keyboardVisible;
    private ActionMode selectionMode;
    private boolean webReady;
    private String pendingNotice;
    private UpdateManager updates;
    private final UpdateManager.Listener updateListener = this::dispatchUpdateState;

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        store = new AtomicFile(new File(getFilesDir(), "lean-crew-v1.json"));
        runtime = getSharedPreferences("jibo-runtime", Context.MODE_PRIVATE);
        updates = UpdateManager.get(this);
        updates.attach(updateListener);
        CameraFileProvider.pruneOldFiles(this);
        if (savedInstanceState != null) {
            String capture = savedInstanceState.getString("pendingCapture");
            if (capture != null) pendingCapture = Uri.parse(capture);
        }
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        getWindow().setStatusBarColor(Color.rgb(16, 20, 17));
        getWindow().setNavigationBarColor(Color.rgb(16, 20, 17));
        if (Build.VERSION.SDK_INT >= 30) getWindow().setDecorFitsSystemWindows(false);
        final FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(16, 20, 17));
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                int handled = WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime();
                Insets s = insets.getInsets(handled);
                v.setPadding(s.left, s.top, s.right, s.bottom);
                notifyKeyboard(insets.isVisible(WindowInsets.Type.ime()));
                // Native layout has already applied these insets. Still dispatch a zeroed
                // update so current WebViews do not add a second safe area / IME gap.
                return new WindowInsets.Builder(insets).setInsets(handled, Insets.NONE).build();
            }
            // API 26–29 use the platform's fitted content area and adjustResize.
            v.setPadding(0, 0, 0, 0);
            return insets;
        });
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(16, 20, 17));
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true); // Only trusted bundled scripts can load.
        settings.setDomStorageEnabled(false); // Native AtomicFile is used instead.
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true); // Only URIs selected in the OS document picker.
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setBlockNetworkLoads(true); // Native updater permission never opens WebView networking.
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        WebView.setWebContentsDebuggingEnabled(false);
        web.addJavascriptInterface(new LocalBridge(), "LeanNative");
        web.setWebViewClient(new WebViewClient() {
            @Override public void onPageFinished(WebView view, String url) {
                if (START.equals(url)) {
                    webReady = true;
                    dispatchKeyboardState();
                    dispatchUpdateState(updates.state());
                    if (pendingNotice != null) {
                        String text = pendingNotice;
                        pendingNotice = null;
                        notifyWeb(text);
                    }
                }
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return localAsset(request.getUrl());
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                // No untrusted page may gain access to the native bridge.
                return !isLocal(request.getUrl());
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                discardCapture();
                fileCallback = callback;
                boolean image = false;
                for (String accepted : params.getAcceptTypes()) {
                    if (accepted != null && accepted.toLowerCase(Locale.ROOT).contains("image/")) image = true;
                }
                if (image && params.isCaptureEnabled()) {
                    launchCamera();
                    return true;
                }
                if (image && Build.VERSION.SDK_INT >= 33) {
                    Intent photoPicker = new Intent(MediaStore.ACTION_PICK_IMAGES);
                    photoPicker.setType("image/*");
                    // The system picker can also expose cloud media. Request only files
                    // already on this phone; read access is limited to the selected item.
                    photoPicker.putExtra(Intent.EXTRA_LOCAL_ONLY, true);
                    try {
                        startActivityForResult(photoPicker, REQUEST_IMPORT);
                        return true;
                    } catch (ActivityNotFoundException | SecurityException unavailable) {
                        // Devices without the platform photo picker use the document picker.
                    }
                }
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType(image ? "image/*" : "*/*");
                intent.putExtra(Intent.EXTRA_LOCAL_ONLY, true);
                intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, false);
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                if (!image) intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"application/json", "text/plain", "application/octet-stream"});
                try { startActivityForResult(intent, REQUEST_IMPORT); }
                catch (ActivityNotFoundException | SecurityException error) {
                    completeFileChoice(null);
                    notifyWeb("设备没有可用的文件选择器。");
                }
                return true;
            }
        });
        root.addView(web, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(root);
        if (Build.VERSION.SDK_INT < 30) {
            root.getViewTreeObserver().addOnGlobalLayoutListener(() -> {
                Rect visible = new Rect();
                root.getWindowVisibleDisplayFrame(visible);
                int height = root.getRootView().getHeight();
                notifyKeyboard(height > 0 && height - visible.bottom > height / 5);
            });
        }
        root.requestApplyInsets();
        if (Build.VERSION.SDK_INT >= 33) {
            backCallback = this::handleAppBack;
            updateBackCallback(true);
        }
        web.loadUrl(START);
    }

    private void notifyKeyboard(boolean visible) {
        if (keyboardVisible == visible) return;
        keyboardVisible = visible;
        dispatchKeyboardState();
    }

    private void dispatchKeyboardState() {
        if (web == null || isFinishing() || isDestroyed()) return;
        web.evaluateJavascript("window.LeanKeyboardChanged && window.LeanKeyboardChanged(" + keyboardVisible + ")", null);
    }

    private void launchCamera() {
        try {
            pendingCapture = CameraFileProvider.createCapture(this);
            Intent intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            intent.putExtra(MediaStore.EXTRA_OUTPUT, pendingCapture);
            intent.setClipData(ClipData.newRawUri("肌薄动作照片", pendingCapture));
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            startActivityForResult(intent, REQUEST_CAMERA);
        } catch (ActivityNotFoundException | SecurityException | IOException error) {
            discardCapture();
            completeFileChoice(null);
            notifyWeb("无法打开相机，请使用「选择照片」。");
        }
    }

    private void completeFileChoice(Uri uri) {
        ValueCallback<Uri[]> callback = fileCallback;
        fileCallback = null;
        if (callback != null) callback.onReceiveValue(uri == null ? null : new Uri[]{uri});
    }

    private void discardCapture() {
        if (pendingCapture == null) return;
        revokeUriPermission(pendingCapture, Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        CameraFileProvider.deleteCapture(this, pendingCapture);
        pendingCapture = null;
    }

    private boolean isDocumentUri(Uri uri) {
        // Never let a third-party picker point WebView at an app-private file.
        if (uri == null || !"content".equals(uri.getScheme()) || uri.getAuthority() == null
                || uri.getUserInfo() != null || uri.getPort() != -1
                || CameraFileProvider.AUTHORITY.equals(uri.getAuthority())
                || UpdateFileProvider.AUTHORITY.equals(uri.getAuthority())) return false;
        try (InputStream input = getContentResolver().openInputStream(uri)) { return input != null; }
        catch (Exception error) { return false; }
    }

    private boolean isLocal(Uri uri) {
        String path = uri.getPath();
        return "https".equals(uri.getScheme()) && HOST.equals(uri.getHost())
            && uri.getPort() == -1 && uri.getUserInfo() == null
            && path != null && path.startsWith("/assets/www/")
            && !path.contains("..") && !path.contains("\\") && !path.contains("\u0000");
    }
    private WebResourceResponse denied(int code, String reason) {
        return new WebResourceResponse("text/plain", "UTF-8", code, reason,
                new HashMap<>(), new ByteArrayInputStream(new byte[0]));
    }
    private WebResourceResponse localAsset(Uri uri) {
        if (!isLocal(uri)) return denied(403, "Offline only");
        String path = uri.getPath().substring("/assets/".length());
        if (path.endsWith("/")) path += "index.html";
        final Map<String,String> types = new HashMap<>();
        types.put("html", "text/html"); types.put("css", "text/css");
        types.put("js", "application/javascript"); types.put("svg", "image/svg+xml");
        types.put("png", "image/png"); types.put("json", "application/json");
        types.put("webmanifest", "application/manifest+json");
        String extension = path.substring(path.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
        if (!types.containsKey(extension)) return denied(403, "Unsupported asset");
        try {
            InputStream input = getAssets().open(path);
            Map<String,String> headers = new HashMap<>();
            headers.put("X-Content-Type-Options", "nosniff");
            headers.put("Cache-Control", "no-cache");
            return new WebResourceResponse(types.get(extension), "png".equals(extension) ? null : "UTF-8",
                    200, "OK", headers, input);
        } catch (IOException error) { return denied(404, "Asset not found"); }
    }

    /** Exposed only to the hard-allowlisted appassets origin. Never add remote navigation. */
    public final class LocalBridge {
        @JavascriptInterface public String getUpdateState() { return updates.state(); }
        @JavascriptInterface public void checkForUpdate() { updates.check(); }
        @JavascriptInterface public void downloadUpdate() { updates.download(); }
        @JavascriptInterface public void cancelUpdate() { updates.cancel(); }
        @JavascriptInterface public void setAutoUpdateCheck(boolean enabled) { updates.setAutoCheck(enabled); }
        @JavascriptInterface public void installUpdate() { runOnUiThread(() -> updates.install(MainActivity.this)); }
        @JavascriptInterface public String read() {
            synchronized (storeLock) {
                if (!store.getBaseFile().exists() && !new File(store.getBaseFile().getPath()+".bak").exists()) return "";
                try {
                    byte[] bytes = store.readFully();
                    if (bytes.length > MAX_BYTES) throw new IOException("Stored data exceeds limit");
                    return new String(bytes, StandardCharsets.UTF_8);
                } catch (IOException error) {
                    // An invalid marker triggers the web app's write-protection path.
                    return "ERROR_READING_EXISTING_LOCAL_DATA";
                }
            }
        }
        @JavascriptInterface public boolean write(String json) {
            if (json == null) return false;
            byte[] data = json.getBytes(StandardCharsets.UTF_8);
            if (data.length > MAX_BYTES) return false;
            try {
                int schema = new JSONObject(json).optInt("schemaVersion", -1);
                if (schema != 1 && schema != 2) return false;
            }
            catch (Exception error) { return false; }
            synchronized (storeLock) {
                FileOutputStream output = null;
                try {
                    output = store.startWrite(); output.write(data); store.finishWrite(output); return true;
                } catch (IOException error) {
                    if (output != null) store.failWrite(output);
                    return false;
                }
            }
        }
        @JavascriptInterface public String readRuntime() {
            String json = runtime.getString("state", "");
            return json.getBytes(StandardCharsets.UTF_8).length <= MAX_RUNTIME_BYTES ? json : "";
        }
        @JavascriptInterface public boolean writeRuntime(String json) {
            if (json == null || json.getBytes(StandardCharsets.UTF_8).length > MAX_RUNTIME_BYTES) return false;
            try { new JSONObject(json); }
            catch (Exception error) { return false; }
            return runtime.edit().putString("state", json).commit();
        }
        @JavascriptInterface public void setBackEnabled(boolean enabled) {
            runOnUiThread(() -> updateBackCallback(enabled));
        }
        @JavascriptInterface public boolean exportText(String filename, String text, String mime) {
            if (text == null || text.getBytes(StandardCharsets.UTF_8).length > MAX_BYTES * 2) return false;
            if (filename == null || !filename.matches("[A-Za-z0-9._-]{1,100}")) return false;
            if (!("application/json".equals(mime) || "text/csv".equals(mime) || "text/plain".equals(mime))) return false;
            synchronized (exportLock) {
                if (pendingExport != null) return false;
                pendingExport = text;
            }
            runOnUiThread(() -> {
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.putExtra(Intent.EXTRA_LOCAL_ONLY, true);
                intent.setType(mime); intent.putExtra(Intent.EXTRA_TITLE, filename);
                try { startActivityForResult(intent, REQUEST_EXPORT); }
                catch (ActivityNotFoundException | SecurityException error) {
                    synchronized (exportLock) { pendingExport = null; }
                    notifyWeb("设备没有可用的文档保存器。");
                }
            });
            return true;
        }
        @JavascriptInterface public void copyText(String text) {
            if (text == null || text.length() > 20000) return;
            runOnUiThread(() -> {
                ClipboardManager clipboard = (ClipboardManager)getSystemService(Context.CLIPBOARD_SERVICE);
                if (clipboard != null) clipboard.setPrimaryClip(ClipData.newPlainText("肌薄训练记录", text));
            });
        }
    }

    @Override protected void onActivityResult(int request, int result, Intent intent) {
        super.onActivityResult(request, result, intent);
        if (updates != null && updates.onActivityResult(this, request, result)) return;
        if (request == REQUEST_IMPORT) {
            Uri uri = result == RESULT_OK && intent != null ? intent.getData() : null;
            if (uri != null && !isDocumentUri(uri)) { uri = null; notifyWeb("无法读取所选文件，请重新选择。"); }
            completeFileChoice(uri);
        } else if (request == REQUEST_CAMERA) {
            if (pendingCapture == null) { completeFileChoice(null); return; }
            File photo = CameraFileProvider.captureFile(this, pendingCapture);
            boolean valid = result == RESULT_OK && photo != null && photo.length() > 0 && photo.length() <= MAX_PHOTO_BYTES;
            if (fileCallback == null) {
                discardCapture();
                notifyWeb("应用已重新载入，请再拍一张或选择照片。");
            } else if (valid) {
                Uri photoUri = pendingCapture;
                pendingCapture = null;
                revokeUriPermission(photoUri, Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                // The app itself can still read the private provider; the camera's grant ends now.
                completeFileChoice(photoUri);
            } else {
                discardCapture();
                completeFileChoice(null);
                if (result == RESULT_OK) notifyWeb("照片未保存或超过 32 MB，请重拍或选择较小照片。");
            }
        } else if (request == REQUEST_EXPORT) {
            final String content;
            synchronized (exportLock) { content = pendingExport; pendingExport = null; }
            final Uri uri = result == RESULT_OK && intent != null ? intent.getData() : null;
            if (uri == null || content == null) { notifyWeb("导出已取消；本地记录未改变。"); return; }
            new Thread(() -> {
                try (OutputStream output = getContentResolver().openOutputStream(uri, "wt")) {
                    if (output == null) throw new IOException("No writable stream");
                    output.write(content.getBytes(StandardCharsets.UTF_8));
                    output.flush();
                    notifyWeb("备份已保存到你选择的位置。");
                } catch (Exception error) { notifyWeb("备份写入失败；请换一个保存位置重试。"); }
            }, "lean-export").start();
        }
    }
    private void notifyWeb(String text) {
        runOnUiThread(() -> {
            if (web == null || isFinishing() || isDestroyed()) return;
            if (!webReady) { pendingNotice = text; return; }
            web.evaluateJavascript("window.LeanNativeResult && window.LeanNativeResult(" + JSONObject.quote(text) + ")", null);
        });
    }
    private void dispatchUpdateState(String json) {
        if (web == null || !webReady || isFinishing() || isDestroyed()) return;
        // JSONObject's string quoting also escapes line separators for evaluateJavascript.
        web.evaluateJavascript("window.LeanUpdateChanged && window.LeanUpdateChanged(JSON.parse(" + JSONObject.quote(json) + "))", null);
    }
    private void updateBackCallback(boolean enabled) {
        if (Build.VERSION.SDK_INT < 33 || backCallback == null || isDestroyed()) return;
        if (enabled && !backCallbackRegistered) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, backCallback);
            backCallbackRegistered = true;
        } else if (!enabled && backCallbackRegistered) {
            getOnBackInvokedDispatcher().unregisterOnBackInvokedCallback(backCallback);
            backCallbackRegistered = false;
        }
    }
    private void handleAppBack() {
        if (selectionMode != null) { selectionMode.finish(); return; }
        if (web == null) { finish(); return; }
        if (handlingBack) return;
        handlingBack = true;
        web.evaluateJavascript("typeof window.LeanBack === 'function' && window.LeanBack()", result -> {
            handlingBack = false;
            if (!"true".equals(result) && !isFinishing()) finish();
        });
    }
    @Override public void onBackPressed() { handleAppBack(); }
    @Override public void onActionModeStarted(ActionMode mode) {
        super.onActionModeStarted(mode);
        selectionMode = mode;
    }
    @Override public void onActionModeFinished(ActionMode mode) {
        if (selectionMode == mode) selectionMode = null;
        super.onActionModeFinished(mode);
    }
    @Override protected void onSaveInstanceState(Bundle state) {
        if (pendingCapture != null) state.putString("pendingCapture", pendingCapture.toString());
        super.onSaveInstanceState(state);
    }
    @Override protected void onPause() {
        if (updates != null) updates.onPause(this);
        if (web != null) web.onPause();
        super.onPause();
    }
    @Override protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
        if (updates != null) updates.onResume(this);
    }
    @Override protected void onDestroy() {
        updateBackCallback(false);
        if (updates != null) updates.detach(updateListener);
        if (isFinishing()) discardCapture();
        if (fileCallback != null) { fileCallback.onReceiveValue(null); fileCallback = null; }
        if (web != null) {
            web.removeJavascriptInterface("LeanNative"); web.stopLoading();
            if (web.getParent() instanceof ViewGroup) ((ViewGroup)web.getParent()).removeView(web);
            web.destroy(); web = null;
        }
        super.onDestroy();
    }
}
