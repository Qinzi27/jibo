package app.leancrew.local;

import android.app.Activity;
import android.content.ClipData;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.ActivityInfo;
import android.content.pm.ApplicationInfo;
import android.content.pm.ResolveInfo;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.lang.ref.WeakReference;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import javax.net.ssl.HttpsURLConnection;

/**
 * The only network client in the app. Requests contain no training records, photos,
 * account data or caller-supplied URL. Android always confirms package installation.
 */
public final class UpdateManager {
    static final int REQUEST_PERMISSION = 51, REQUEST_INSTALL = 52;
    private static UpdateManager instance;
    private final Context app;
    private final SharedPreferences preferences;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService worker = Executors.newSingleThreadExecutor(r -> new Thread(r, "jibo-updater"));
    private WeakReference<Listener> listener = new WeakReference<>(null);
    private WeakReference<Activity> foreground = new WeakReference<>(null);
    private Future<?> task;
    private HttpsURLConnection connection;
    private long generation;
    private String status = "idle", error = "";
    private int progress;
    private final String currentVersion;
    private final long currentCode;
    private UpdatePolicy.Release latest;
    private boolean ready, awaitingPermission, installerOpen, verifyingInstall;

    public interface Listener { void changed(String state); }

    public static synchronized UpdateManager get(Context context) {
        if (instance == null) instance = new UpdateManager(context.getApplicationContext());
        return instance;
    }

    private UpdateManager(Context context) {
        app = context;
        preferences = app.getSharedPreferences("jibo-updates", Context.MODE_PRIVATE);
        PackageInfo installed;
        try { installed = app.getPackageManager().getPackageInfo(app.getPackageName(), 0); }
        catch (PackageManager.NameNotFoundException impossible) { throw new IllegalStateException(impossible); }
        currentVersion = installed.versionName;
        currentCode = code(installed);
        awaitingPermission = preferences.getBoolean("awaitingPermission", false);
        File folder = UpdateFileProvider.directory(app);
        if (!folder.isDirectory()) folder.mkdirs();
        // Incomplete files are never installable, including after process termination.
        File[] stale = folder.listFiles((dir, name) -> name.endsWith(".part"));
        if (stale != null) for (File file : stale) file.delete();
        try {
            String saved = preferences.getString("verifiedRelease", "");
            if (!saved.isEmpty()) latest = parseRelease(saved);
            if (latest != null && latest.versionCode > currentCode && UpdateFileProvider.apkFile(app).isFile()) {
                status = "checking";
                long token = ++generation;
                UpdatePolicy.Release release = latest;
                task = worker.submit(() -> {
                    try {
                        verifyApk(UpdateFileProvider.apkFile(app), release, token);
                        synchronized (this) {
                            if (token != generation) return;
                            ready = true; status = "ready"; progress = 100; publish();
                        }
                        main.post(this::continuePermissionIfPossible);
                    } catch (Exception failure) {
                        synchronized (this) {
                            if (token != generation) return;
                            clearDownloaded(); status = "available"; error = "已下载文件需要重新下载。"; publish();
                        }
                    }
                });
            } else { latest = null; clearDownloaded(); }
        } catch (Exception invalidSavedState) { latest = null; clearDownloaded(); }
    }

    public synchronized void attach(Listener target) { listener = new WeakReference<>(target); publish(); }
    public synchronized void detach(Listener target) { if (listener.get() == target) listener.clear(); }
    public synchronized String state() {
        JSONObject value = new JSONObject();
        try {
            value.put("status", status).put("currentVersion", currentVersion).put("currentCode", currentCode)
                .put("autoCheck", preferences.getBoolean("autoCheck", true))
                .put("latestVersion", latest == null ? "" : latest.versionName)
                .put("latestCode", latest == null ? 0 : latest.versionCode)
                .put("notes", latest == null ? "" : latest.notes).put("progress", progress).put("error", error);
        } catch (Exception impossible) { throw new IllegalStateException(impossible); }
        return value.toString();
    }
    private synchronized void publish() {
        String snapshot = state();
        Listener target = listener.get();
        if (target != null) main.post(() -> { synchronized (UpdateManager.this) {
            if (listener.get() == target) target.changed(snapshot);
        }});
    }
    private boolean busy() { return "checking".equals(status) || "downloading".equals(status) || "installing".equals(status); }
    public synchronized void setAutoCheck(boolean enabled) {
        preferences.edit().putBoolean("autoCheck", enabled).apply(); publish();
    }
    public synchronized void onResume(Activity activity) {
        foreground = new WeakReference<>(activity);
        if (awaitingPermission) { continuePermissionIfPossible(); return; }
        if (!busy() && preferences.getBoolean("autoCheck", true)
                && UpdatePolicy.autoCheckDue(System.currentTimeMillis(), preferences.getLong("lastCheck", 0))) check();
    }
    public synchronized void onPause(Activity activity) { if (foreground.get() == activity) foreground.clear(); }

    public synchronized void check() {
        if (busy()) return;
        preferences.edit().putLong("lastCheck", System.currentTimeMillis()).apply();
        error = ""; status = "checking"; publish();
        long token = ++generation;
        task = worker.submit(() -> {
            try {
                long deadline = System.nanoTime() + 60_000_000_000L;
                HttpsURLConnection request = open(UpdatePolicy.METADATA_URL, true, null, token, deadline);
                String json;
                try (InputStream input = request.getInputStream(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                    long declared = request.getContentLengthLong();
                    if (declared > UpdatePolicy.MAX_METADATA_BYTES) throw new IOException("更新说明超过大小限制");
                    byte[] buffer = new byte[4096]; int count;
                    while ((count = input.read(buffer)) != -1) {
                        ensureActive(token, deadline);
                        if (output.size() + count > UpdatePolicy.MAX_METADATA_BYTES) throw new IOException("更新说明超过大小限制");
                        output.write(buffer, 0, count);
                    }
                    json = new String(output.toByteArray(), StandardCharsets.UTF_8);
                } finally { closeConnection(request); }
                UpdatePolicy.Release release = parseRelease(json);
                synchronized (this) {
                    ensureActive(token, deadline);
                    if (release.versionCode > currentCode && release.minSdk > Build.VERSION.SDK_INT)
                        throw new IOException("新版本需要 Android API " + release.minSdk + "，此手机暂不支持。");
                    if (latest == null || !release.sha256.equals(latest.sha256) || release.versionCode != latest.versionCode) clearDownloaded();
                    latest = release;
                    if (release.versionCode <= currentCode) { clearDownloaded(); status = "upToDate"; }
                    else status = ready ? "ready" : "available";
                    publish();
                }
            } catch (Exception failure) { fail(token, failure, "检查失败，请检查网络后重试。"); }
        });
    }

    public synchronized void download() {
        if (busy() || latest == null || latest.versionCode <= currentCode || ready) return;
        final UpdatePolicy.Release release = latest;
        if (release.minSdk > Build.VERSION.SDK_INT) return;
        final long token = ++generation;
        status = "downloading"; progress = 0; error = ""; publish();
        task = worker.submit(() -> {
            File partial = new File(UpdateFileProvider.directory(app), "download-" + token + ".part");
            try {
                long deadline = System.nanoTime() + 900_000_000_000L;
                HttpsURLConnection request = open(release.apkUrl, false, release.apkUrl, token, deadline);
                try (InputStream input = request.getInputStream(); FileOutputStream output = new FileOutputStream(partial)) {
                    long declared = request.getContentLengthLong();
                    if (declared != -1 && declared != release.size) throw new IOException("安装包大小与发布信息不一致");
                    UpdatePolicy.verifiedCopy(input, output, release.size, release.sha256, bytes -> {
                        ensureActive(token, deadline);
                        synchronized (this) {
                            ensureActive(token, deadline);
                            int next = (int)Math.min(99, bytes * 100 / release.size);
                            if (progress != next) { progress = next; publish(); }
                        }
                    });
                    output.getFD().sync();
                } finally { closeConnection(request); }
                verifyApk(partial, release, token);
                synchronized (this) {
                    ensureActive(token, deadline);
                    File destination = UpdateFileProvider.apkFile(app);
                    if (destination.exists() && !destination.delete()) throw new IOException("无法替换旧安装包");
                    if (!partial.renameTo(destination)) throw new IOException("无法保存已验证安装包");
                    preferences.edit().putString("verifiedRelease", releaseJson(release)).commit();
                    ready = true; status = "ready"; progress = 100; publish();
                }
            } catch (Exception failure) { fail(token, failure, "下载失败，请重试。"); }
            finally { partial.delete(); }
        });
    }

    public synchronized void cancel() {
        if (!"checking".equals(status) && !"downloading".equals(status)) return;
        generation++;
        if (task != null) task.cancel(true);
        if (connection != null) { connection.disconnect(); connection = null; }
        awaitingPermission = false;
        preferences.edit().putBoolean("awaitingPermission", false).apply();
        status = ready ? "ready" : latest != null && latest.versionCode > currentCode ? "available" : "idle";
        progress = ready ? 100 : 0; error = ""; publish();
    }

    /** Called only after a user presses Install. The Activity is never retained by the worker. */
    public synchronized void install(Activity activity) {
        if (!ready || latest == null || busy() || activity == null) return;
        startInstallValidation(activity);
    }
    private synchronized void startInstallValidation(Activity activity) {
        if (verifyingInstall || installerOpen) return;
        verifyingInstall = true; status = "installing"; error = ""; publish();
        long token = ++generation;
        UpdatePolicy.Release release = latest;
        WeakReference<Activity> owner = new WeakReference<>(activity);
        task = worker.submit(() -> {
            try {
                verifyApk(UpdateFileProvider.apkFile(app), release, token);
                main.post(() -> { synchronized (UpdateManager.this) {
                    if (generation != token) return;
                    verifyingInstall = false;
                    Activity target = owner.get();
                    if (target == null || target.isFinishing() || target.isDestroyed() || foreground.get() != target) {
                        status = "ready"; error = "安装包已就绪，回到应用后点继续安装。"; publish(); return;
                    }
                    launchInstallerOrPermission(target);
                }});
            } catch (Exception failure) {
                synchronized (this) {
                    if (generation != token) return;
                    verifyingInstall = false; clearDownloaded();
                }
                fail(token, failure, "安装包校验失败，请重新下载。");
            }
        });
    }
    private synchronized void launchInstallerOrPermission(Activity activity) {
        try {
            if (!app.getPackageManager().canRequestPackageInstalls()) {
                awaitingPermission = true;
                preferences.edit().putBoolean("awaitingPermission", true).commit();
                Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + app.getPackageName()));
                restrictToSystemHandler(settings);
                activity.startActivityForResult(settings, REQUEST_PERMISSION);
            } else {
                awaitingPermission = false;
                preferences.edit().putBoolean("awaitingPermission", false).apply();
                Intent install = new Intent(Intent.ACTION_INSTALL_PACKAGE);
                install.setDataAndType(UpdateFileProvider.APK_URI, "application/vnd.android.package-archive");
                install.setClipData(ClipData.newRawUri("肌薄更新", UpdateFileProvider.APK_URI));
                install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                install.putExtra(Intent.EXTRA_RETURN_RESULT, true);
                restrictToSystemHandler(install);
                installerOpen = true;
                activity.startActivityForResult(install, REQUEST_INSTALL);
            }
            status = "installing"; publish();
        } catch (Exception failure) {
            installerOpen = false; awaitingPermission = false;
            app.revokeUriPermission(UpdateFileProvider.APK_URI, Intent.FLAG_GRANT_READ_URI_PERMISSION);
            preferences.edit().putBoolean("awaitingPermission", false).apply();
            status = "ready"; error = "无法打开系统安装器，请确认手机允许安装此应用的更新后重试。"; publish();
        }
    }

    private void restrictToSystemHandler(Intent intent) throws IOException {
        PackageManager manager = app.getPackageManager();
        int flags = PackageManager.MATCH_DEFAULT_ONLY | PackageManager.MATCH_SYSTEM_ONLY;
        List<UpdatePolicy.SystemHandler> candidates = new ArrayList<>();
        for (ResolveInfo match : manager.queryIntentActivities(intent, flags)) {
            ActivityInfo activity = match == null ? null : match.activityInfo;
            if (activity == null || activity.applicationInfo == null) continue;
            ApplicationInfo application = activity.applicationInfo;
            candidates.add(new UpdatePolicy.SystemHandler(activity.packageName, activity.name,
                    (application.flags & (ApplicationInfo.FLAG_SYSTEM | ApplicationInfo.FLAG_UPDATED_SYSTEM_APP)) != 0,
                    activity.enabled && application.enabled, activity.exported));
        }
        ResolveInfo resolved = manager.resolveActivity(intent, flags);
        ActivityInfo preferred = resolved == null ? null : resolved.activityInfo;
        UpdatePolicy.SystemHandler selected = UpdatePolicy.selectSystemHandler(candidates,
                preferred == null ? null : preferred.packageName, preferred == null ? null : preferred.name);
        if (selected == null) throw new IOException("未找到可用的系统安装组件");
        intent.setComponent(new ComponentName(selected.packageName, selected.activityName));
    }
    private synchronized void continuePermissionIfPossible() {
        Activity activity = foreground.get();
        if (!awaitingPermission || !ready || verifyingInstall || installerOpen || activity == null) return;
        awaitingPermission = false;
        preferences.edit().putBoolean("awaitingPermission", false).apply();
        if (app.getPackageManager().canRequestPackageInstalls()) startInstallValidation(activity);
        else { status = "ready"; error = "尚未允许此来源安装；安装包已保留，可再次点安装。"; publish(); }
    }
    public synchronized boolean onActivityResult(Activity activity, int request, int result) {
        if (request == REQUEST_PERMISSION) {
            // Settings documents no result: inspect the actual permission, never RESULT_OK.
            foreground = new WeakReference<>(activity);
            continuePermissionIfPossible(); return true;
        }
        if (request == REQUEST_INSTALL) {
            installerOpen = false;
            app.revokeUriPermission(UpdateFileProvider.APK_URI, Intent.FLAG_GRANT_READ_URI_PERMISSION);
            // A result from an installer opened by the previous process can arrive while
            // this process is re-verifying its cache. Do not invalidate that active job.
            if (!"checking".equals(status) && !"downloading".equals(status) && !verifyingInstall)
                status = ready ? "ready" : "idle";
            error = result == Activity.RESULT_OK ? "系统已处理安装；若版本未改变，可再次尝试。" : "安装未完成，安装包已保留，可再次点安装。";
            publish(); return true;
        }
        return false;
    }

    private synchronized void clearDownloaded() {
        ready = false; progress = 0; awaitingPermission = false;
        app.revokeUriPermission(UpdateFileProvider.APK_URI, Intent.FLAG_GRANT_READ_URI_PERMISSION);
        UpdateFileProvider.apkFile(app).delete();
        preferences.edit().remove("verifiedRelease").putBoolean("awaitingPermission", false).apply();
    }
    private synchronized void fail(long token, Exception failure, String fallback) {
        if (token != generation) return;
        status = ready ? "ready" : "error";
        // Never expose signed redirect URLs, response bodies, filesystem paths or raw exceptions.
        error = failure instanceof IOException || failure instanceof IllegalArgumentException
                ? safeError(failure.getMessage(), fallback) : fallback;
        publish();
    }
    private static String safeError(String message, String fallback) {
        return message != null && message.length() < 160 && message.matches("[\\p{IsHan}，。；：、（）0-9 A-Za-z-]+") ? message : fallback;
    }
    private synchronized void ensureActive(long token, long deadline) throws IOException {
        if (generation != token || Thread.currentThread().isInterrupted()) throw new IOException("更新已取消");
        if (System.nanoTime() > deadline) throw new IOException("更新连接超时，请重试");
    }
    private HttpsURLConnection open(String address, boolean metadata, String apk, long token, long deadline) throws IOException {
        URI uri = UpdatePolicy.checkedUrl(address, metadata, apk, false);
        for (int redirects = 0; redirects <= 5; redirects++) {
            ensureActive(token, deadline);
            HttpsURLConnection request = (HttpsURLConnection)uri.toURL().openConnection();
            request.setInstanceFollowRedirects(false);
            request.setConnectTimeout(15000); request.setReadTimeout(20000);
            request.setRequestMethod("GET"); request.setUseCaches(false);
            request.setRequestProperty("Accept", metadata ? "application/json" : "application/octet-stream");
            request.setRequestProperty("Accept-Encoding", "identity");
            request.setRequestProperty("User-Agent", "Jibo-Updater/1");
            synchronized (this) { ensureActive(token, deadline); connection = request; }
            try {
                int code = request.getResponseCode();
                ensureActive(token, deadline);
                if (code == 200) return request;
                if (code == 301 || code == 302 || code == 303 || code == 307 || code == 308) {
                    String location = request.getHeaderField("Location");
                    if (location == null || redirects == 5) throw new IOException("更新重定向无效");
                    uri = UpdatePolicy.checkedUrl(uri.resolve(location).toString(), metadata, apk, true);
                } else if (code == 404) throw new IOException("暂未找到更新发布，请稍后重试");
                else throw new IOException("更新服务器暂不可用，请稍后重试");
            } catch (IOException | RuntimeException failure) { closeConnection(request); throw failure; }
            closeConnection(request);
        }
        throw new IOException("更新重定向过多");
    }
    private synchronized void closeConnection(HttpsURLConnection request) {
        request.disconnect(); if (connection == request) connection = null;
    }

    private void verifyApk(File file, UpdatePolicy.Release release, long token) throws Exception {
        if (!file.isFile() || file.length() != release.size) throw new IOException("安装包大小校验失败");
        long deadline = System.nanoTime() + 120_000_000_000L;
        try (InputStream input = new FileInputStream(file)) {
            UpdatePolicy.verifiedCopy(input, new OutputStream() {
                @Override public void write(int value) {}
                @Override public void write(byte[] value, int offset, int count) {}
            }, release.size, release.sha256, bytes -> ensureActive(token, deadline));
        }
        int flags = Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
        PackageManager manager = app.getPackageManager();
        PackageInfo candidate = manager.getPackageArchiveInfo(file.getAbsolutePath(), flags);
        PackageInfo installed = manager.getPackageInfo(app.getPackageName(), flags);
        if (candidate == null || candidate.applicationInfo == null
                || !UpdatePolicy.acceptsApk(release, candidate.packageName, code(candidate), candidate.versionName,
                    candidate.applicationInfo.minSdkVersion, Build.VERSION.SDK_INT, code(installed)))
            throw new IOException("安装包身份或版本校验失败");
        if (!UpdatePolicy.exactSigners(signers(installed), signers(candidate)))
            throw new IOException("安装包签名与当前肌薄不一致");
        ensureActive(token, deadline);
    }
    private static long code(PackageInfo value) { return Build.VERSION.SDK_INT >= 28 ? value.getLongVersionCode() : value.versionCode; }
    private static byte[][] signers(PackageInfo value) {
        Signature[] signatures = Build.VERSION.SDK_INT >= 28
            ? value.signingInfo == null ? null : value.signingInfo.getApkContentsSigners() : value.signatures;
        if (signatures == null) return null;
        byte[][] bytes = new byte[signatures.length][];
        for (int i = 0; i < signatures.length; i++) bytes[i] = signatures[i] == null ? null : signatures[i].toByteArray();
        return bytes;
    }
    private static long integer(JSONObject json, String key) throws Exception {
        Object value = json.get(key);
        if (!(value instanceof Integer) && !(value instanceof Long)) throw new IllegalArgumentException("更新数字字段无效");
        return ((Number)value).longValue();
    }
    private static String string(JSONObject json, String key) throws Exception {
        Object value = json.get(key);
        if (!(value instanceof String)) throw new IllegalArgumentException("更新文字字段无效");
        return (String)value;
    }
    private static UpdatePolicy.Release parseRelease(String text) throws Exception {
        if (text.getBytes(StandardCharsets.UTF_8).length > UpdatePolicy.MAX_METADATA_BYTES) throw new IOException("更新说明超过大小限制");
        JSONObject json = new JSONObject(text);
        long schema = integer(json, "schemaVersion");
        if (schema != 1) throw new IllegalArgumentException("更新格式不支持");
        return new UpdatePolicy.Release(1, string(json, "packageName"), string(json, "versionName"), integer(json, "versionCode"),
            integer(json, "minSdk"), string(json, "apkUrl"), string(json, "sha256"), integer(json, "size"), string(json, "notes"));
    }
    private static String releaseJson(UpdatePolicy.Release release) throws Exception {
        return new JSONObject().put("schemaVersion", 1).put("packageName", UpdatePolicy.PACKAGE_NAME)
            .put("versionName", release.versionName).put("versionCode", release.versionCode).put("minSdk", release.minSdk)
            .put("apkUrl", release.apkUrl).put("sha256", release.sha256).put("size", release.size).put("notes", release.notes).toString();
    }
}
