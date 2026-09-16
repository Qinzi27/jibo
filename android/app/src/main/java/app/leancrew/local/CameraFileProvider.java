package app.leancrew.local;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.util.List;
import java.util.UUID;

/** One-photo URI grants for the external camera. No general filesystem access. */
public final class CameraFileProvider extends ContentProvider {
    static final String AUTHORITY = "app.leancrew.local.camera";

    static Uri createCapture(Context context) throws IOException {
        File folder = new File(context.getCacheDir(), "camera");
        if (!folder.isDirectory() && !folder.mkdirs()) throw new IOException("Cannot create camera cache");
        File photo = new File(folder, UUID.randomUUID().toString() + ".jpg");
        if (!photo.createNewFile()) throw new IOException("Cannot create photo");
        return new Uri.Builder().scheme("content").authority(AUTHORITY).appendPath("capture").appendPath(photo.getName()).build();
    }

    static File captureFile(Context context, Uri uri) {
        if (uri == null || !"content".equals(uri.getScheme()) || !AUTHORITY.equals(uri.getAuthority())
                || uri.getQuery() != null || uri.getFragment() != null) return null;
        List<String> parts = uri.getPathSegments();
        if (parts.size() != 2 || !"capture".equals(parts.get(0))
                || !parts.get(1).matches("[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\\.jpg")) return null;
        return new File(new File(context.getCacheDir(), "camera"), parts.get(1));
    }

    static void deleteCapture(Context context, Uri uri) {
        File photo = captureFile(context, uri);
        if (photo != null) photo.delete();
    }

    static void pruneOldFiles(Context context) {
        File[] photos = new File(context.getCacheDir(), "camera").listFiles();
        if (photos == null) return;
        long cutoff = System.currentTimeMillis() - 24L * 60 * 60 * 1000;
        for (File photo : photos) if (photo.isFile() && photo.lastModified() < cutoff) photo.delete();
    }

    @Override public boolean onCreate() { return true; }

    @Override public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        File photo = captureFile(getContext(), uri);
        if (photo == null || !photo.isFile()) throw new FileNotFoundException("Unknown photo");
        if (!"r".equals(mode) && !"w".equals(mode) && !"wt".equals(mode) && !"rw".equals(mode) && !"rwt".equals(mode))
            throw new FileNotFoundException("Unsupported mode");
        return ParcelFileDescriptor.open(photo, ParcelFileDescriptor.parseMode(mode));
    }

    @Override public String getType(Uri uri) {
        return captureFile(getContext(), uri) == null ? null : "image/jpeg";
    }

    @Override public Cursor query(Uri uri, String[] projection, String selection, String[] args, String sortOrder) {
        File photo = captureFile(getContext(), uri);
        if (photo == null || !photo.isFile()) return null;
        String[] columns = projection == null ? new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE} : projection;
        MatrixCursor result = new MatrixCursor(columns, 1);
        Object[] values = new Object[columns.length];
        for (int i = 0; i < columns.length; i++) {
            if (OpenableColumns.DISPLAY_NAME.equals(columns[i])) values[i] = photo.getName();
            else if (OpenableColumns.SIZE.equals(columns[i])) values[i] = photo.length();
        }
        result.addRow(values);
        return result;
    }

    @Override public Uri insert(Uri uri, ContentValues values) { throw new UnsupportedOperationException(); }
    @Override public int update(Uri uri, ContentValues values, String selection, String[] args) { throw new UnsupportedOperationException(); }
    @Override public int delete(Uri uri, String selection, String[] args) { throw new UnsupportedOperationException(); }
}
