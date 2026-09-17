package app.leancrew.local;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;

/** Android-independent checks shared by the native file and WebView boundaries. */
final class LocalSecurityPolicy {
    static final String HOST = "appassets.androidplatform.net";
    static final String START_PATH = "/assets/www/index.html";

    private LocalSecurityPolicy() {}

    static boolean externalDocument(String scheme, String authority) {
        // SAF returns content URIs. Never pass file:// or our own providers to a
        // resolver using the app's permissions, even if a picker supplies them.
        if (!"content".equals(scheme) || authority == null
                || !authority.matches("[A-Za-z0-9][A-Za-z0-9._-]*")) return false;
        return !"app.leancrew.local.camera".equalsIgnoreCase(authority)
                && !"app.leancrew.local.updates".equalsIgnoreCase(authority);
    }

    static boolean bundledAsset(String scheme, String authority, String decodedPath) {
        return "https".equals(scheme) && HOST.equals(authority)
                && decodedPath != null && decodedPath.startsWith("/assets/www/")
                && !decodedPath.contains("..") && !decodedPath.contains("\\")
                && !decodedPath.contains("\u0000");
    }

    static boolean appDocument(String scheme, String authority, String decodedPath, String query) {
        return bundledAsset(scheme, authority, decodedPath)
                && START_PATH.equals(decodedPath) && query == null;
    }

    static byte[] readBounded(InputStream input, int limit) throws IOException {
        if (input == null || limit < 0) throw new IOException("Invalid bounded stream");
        ByteArrayOutputStream output = new ByteArrayOutputStream(Math.min(limit, 8192));
        byte[] buffer = new byte[8192];
        int count;
        while ((count = input.read(buffer)) != -1) {
            if (count > limit - output.size()) throw new IOException("Local data exceeds limit");
            output.write(buffer, 0, count);
        }
        return output.toByteArray();
    }
}
