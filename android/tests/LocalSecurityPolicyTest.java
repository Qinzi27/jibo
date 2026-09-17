package app.leancrew.local;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.util.Arrays;

/** Real policy regression cases; no Android lifecycle or picker is simulated. */
public final class LocalSecurityPolicyTest {
    private static int checks;
    private static void check(boolean condition, String message) {
        checks++;
        if (!condition) throw new AssertionError(message);
    }
    private static boolean document(String value) {
        URI uri = URI.create(value);
        return LocalSecurityPolicy.externalDocument(uri.getScheme(), uri.getAuthority());
    }
    private static boolean asset(String value) {
        URI uri = URI.create(value);
        return LocalSecurityPolicy.bundledAsset(uri.getScheme(), uri.getAuthority(), uri.getPath());
    }
    private static boolean page(String value) {
        URI uri = URI.create(value);
        return LocalSecurityPolicy.appDocument(uri.getScheme(), uri.getAuthority(), uri.getPath(), uri.getQuery());
    }
    private static void rejectsRead(InputStream input, int limit, String message) throws Exception {
        boolean rejected = false;
        try { LocalSecurityPolicy.readBounded(input, limit); }
        catch (IOException expected) { rejected = true; }
        check(rejected, message);
    }

    public static void main(String[] args) throws Exception {
        for (String uri : new String[]{
                "content://com.android.externalstorage.documents/document/primary%3ADownload%2Fbackup.json",
                "content://com.android.providers.media.documents/document/image%3A123",
                "content://media/picker/0/com.android.providers.media.photopicker/media/123",
                "content://com.example.gallery.my_provider/images/123?original=true"})
            check(document(uri), "Allow selected external content document: " + uri);

        for (String uri : new String[]{
                "file:///data/user/0/app.leancrew.local/files/lean-crew-v1.json",
                "file:///data/user/0/app.leancrew.local/shared_prefs/jibo-runtime.xml",
                "file:///sdcard/Download/backup.json",
                "android.resource://app.leancrew.local/raw/private",
                "https://example.com/backup.json",
                "content://app.leancrew.local.camera/capture/00000000-0000-0000-0000-000000000000.jpg",
                "content://app.leancrew.local.updates/apk/jibo.apk",
                "content://APP.LEANCREW.LOCAL.CAMERA/capture/a.jpg",
                "content://%61pp.leancrew.local.camera/capture/a.jpg",
                "content://0@app.leancrew.local.camera/capture/a.jpg",
                "content://app.leancrew.local.updates:42/apk/jibo.apk",
                "content:///no-authority", "content://user@media/image/1", "content://media:80/image/1"})
            check(!document(uri), "Reject unsafe picker read/write destination: " + uri);
        check(!LocalSecurityPolicy.externalDocument(null, "media"), "Missing scheme rejected");
        check(!LocalSecurityPolicy.externalDocument("content", null), "Missing authority rejected");

        String host = "https://appassets.androidplatform.net";
        check(page(host + "/assets/www/index.html"), "Only entry HTML can be an app page");
        check(page(host + "/assets/www/index.html#settings"), "In-page fragment allowed");
        check(asset(host + "/assets/www/assets/exercises/pushup.svg"), "Bundled SVG remains available");
        check(asset(host + "/assets/www/app.js"), "Bundled script remains available");
        for (String uri : new String[]{
                "http://appassets.androidplatform.net/assets/www/index.html",
                "https://appassets.androidplatform.net.evil.test/assets/www/index.html",
                "https://appassets.androidplatform.net@evil.test/assets/www/index.html",
                "https://evil.test@appassets.androidplatform.net/assets/www/index.html",
                "https://appassets.androidplatform.net:443/assets/www/index.html",
                host + "/assets/www/../../files/lean-crew-v1.json",
                host + "/assets/www/%2e%2e/private.json",
                host + "/assets/www/%2E%2E%2Fprivate.json",
                host + "/assets/www/%5cprivate.json",
                host + "/assets/www/%00index.html",
                host + "/assets/other/index.html",
                "file:///android_asset/www/index.html"})
            check(!asset(uri), "Reject remote or escaped local asset: " + uri);
        for (String uri : new String[]{host + "/assets/www/app.js", host + "/assets/www/assets/icon-192.png",
                host + "/assets/www/index.html?remote=1", host + "/assets/www/"})
            check(!page(uri), "Non-entry resource cannot replace bridged page: " + uri);
        check(!LocalSecurityPolicy.bundledAsset("https", LocalSecurityPolicy.HOST, null), "Null asset path rejected");

        byte[] limitBytes = new byte[4 * 1024 * 1024];
        Arrays.fill(limitBytes, (byte) 0xa5);
        check(Arrays.equals(limitBytes, LocalSecurityPolicy.readBounded(new ByteArrayInputStream(limitBytes), limitBytes.length)), "Four MB data preserved exactly");
        rejectsRead(new ByteArrayInputStream(new byte[limitBytes.length + 1]), limitBytes.length, "One byte above local store cap rejected");
        check(LocalSecurityPolicy.readBounded(new ByteArrayInputStream(new byte[0]), 0).length == 0, "Empty input supported");
        rejectsRead(new ByteArrayInputStream(new byte[]{1}), 0, "Nonempty input exceeds zero cap");
        rejectsRead(new ByteArrayInputStream(new byte[8193]), 8192, "Oversize detected across stream chunk boundary");
        rejectsRead(new InputStream() { @Override public int read() throws IOException { throw new IOException("disk failure"); } }, 10, "Read failure reaches store write-protection path");
        System.out.println("LocalSecurityPolicy: " + checks + " checks passed (JVM policy only; Android picker/lifecycle unverified)");
    }
}
