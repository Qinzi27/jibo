package app.leancrew.local;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URI;
import java.net.URISyntaxException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** Platform-independent update trust boundaries, shared with the executable JVM tests. */
public final class UpdatePolicy {
    public static final String PACKAGE_NAME = "app.leancrew.local";
    public static final String RELEASE_ROOT = "https://github.com/Qinzi27/jibo/releases/download/";
    public static final String METADATA_URL = "https://github.com/Qinzi27/jibo/releases/latest/download/jibo-update.json";
    public static final long MAX_APK_BYTES = 128L * 1024 * 1024;
    public static final int MAX_METADATA_BYTES = 64 * 1024;
    public static final long AUTO_INTERVAL_MS = 24L * 60 * 60 * 1000;

    private UpdatePolicy() {}

    public static final class Release {
        public final String versionName, apkUrl, sha256, notes;
        public final int versionCode, minSdk;
        public final long size;

        public Release(int schema, String packageName, String versionName, long versionCode,
                long minSdk, String apkUrl, String sha256, long size, String notes) {
            if (schema != 1 || !PACKAGE_NAME.equals(packageName)) throw new IllegalArgumentException("发布身份不匹配");
            if (versionName == null || versionName.length() > 64
                    || !versionName.matches("[0-9]+\\.[0-9]+\\.[0-9]+(?:-[A-Za-z0-9.-]+)?"))
                throw new IllegalArgumentException("版本格式无效");
            if (versionCode < 1 || versionCode > Integer.MAX_VALUE || minSdk < 26 || minSdk > 10000)
                throw new IllegalArgumentException("版本编号无效");
            String expected = RELEASE_ROOT + "v" + versionName + "/jibo-v" + versionName + ".apk";
            if (!expected.equals(apkUrl)) throw new IllegalArgumentException("安装包地址不属于肌薄发布");
            if (sha256 == null || !sha256.matches("[0-9a-f]{64}")) throw new IllegalArgumentException("校验摘要无效");
            if (size < 1 || size > MAX_APK_BYTES) throw new IllegalArgumentException("安装包大小超出限制");
            if (notes == null || notes.length() > 4000) throw new IllegalArgumentException("更新说明过长");
            this.versionName = versionName; this.versionCode = (int)versionCode; this.minSdk = (int)minSdk;
            this.apkUrl = apkUrl; this.sha256 = sha256; this.size = size; this.notes = notes;
        }
    }

    /** The first URL is fixed by code/validated metadata; every redirect is checked again. */
    public static URI checkedUrl(String value, boolean metadata, String apkUrl, boolean redirect) throws IOException {
        try {
            if (value == null || value.length() > 16384) throw new IOException("更新地址无效");
            URI uri = new URI(value);
            if (!"https".equals(uri.getScheme()) || uri.getHost() == null || uri.getRawUserInfo() != null
                    || uri.getPort() != -1 || uri.getRawFragment() != null)
                throw new IOException("仅允许安全的肌薄更新地址");
            String path = uri.getRawPath();
            if (path == null || path.contains("%") || path.contains("..") || path.contains("\\"))
                throw new IOException("更新地址路径无效");
            if ("github.com".equals(uri.getHost()) && uri.getRawQuery() == null) {
                boolean exact = metadata ? METADATA_URL.equals(value) : value.equals(apkUrl);
                boolean metadataRelease = metadata && redirect
                        && path.matches("/Qinzi27/jibo/releases/download/[A-Za-z0-9._-]+/jibo-update\\.json");
                if (exact || metadataRelease) return uri;
            }
            if (redirect && "release-assets.githubusercontent.com".equals(uri.getHost())
                    && path.matches("/github-production-release-asset/[0-9]+/[A-Za-z0-9-]+")) return uri;
            throw new IOException("更新地址不在肌薄发布白名单");
        } catch (URISyntaxException error) { throw new IOException("更新地址无效", error); }
    }

    public interface Progress { void update(long bytes) throws IOException; }

    /** A bounded streaming copy. Nothing is accepted until both exact length and SHA match. */
    public static void verifiedCopy(InputStream input, OutputStream output, long size, String sha256,
            Progress progress) throws IOException {
        if (size < 1 || size > MAX_APK_BYTES || sha256 == null || !sha256.matches("[0-9a-f]{64}"))
            throw new IOException("安装包校验参数无效");
        MessageDigest digest = digest();
        byte[] buffer = new byte[32768]; long total = 0; int count;
        progress.update(0);
        while ((count = input.read(buffer)) != -1) {
            if (Thread.currentThread().isInterrupted()) throw new IOException("更新已取消");
            total += count;
            if (total > size) throw new IOException("安装包超过声明大小");
            output.write(buffer, 0, count); digest.update(buffer, 0, count); progress.update(total);
        }
        if (total != size) throw new IOException("安装包下载不完整");
        if (!hex(digest.digest()).equals(sha256)) throw new IOException("安装包完整性校验失败");
    }

    public static boolean exactSigners(byte[][] current, byte[][] candidate) {
        Set<String> a = signerSet(current), b = signerSet(candidate);
        return a != null && b != null && a.equals(b);
    }

    private static Set<String> signerSet(byte[][] values) {
        if (values == null || values.length == 0) return null;
        Set<String> result = new HashSet<>();
        for (byte[] value : values) {
            if (value == null || value.length == 0 || !result.add(hex(value))) return null;
        }
        return result;
    }

    public static boolean acceptsApk(Release release, String packageName, long versionCode,
            String versionName, int minSdk, int deviceSdk, long installedCode) {
        return PACKAGE_NAME.equals(packageName) && release.versionCode == versionCode
                && versionCode > installedCode && release.versionName.equals(versionName)
                && release.minSdk == minSdk && minSdk <= deviceSdk;
    }

    public static boolean autoCheckDue(long now, long last) {
        return last <= 0 || (now >= last && now - last >= AUTO_INTERVAL_MS);
    }

    /** Only OS-installed handlers can receive the update/settings intents and APK grant. */
    public static final class SystemHandler {
        public final String packageName, activityName;
        public final boolean system, enabled, exported;
        public SystemHandler(String packageName, String activityName, boolean system, boolean enabled, boolean exported) {
            this.packageName = packageName; this.activityName = activityName;
            this.system = system; this.enabled = enabled; this.exported = exported;
        }
        private boolean trusted() {
            return system && enabled && exported && packageName != null && !packageName.isEmpty()
                    && activityName != null && !activityName.isEmpty();
        }
    }

    /** Keep the OEM's preferred handler only when it is also in the trusted result set. */
    public static SystemHandler selectSystemHandler(List<SystemHandler> handlers, String preferredPackage, String preferredActivity) {
        SystemHandler first = null;
        if (handlers == null) return null;
        for (SystemHandler handler : handlers) {
            if (handler == null || !handler.trusted()) continue;
            if (first == null) first = handler;
            if (handler.packageName.equals(preferredPackage) && handler.activityName.equals(preferredActivity)) return handler;
        }
        return first;
    }

    private static MessageDigest digest() throws IOException {
        try { return MessageDigest.getInstance("SHA-256"); }
        catch (NoSuchAlgorithmException error) { throw new IOException("SHA-256不可用", error); }
    }

    public static String hex(byte[] bytes) {
        StringBuilder result = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) result.append(String.format(java.util.Locale.ROOT, "%02x", value & 255));
        return result.toString();
    }
}
