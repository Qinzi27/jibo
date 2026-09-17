package app.leancrew.local;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;

/** Runs against the production policy, without Android stubs or a network connection. */
public final class UpdatePolicyTest {
    private static int passed;
    private static final String VERSION = "1.5.0";
    private static final String APK = UpdatePolicy.RELEASE_ROOT + "v1.5.0/jibo-v1.5.0.apk";
    private static final String HASH = "a".repeat(64);
    private interface Action { void run() throws Exception; }
    private static void check(String name, boolean result) {
        if (!result) throw new AssertionError(name);
        passed++; System.out.println("PASS " + name);
    }
    private static void rejects(String name, Action action) throws Exception {
        try { action.run(); } catch (IOException | IllegalArgumentException expected) { check(name, true); return; }
        throw new AssertionError(name + " was accepted");
    }
    private static UpdatePolicy.Release release(String pkg, String version, long code, long sdk, String url, String hash, long size, String notes) {
        return new UpdatePolicy.Release(1, pkg, version, code, sdk, url, hash, size, notes);
    }
    private static UpdatePolicy.Release valid() { return release(UpdatePolicy.PACKAGE_NAME, VERSION, 7, 26, APK, HASH, 1024, "本地记录保持不变"); }
    private static void url(String name, String value, boolean metadata, boolean redirect, boolean allowed) throws Exception {
        if (allowed) check(name, UpdatePolicy.checkedUrl(value, metadata, APK, redirect).toString().equals(value));
        else rejects(name, () -> UpdatePolicy.checkedUrl(value, metadata, APK, redirect));
    }
    public static void main(String[] args) throws Exception {
        check("valid release", valid().versionCode == 7);
        rejects("wrong schema", () -> new UpdatePolicy.Release(2, UpdatePolicy.PACKAGE_NAME, VERSION, 7, 26, APK, HASH, 1024, ""));
        rejects("foreign package", () -> release("app.evil", VERSION, 7, 26, APK, HASH, 1024, ""));
        rejects("version traversal", () -> release(UpdatePolicy.PACKAGE_NAME, "../1.5.0", 7, 26, APK, HASH, 1024, ""));
        rejects("version missing patch", () -> release(UpdatePolicy.PACKAGE_NAME, "1.5", 7, 26, APK, HASH, 1024, ""));
        rejects("version overflow", () -> release(UpdatePolicy.PACKAGE_NAME, VERSION, 2147483648L, 26, APK, HASH, 1024, ""));
        rejects("zero version", () -> release(UpdatePolicy.PACKAGE_NAME, VERSION, 0, 26, APK, HASH, 1024, ""));
        rejects("invalid min SDK", () -> release(UpdatePolicy.PACKAGE_NAME, VERSION, 7, 0, APK, HASH, 1024, ""));
        rejects("metadata URL mismatch", () -> release(UpdatePolicy.PACKAGE_NAME, VERSION, 7, 26, APK.replace("jibo-v1.5.0.apk", "jibo-v1.4.0.apk"), HASH, 1024, ""));
        rejects("digest not hex", () -> release(UpdatePolicy.PACKAGE_NAME, VERSION, 7, 26, APK, "z".repeat(64), 1024, ""));
        rejects("digest wrong length", () -> release(UpdatePolicy.PACKAGE_NAME, VERSION, 7, 26, APK, HASH.substring(1), 1024, ""));
        rejects("digest null", () -> release(UpdatePolicy.PACKAGE_NAME, VERSION, 7, 26, APK, null, 1024, ""));
        rejects("APK zero bytes", () -> release(UpdatePolicy.PACKAGE_NAME, VERSION, 7, 26, APK, HASH, 0, ""));
        rejects("APK beyond cap", () -> release(UpdatePolicy.PACKAGE_NAME, VERSION, 7, 26, APK, HASH, UpdatePolicy.MAX_APK_BYTES + 1, ""));
        rejects("oversize notes", () -> release(UpdatePolicy.PACKAGE_NAME, VERSION, 7, 26, APK, HASH, 1024, "文".repeat(4001)));
        check("notes exact boundary", release(UpdatePolicy.PACKAGE_NAME, VERSION, 7, 26, APK, HASH, 1024, "文".repeat(4000)).notes.length() == 4000);
        url("fixed metadata", UpdatePolicy.METADATA_URL, true, false, true);
        url("fixed APK", APK, false, false, true);
        url("metadata release redirect", UpdatePolicy.RELEASE_ROOT + "v1.5.0/jibo-update.json", true, true, true);
        String cdn = "https://release-assets.githubusercontent.com/github-production-release-asset/123/abc-def?sig=example";
        url("GitHub CDN redirect", cdn, false, true, true);
        url("CDN cannot be initial", cdn, false, false, false);
        url("HTTP downgrade", APK.replace("https:", "http:"), false, true, false);
        url("host suffix spoof", APK.replace("github.com", "github.com.evil.test"), false, true, false);
        url("userinfo spoof", APK.replace("github.com", "github.com@evil.test"), false, true, false);
        url("userinfo on allowed host", APK.replace("github.com", "evil@github.com"), false, true, false);
        url("nonstandard port", APK.replace("github.com", "github.com:8443"), false, true, false);
        url("explicit port blocked", APK.replace("github.com", "github.com:443"), false, true, false);
        url("fragment blocked", APK + "#x", false, true, false);
        url("query on release blocked", APK + "?url=https://evil.test", false, true, false);
        url("foreign repo", APK.replace("Qinzi27/jibo", "someone/jibo"), false, true, false);
        url("different tag", APK.replace("/v1.5.0/", "/v1.4.0/"), false, true, false);
        url("different APK filename", APK.replace("jibo-v1.5.0.apk", "other.apk"), false, true, false);
        url("encoded path", APK.replace("jibo-v", "%6aibo-v"), false, true, false);
        url("encoded traversal", APK.replace("/v1.5.0/", "/%2e%2e/"), false, true, false);
        url("dot traversal", APK.replace("/v1.5.0/", "/../"), false, true, false);
        url("CDN wildcard rejected", cdn.replace("release-assets", "evil"), false, true, false);
        url("CDN root path rejected", "https://release-assets.githubusercontent.com/anything", false, true, false);
        url("CDN port rejected", cdn.replace(".com/", ".com:443/"), false, true, false);
        url("metadata cannot redirect to APK", APK, true, true, false);
        url("APK cannot redirect to metadata", UpdatePolicy.METADATA_URL, false, true, false);
        url("relative URL rejected", "/Qinzi27/jibo/releases/latest/download/jibo-update.json", true, false, false);
        url("malformed URL rejected", "https://github.com/with space", true, false, false);
        url("URL length cap", cdn + "a".repeat(17000), false, true, false);

        byte[] payload = "This represents an APK with bytes whose integrity matters.".getBytes(StandardCharsets.UTF_8);
        String digest = UpdatePolicy.hex(MessageDigest.getInstance("SHA-256").digest(payload));
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        UpdatePolicy.verifiedCopy(new ByteArrayInputStream(payload), output, payload.length, digest, bytes -> {});
        check("valid stream preserved byte for byte", Arrays.equals(payload, output.toByteArray()));
        rejects("truncated stream", () -> UpdatePolicy.verifiedCopy(new ByteArrayInputStream(Arrays.copyOf(payload, payload.length - 1)), new ByteArrayOutputStream(), payload.length, digest, b -> {}));
        rejects("oversized stream", () -> UpdatePolicy.verifiedCopy(new ByteArrayInputStream(payload), new ByteArrayOutputStream(), payload.length - 1, digest, b -> {}));
        byte[] corrupted = payload.clone(); corrupted[10] ^= 1;
        rejects("same length corruption", () -> UpdatePolicy.verifiedCopy(new ByteArrayInputStream(corrupted), new ByteArrayOutputStream(), payload.length, digest, b -> {}));
        rejects("wrong digest", () -> UpdatePolicy.verifiedCopy(new ByteArrayInputStream(payload), new ByteArrayOutputStream(), payload.length, HASH, b -> {}));
        rejects("cancel before copy", () -> UpdatePolicy.verifiedCopy(new ByteArrayInputStream(payload), new ByteArrayOutputStream(), payload.length, digest, b -> { throw new IOException("cancel"); }));
        rejects("cancel during copy", () -> UpdatePolicy.verifiedCopy(new ByteArrayInputStream(payload), new ByteArrayOutputStream(), payload.length, digest, b -> { if (b > 0) throw new IOException("cancel"); }));
        Thread.currentThread().interrupt();
        rejects("thread interruption cancels copy", () -> UpdatePolicy.verifiedCopy(new ByteArrayInputStream(payload), new ByteArrayOutputStream(), payload.length, digest, b -> {}));
        Thread.interrupted();
        rejects("unbounded advertised size", () -> UpdatePolicy.verifiedCopy(new ByteArrayInputStream(payload), new ByteArrayOutputStream(), Long.MAX_VALUE, digest, b -> {}));

        byte[] a = {1, 2, 3}, b = {4, 5, 6};
        check("single signer matches", UpdatePolicy.exactSigners(new byte[][]{a}, new byte[][]{a.clone()}));
        check("multisigner set order ignored", UpdatePolicy.exactSigners(new byte[][]{a, b}, new byte[][]{b, a}));
        check("changed signing key rejected", !UpdatePolicy.exactSigners(new byte[][]{a}, new byte[][]{b}));
        check("history overlap is not identity", !UpdatePolicy.exactSigners(new byte[][]{a}, new byte[][]{a, b}));
        check("missing signer rejected", !UpdatePolicy.exactSigners(null, new byte[][]{a}));
        check("empty signer sets rejected", !UpdatePolicy.exactSigners(new byte[][]{}, new byte[][]{}));
        check("null certificate rejected", !UpdatePolicy.exactSigners(new byte[][]{null}, new byte[][]{null}));
        check("empty certificate rejected", !UpdatePolicy.exactSigners(new byte[][]{{}}, new byte[][]{{}}));
        check("duplicate signer rejected", !UpdatePolicy.exactSigners(new byte[][]{a, a}, new byte[][]{a}));
        UpdatePolicy.Release r = valid();
        check("valid APK identity accepted", UpdatePolicy.acceptsApk(r, UpdatePolicy.PACKAGE_NAME, 7, VERSION, 26, 35, 6));
        check("APK different package rejected", !UpdatePolicy.acceptsApk(r, "app.evil", 7, VERSION, 26, 35, 6));
        check("APK code metadata mismatch", !UpdatePolicy.acceptsApk(r, UpdatePolicy.PACKAGE_NAME, 8, VERSION, 26, 35, 6));
        check("APK version label mismatch", !UpdatePolicy.acceptsApk(r, UpdatePolicy.PACKAGE_NAME, 7, "1.6.0", 26, 35, 6));
        check("APK same installed code rejected", !UpdatePolicy.acceptsApk(r, UpdatePolicy.PACKAGE_NAME, 7, VERSION, 26, 35, 7));
        check("APK downgrade rejected", !UpdatePolicy.acceptsApk(r, UpdatePolicy.PACKAGE_NAME, 7, VERSION, 26, 35, 8));
        check("APK min SDK metadata mismatch", !UpdatePolicy.acceptsApk(r, UpdatePolicy.PACKAGE_NAME, 7, VERSION, 28, 35, 6));
        check("APK unsupported device rejected", !UpdatePolicy.acceptsApk(r, UpdatePolicy.PACKAGE_NAME, 7, VERSION, 26, 25, 6));
        check("first foreground check due", UpdatePolicy.autoCheckDue(1000, 0));
        check("under daily limit suppressed", !UpdatePolicy.autoCheckDue(1001, 1000));
        check("daily limit exact boundary", UpdatePolicy.autoCheckDue(1000 + UpdatePolicy.AUTO_INTERVAL_MS, 1000));
        check("clock rollback suppresses repeat", !UpdatePolicy.autoCheckDue(999, 1000));
        System.out.println("UpdatePolicy: " + passed + " checks passed");
    }
}
