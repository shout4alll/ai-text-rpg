"use client";

import { AVATAR_REACTIONS, AVATAR_REACTION_IDS, TOUCH_REACTIONS, TOUCH_REACTION_IDS, stagesOf, type AvatarReactionId, type TouchReactionId } from "@/config/reactions";
import { ALLURE_CLIP_MIN_AFFECTION } from "@/config/allure";
import { BALANCE } from "@/config/balance";

/**
 * 🎬 주인님 관리창 › 리액션 테스트 탭
 * 인물별 모든 리액션·영상 파일·연출 상황을 버튼으로 바로 발동시켜 본다 (AI 호출·확률·쿨다운 없이).
 * 실제 서비스 조건(호감도·멤버십·확률)이 왜 안 맞는지도 진단해서 보여 준다.
 */
export interface ReactionTestActions {
  persona: { id: string; name: string; relationshipType: "romance" | "friendship"; hasAllure: boolean };
  /** 인물 목록 (눌러서 그 인물 대화방으로 이동) */
  personas: { id: string; name: string }[];
  openPersona: (id: string) => void;
  affection: number;
  /** 실제로 있는 영상 파일 이름 */
  clips: { free: string[]; premium: string[]; allure: string[] };
  /** 카톡(메신저) 화면이면 영상이 안 보인다 */
  messengerView: boolean;
  showStage: () => void;
  /** 서비스에서 유료/매혹 영상을 쓸 수 있는 상태인지 */
  premiumUnlocked: boolean;
  allureActive: boolean;
  /** 리액션 id 로 재생 (그 리액션의 영상 후보 순서대로) */
  playReaction: (id: AvatarReactionId) => void;
  /** 영상 파일 하나만 정확히 재생 */
  playClip: (name: string) => void;
  playTouch: (id: TouchReactionId) => void;
  /** 디렉터 연출 시나리오 (조건 무시) */
  scenario: (kind: "stageUp" | "reconcile" | "gift" | "return" | "sulkStart" | "kiss", arg?: number) => void;
  setAffection: (v: number) => void;
}

const btn = "rounded bg-slate-800 px-2 py-1.5 text-left active:bg-slate-700 disabled:opacity-40";

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-3 rounded-xl bg-slate-900 p-2.5">
      <h3 className="mb-1.5 text-[11px] font-bold text-amber-200">{title}</h3>
      {children}
    </section>
  );
}

export default function ReactionTestTab({ t }: { t: ReactionTestActions }) {
  const T = BALANCE.director;
  const romance = t.persona.relationshipType === "romance";
  const hasKiss = t.clips.premium.includes("kiss") || t.clips.free.includes("kiss");
  const has = (n: string) => t.clips.free.includes(n) || t.clips.premium.includes(n);
  const stages = stagesOf(t.persona.relationshipType);

  // 실제 서비스에서 뽀뽀(kiss)가 나오려면: 연애형 + 호감도 + 이용권 + 영상 파일 (+ 확률·10분 간격)
  const kissChecks: [string, boolean, string][] = [
    ["연애형 인물", romance, romance ? "연애형" : "친구형 → 뽀뽀 없음"],
    [`호감도 ${T.kissAffection} 이상`, t.affection >= T.kissAffection, `지금 ${Math.round(t.affection)}`],
    ["유료 이용권(PRIME·치트룸)", t.premiumUnlocked, t.premiumUnlocked ? "있음" : "없음 → 잠금 안내만 나옴"],
    ["kiss 영상 파일", hasKiss, hasKiss ? "있음" : "이 인물은 kiss 영상 없음"],
  ];
  const kissOk = kissChecks.every((c) => c[1]);

  return (
    <div data-dev-reaction-test className="space-y-1">
      <Box title={`인물 선택 — 지금: ${t.persona.name}`}>
        <div className="flex flex-wrap gap-1">
          {t.personas.map((p) => (
            <button key={p.id} type="button" onClick={() => t.openPersona(p.id)} className={`rounded-full px-2.5 py-1 ${p.id === t.persona.id ? "bg-amber-300 font-bold text-slate-900" : "bg-slate-800 text-slate-300"}`}>
              {p.name}
            </button>
          ))}
        </div>
        {t.messengerView && (
          <p className="mt-2 rounded bg-red-900/60 p-2 text-red-100">
            지금 💬 카톡 화면이라 영상이 안 보여요.{" "}
            <button type="button" onClick={t.showStage} className="rounded bg-red-700 px-2 py-0.5 font-bold">영상 화면으로 전환</button>
          </p>
        )}
        <p className="mt-2 text-slate-400">이 탭의 버튼은 확률·쿨다운·호감도·이용권을 무시하고 바로 재생해요. 창은 ◐(투명)·–(접기)로 영상을 보면서 쓰세요.</p>
      </Box>

      <Box title="🔎 서비스에서 뽀뽀(kiss)가 안 나오는 이유 진단">
        <ul className="space-y-0.5">
          {kissChecks.map(([name, ok, why]) => (
            <li key={name}>
              <span className={ok ? "text-emerald-300" : "text-red-300"}>{ok ? "✓" : "✕"}</span> {name} <span className="text-slate-500">— {why}</span>
            </li>
          ))}
          <li className="text-slate-400">
            · 위가 모두 ✓ 여도 AI 가 kiss 를 고르거나 ❤️ 를 받은 순간({Math.round(T.kissFromHeartChance * 100)}%) / 머리 쓰다듬기 첫 터치({Math.round(T.kissFromHeadPatChance * 100)}%)에만, 그리고 마지막 뽀뽀 뒤 {Math.round(T.kissGapMs / 60000)}분이 지나야 나와요.
          </li>
        </ul>
        <p className={`mt-1 font-bold ${kissOk ? "text-emerald-300" : "text-amber-300"}`}>{kissOk ? "조건 충족 — 확률·간격만 남음" : "조건 미충족"}</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <button type="button" className={btn} onClick={() => t.setAffection(100)}>호감도 100 으로</button>
          <button type="button" className={btn} onClick={() => t.scenario("kiss")} disabled={!hasKiss}>💋 뽀뽀 연출 (kiss·kiss_close 번갈아)</button>
        </div>
      </Box>

      <Box title="🎞 영상 파일 (눌러서 정확히 그 파일만 재생)">
        {([
          ["무료", t.clips.free],
          ["유료(premium/)", t.clips.premium],
          ["매혹(allure/)", t.clips.allure],
        ] as const).map(([label, list]) =>
          list.length === 0 ? null : (
            <div key={label} className="mb-1.5">
              <div className="mb-0.5 text-slate-400">{label}</div>
              <div className="flex flex-wrap gap-1">
                {list.map((n) => {
                  const need = ALLURE_CLIP_MIN_AFFECTION[n.replace(/^allure_/, "")];
                  return (
                    <button key={n} type="button" className={btn} onClick={() => t.playClip(n)} title={need ? `서비스에선 호감도 ${need} 이상에서만` : undefined}>
                      ▶ {n}
                      {need ? <span className="text-slate-500"> ♥{need}</span> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          )
        )}
        {t.clips.free.length + t.clips.premium.length + t.clips.allure.length === 0 && <p className="text-slate-400">이 인물은 영상이 없어요 (화면 움직임만).</p>}
      </Box>

      <Box title="💬 AI 리액션 (답장에서 AI 가 고르는 표정) — 없으면 대체 영상·움직임">
        <div className="grid grid-cols-2 gap-1">
          {AVATAR_REACTION_IDS.map((id) => {
            const d = AVATAR_REACTIONS[id];
            const found = d.clips.find((c) => c !== "idle" && has(c));
            return (
              <button key={id} type="button" className={btn} onClick={() => t.playReaction(id)} title={d.when}>
                <b>{d.label}</b> <span className="text-slate-500">{id}</span>
                <div className={found ? "text-emerald-300" : "text-slate-500"}>{found ? `🎞 ${found}` : "움직임만"}{d.tier === "premium" ? " · 유료" : ""}</div>
              </button>
            );
          })}
        </div>
      </Box>

      <Box title="👆 터치 리액션 (화면 터치)">
        <div className="flex flex-wrap gap-1.5">
          {TOUCH_REACTION_IDS.map((id) => (
            <button key={id} type="button" className={btn} onClick={() => t.playTouch(id)}>{TOUCH_REACTIONS[id].label} <span className="text-slate-500">{id}</span></button>
          ))}
        </div>
      </Box>

      <Box title="🎬 특별한 순간 (디렉터 연출)">
        <div className="flex flex-wrap gap-1.5">
          {stages.map((s, i) => i === 0 ? null : (
            <button key={s.label} type="button" className={btn} onClick={() => t.scenario("stageUp", i)}>
              ⬆ {s.label} <span className="text-slate-500">→ {s.reward.reaction}</span>
            </button>
          ))}
          <button type="button" className={btn} onClick={() => t.scenario("return")}>🔙 오랜만에 돌아옴</button>
          <button type="button" className={btn} onClick={() => t.scenario("sulkStart")}>😤 삐짐 시작(등 돌림)</button>
          <button type="button" className={btn} onClick={() => t.scenario("reconcile")}>🤝 삐짐 풀림(화해)</button>
          <button type="button" className={btn} onClick={() => t.scenario("gift")}>🎁 선물로 풀림</button>
        </div>
      </Box>
    </div>
  );
}
