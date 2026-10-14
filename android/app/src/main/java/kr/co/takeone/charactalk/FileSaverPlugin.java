package kr.co.takeone.charactalk;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.DocumentsContract;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import android.util.Base64;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * 백업 파일을 휴대폰 '다운로드' 폴더에 저장하고, 거기서 다시 불러온다.
 *  · 저장: begin → append(여러 번) → finish / abort
 *  · 목록: list — 다운로드 폴더의 WitH-*.json (이 앱이 만든 파일)
 *  · 선택: pick — 시스템 파일 선택창을 '다운로드' 폴더에서 연다
 *  · 읽기: readBegin → readNext(여러 번) → readEnd (조각 단위 base64)
 * 큰 파일은 JS 에서 조각(base64)으로 나눠 보낸다: begin → append(여러 번) → finish.
 * 안드로이드 10+ 는 MediaStore(권한 불필요), 9 이하는 공용 Download 폴더에 직접 쓴다.
 */
@CapacitorPlugin(name = "FileSaver")
public class FileSaverPlugin extends Plugin {
  private OutputStream out;
  private Uri uri;
  private File legacyFile;
  private ContentValues pendingValues;
  private InputStream in;

  @PluginMethod
  public void begin(PluginCall call) {
    String name = call.getString("name", "backup.json");
    String mime = call.getString("mime", "application/json");
    try {
      close();
      ContentResolver cr = getContext().getContentResolver();
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        ContentValues v = new ContentValues();
        v.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
        v.put(MediaStore.MediaColumns.MIME_TYPE, mime);
        v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
        v.put(MediaStore.MediaColumns.IS_PENDING, 1);
        uri = cr.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
        if (uri == null) throw new Exception("insert failed");
        out = cr.openOutputStream(uri);
        pendingValues = v;
      } else {
        File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
        if (!dir.exists()) dir.mkdirs();
        legacyFile = new File(dir, name);
        out = new FileOutputStream(legacyFile);
      }
      call.resolve();
    } catch (Exception e) {
      close();
      call.reject("begin: " + e.getMessage());
    }
  }

  @PluginMethod
  public void append(PluginCall call) {
    try {
      String data = call.getString("data", "");
      byte[] bytes = Base64.decode(data, Base64.DEFAULT);
      out.write(bytes);
      call.resolve();
    } catch (Exception e) {
      call.reject("append: " + e.getMessage());
    }
  }

  @PluginMethod
  public void finish(PluginCall call) {
    try {
      out.flush();
      out.close();
      out = null;
      String where = "Download";
      if (uri != null) {
        ContentValues v = new ContentValues();
        v.put(MediaStore.MediaColumns.IS_PENDING, 0);
        getContext().getContentResolver().update(uri, v, null, null);
      } else if (legacyFile != null) {
        where = legacyFile.getAbsolutePath();
      }
      uri = null;
      legacyFile = null;
      JSObject r = new JSObject();
      r.put("path", where);
      call.resolve(r);
    } catch (Exception e) {
      call.reject("finish: " + e.getMessage());
    }
  }

  @PluginMethod
  public void abort(PluginCall call) {
    try {
      close();
      if (uri != null) getContext().getContentResolver().delete(uri, null, null);
      if (legacyFile != null) legacyFile.delete();
    } catch (Exception ignored) {
    }
    uri = null;
    legacyFile = null;
    call.resolve();
  }

  /** 다운로드 폴더의 백업 파일 목록 (WitH-*.json) */
  @PluginMethod
  public void list(PluginCall call) {
    try {
      JSArray items = new JSArray();
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        String[] proj = {MediaStore.MediaColumns._ID, MediaStore.MediaColumns.DISPLAY_NAME, MediaStore.MediaColumns.SIZE, MediaStore.MediaColumns.DATE_MODIFIED};
        try (Cursor c = getContext().getContentResolver().query(
            MediaStore.Downloads.EXTERNAL_CONTENT_URI, proj,
            MediaStore.MediaColumns.DISPLAY_NAME + " LIKE ?", new String[] {"WitH-%.json"},
            MediaStore.MediaColumns.DATE_MODIFIED + " DESC")) {
          while (c != null && c.moveToNext()) {
            JSObject o = new JSObject();
            long id = c.getLong(0);
            o.put("uri", Uri.withAppendedPath(MediaStore.Downloads.EXTERNAL_CONTENT_URI, String.valueOf(id)).toString());
            o.put("name", c.getString(1));
            o.put("size", c.getLong(2));
            o.put("modified", c.getLong(3) * 1000L);
            items.put(o);
          }
        }
      } else {
        File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
        File[] files = dir.listFiles((d, n) -> n.startsWith("WitH-") && n.endsWith(".json"));
        if (files != null) {
          java.util.Arrays.sort(files, (a, b) -> Long.compare(b.lastModified(), a.lastModified()));
          for (File f : files) {
            JSObject o = new JSObject();
            o.put("uri", Uri.fromFile(f).toString());
            o.put("name", f.getName());
            o.put("size", f.length());
            o.put("modified", f.lastModified());
            items.put(o);
          }
        }
      }
      JSObject r = new JSObject();
      r.put("items", items);
      call.resolve(r);
    } catch (Exception e) {
      call.reject("list: " + e.getMessage());
    }
  }

  /** 시스템 파일 선택창을 '다운로드' 폴더에서 연다 */
  @PluginMethod
  public void pick(PluginCall call) {
    Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
    intent.addCategory(Intent.CATEGORY_OPENABLE);
    intent.setType("*/*");
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      intent.putExtra(DocumentsContract.EXTRA_INITIAL_URI, DocumentsContract.buildDocumentUri("com.android.externalstorage.documents", "primary:Download"));
    }
    startActivityForResult(call, intent, "pickResult");
  }

  @ActivityCallback
  private void pickResult(PluginCall call, ActivityResult result) {
    if (call == null) return;
    Intent data = result.getData();
    if (result.getResultCode() != android.app.Activity.RESULT_OK || data == null || data.getData() == null) {
      JSObject r = new JSObject();
      r.put("cancelled", true);
      call.resolve(r);
      return;
    }
    Uri u = data.getData();
    String name = "backup.json";
    long size = 0;
    try (Cursor c = getContext().getContentResolver().query(u, null, null, null, null)) {
      if (c != null && c.moveToFirst()) {
        int ni = c.getColumnIndex(OpenableColumns.DISPLAY_NAME);
        int si = c.getColumnIndex(OpenableColumns.SIZE);
        if (ni >= 0) name = c.getString(ni);
        if (si >= 0) size = c.getLong(si);
      }
    } catch (Exception ignored) {
    }
    JSObject r = new JSObject();
    r.put("uri", u.toString());
    r.put("name", name);
    r.put("size", size);
    call.resolve(r);
  }

  @PluginMethod
  public void readBegin(PluginCall call) {
    try {
      closeIn();
      Uri u = Uri.parse(call.getString("uri", ""));
      if ("file".equals(u.getScheme())) in = new FileInputStream(new File(u.getPath()));
      else in = getContext().getContentResolver().openInputStream(u);
      if (in == null) throw new Exception("open failed");
      call.resolve();
    } catch (Exception e) {
      closeIn();
      call.reject("readBegin: " + e.getMessage());
    }
  }

  /** 다음 조각 (base64). 끝이면 done=true */
  @PluginMethod
  public void readNext(PluginCall call) {
    try {
      int len = call.getInt("length", 393216);
      byte[] buf = new byte[len];
      int total = 0;
      while (total < len) {
        int n = in.read(buf, total, len - total);
        if (n < 0) break;
        total += n;
      }
      JSObject r = new JSObject();
      r.put("data", total > 0 ? Base64.encodeToString(buf, 0, total, Base64.NO_WRAP) : "");
      r.put("done", total < len);
      call.resolve(r);
    } catch (Exception e) {
      call.reject("readNext: " + e.getMessage());
    }
  }

  @PluginMethod
  public void readEnd(PluginCall call) {
    closeIn();
    call.resolve();
  }

  private void closeIn() {
    try {
      if (in != null) in.close();
    } catch (Exception ignored) {
    }
    in = null;
  }

  private void close() {
    try {
      if (out != null) out.close();
    } catch (Exception ignored) {
    }
    out = null;
  }
}
