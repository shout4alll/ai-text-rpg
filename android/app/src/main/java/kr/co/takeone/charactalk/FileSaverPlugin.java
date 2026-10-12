package kr.co.takeone.charactalk;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * 백업 파일을 휴대폰 '다운로드' 폴더에 저장한다.
 * 큰 파일은 JS 에서 조각(base64)으로 나눠 보낸다: begin → append(여러 번) → finish.
 * 안드로이드 10+ 는 MediaStore(권한 불필요), 9 이하는 공용 Download 폴더에 직접 쓴다.
 */
@CapacitorPlugin(name = "FileSaver")
public class FileSaverPlugin extends Plugin {
  private OutputStream out;
  private Uri uri;
  private File legacyFile;
  private ContentValues pendingValues;

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

  private void close() {
    try {
      if (out != null) out.close();
    } catch (Exception ignored) {
    }
    out = null;
  }
}
