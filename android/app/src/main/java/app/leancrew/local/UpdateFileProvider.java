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

/** Only the single verified APK can be shared, with a temporary read-only installer grant. */
public final class UpdateFileProvider extends ContentProvider {
    public static final String AUTHORITY = "app.leancrew.local.updates";
    public static final Uri APK_URI = Uri.parse("content://" + AUTHORITY + "/verified/update.apk");
    static File directory(Context context) { return new File(context.getCacheDir(), "jibo-updates"); }
    static File apkFile(Context context) { return new File(directory(context), "verified-update.apk"); }
    private File checkedFile(Uri uri) throws FileNotFoundException {
        if (!APK_URI.equals(uri) || getContext() == null) throw new FileNotFoundException("Unknown update URI");
        File file = apkFile(getContext());
        if (!file.isFile()) throw new FileNotFoundException("No verified update");
        return file;
    }
    @Override public boolean onCreate() { return true; }
    @Override public String getType(Uri uri) {
        if (!APK_URI.equals(uri)) throw new IllegalArgumentException("Unknown update URI");
        return "application/vnd.android.package-archive";
    }
    @Override public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        if (!"r".equals(mode)) throw new FileNotFoundException("Update APK is read-only");
        return ParcelFileDescriptor.open(checkedFile(uri), ParcelFileDescriptor.MODE_READ_ONLY);
    }
    @Override public Cursor query(Uri uri, String[] projection, String selection, String[] arguments, String order) {
        try {
            File file = checkedFile(uri);
            String[] columns = projection == null ? new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE} : projection;
            MatrixCursor cursor = new MatrixCursor(columns, 1);
            Object[] values = new Object[columns.length];
            for (int i = 0; i < columns.length; i++) {
                if (OpenableColumns.DISPLAY_NAME.equals(columns[i])) values[i] = "jibo-update.apk";
                if (OpenableColumns.SIZE.equals(columns[i])) values[i] = file.length();
            }
            cursor.addRow(values); return cursor;
        } catch (FileNotFoundException error) { return null; }
    }
    @Override public Uri insert(Uri uri, ContentValues values) { throw new UnsupportedOperationException("Read-only"); }
    @Override public int update(Uri uri, ContentValues values, String selection, String[] arguments) { throw new UnsupportedOperationException("Read-only"); }
    @Override public int delete(Uri uri, String selection, String[] arguments) { throw new UnsupportedOperationException("Read-only"); }
}
