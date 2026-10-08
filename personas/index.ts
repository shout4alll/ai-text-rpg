/**
 * 페르소나 등록 목록.
 *
 * - 캐릭터 내용을 바꿀 때: 해당 JSON 파일만 수정하면 된다.
 * - 캐릭터를 추가할 때: personas/<id>.json 을 만들고 아래에 import 한 줄 + 목록 한 줄을 추가한다.
 * - 캐릭터를 숨길 때: 아래 목록에서 줄을 주석 처리한다.
 * - 목록의 순서가 선택 화면의 순서이고, 첫 번째가 기본 캐릭터다.
 *
 * 이 폴더는 public/ 이 아니므로 브라우저에서 직접 열 수 없다. (프롬프트 보호)
 */

import character_a from "./character_a.json";
import character_b from "./character_b.json";
import character_c from "./character_c.json";
import character_d from "./character_d.json";
import character_e from "./character_e.json";
import character_f from "./character_f.json";
import character_g from "./character_g.json";
import character_h from "./character_h.json";
import character_i from "./character_i.json";
import character_j from "./character_j.json";
import character_k from "./character_k.json";
import character_l from "./character_l.json";
import cheat_b from "./cheat_b.json";
import shared from "./_shared.json";

export const PERSONA_FILES: { file: string; data: unknown }[] = [
  { file: "character_a.json", data: character_a },
  { file: "character_b.json", data: character_b },
  { file: "character_c.json", data: character_c },
  { file: "character_d.json", data: character_d },
  { file: "character_e.json", data: character_e },
  { file: "character_f.json", data: character_f },
  { file: "character_g.json", data: character_g },
  { file: "character_h.json", data: character_h },
  { file: "character_i.json", data: character_i },
  { file: "character_j.json", data: character_j },
  { file: "character_k.json", data: character_k },
  { file: "character_l.json", data: character_l },
  // 🔑 치트룸 (cheatRoom: true) — 치트 코드로 입장한 운영자에게만 목록에 보이고 서버도 운영자 인증 없이는 응답하지 않는다
  { file: "cheat_b.json", data: cheat_b },
];

export const SHARED_FILE: unknown = shared;
