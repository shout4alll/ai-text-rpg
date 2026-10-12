package kr.co.takeone.charactalk;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(FileSaverPlugin.class); // 백업 파일 → 다운로드 폴더
    super.onCreate(savedInstanceState);
  }
}
