/**
 * 리액션 디렉터 — "언제 영상을 틀지"를 정하는 연출 담당 (클라이언트 전용, 비용 0)
 *
 * 영상 리액션은 자주 나오면 금방 질리고, 적절할 때 나와야 "또 보고 싶은" 장면이 된다.
 * 그래서 AI가 고른 리액션이나 터치를 그대로 재생하지 않고, 여기서 한 번 걸러서 연출한다.
 *
 *  ▸ 평소: 강한 감정(웃음·부끄러움·설렘·삐짐)일 때만 확률적으로 영상, 나머지는 화면 움직임 + 이모지
 *      인물 성향(traits.reactionBias)에 따라 확률이 달라진다 (예: 잘 웃는 사람은 웃음 영상이 더 자주)
 *  ▸ 쿨다운: 영상 사이 최소 간격, 같은 영상 반복 금지
 *  ▸ 특별한 순간(쿨다운 무시하고 반드시 영상):
 *      - 호감도 단계가 오를 때 → 단계별 보상 리액션 (config/balance.json affection.stages[].reward)
 *      - 오랜만에 돌아왔을 때
 *      - 삐짐이 풀릴 때 (화해 장면 / 선물이면 더 특별한 반응)
 *  ▸ 삐짐(등 돌림): 시작·해제 "판단"은 lib/sulk.ts + ChatApp 이 하고, 여기서는 영상만 정한다.
 *  ▸ 💋 매혹 모드(성인·멤버십): 설렘·부끄러움 순간과 쓰다듬기 터치에 가끔 clips/allure/ 영상 (config/allure.ts)
 *  ▸ 뽀뽀(kiss, 유료): 연애형 + 호감도 kissAffection 이상 + kissGapMs 에 한 번 이하. 이용권이 없으면 설렘 영상 + 잠금 안내.
 *
 * 수치는 모두 config/balance.json 의 director · allure 에 있다. (docs/BALANCE.md)
 */
import {
  AVATAR_REACTIONS,
  TOUCH_REACTIONS,
  stagesOf,
  isAvatarReactionId,
  type AvatarReactionId,
  type HeartReactionId,
  type ReactionCue,
  type TouchReactionId,
} from "@/config/reactions";
import { ALLURE_TINT, ALLURE_TOUCH_TRIGGERS, ALLURE_TRIGGERS, ALLURE_TUNING } from "@/config/allure";
import { BALANCE } from "@/config/balance";

/** 연출 수치 — config/balance.json 의 director */
export const DIRECTOR_TUNING = BALANCE.director;

/** 평소에도 영상으로 보여 줄 만한 "강한" 감정 */
const STRONG: ReadonlySet<AvatarReactionId> = new Set(["laugh", "shy", "love", "pout", "excited", "surprised", "touched", "sad"]);
/** 화해 장면에 쓸 수 있는 긍정 반응 */
const POSITIVE: ReadonlySet<AvatarReactionId> = new Set(["smile", "laugh", "shy", "love", "touched", "excited", "comfort", "kiss"]);

export type SulkRelease = "heart" | "words" | "gift" | "time";

export type DirectorEvent =
  | {
      type: "ai";
      reaction: AvatarReactionId;
      affectionDelta: number;
      /** 이번 답장이 무엇에 대한 것인지 */
      kind: "text" | "reaction" | "return" | "voice" | "media" | "gift";
      /** kind=reaction: 유저가 보낸 마음 */
      heart?: HeartReactionId;
      /** 이번 답장으로 삐짐이 시작됨 (lib/sulk.ts 가 판단) */
      sulkStart?: boolean;
      /** 이번 답장/행동으로 삐짐이 풀림 */
      sulkRelease?: SulkRelease;
      /** 호감도가 "처음으로" 이 단계(번호)에 올라섬 → 단계 보상 리액션 */
      stageUp?: number;
    }
  | { type: "touch"; touch: TouchReactionId; combo: number };

export interface DirectorContext {
  /** 이번 이벤트 반영 전 호감도 */
  affection: number;
  /** 이번 이벤트 반영 후 호감도 */
  nextAffection: number;
  relationship: "romance" | "friendship";
  /** 유료 리액션 이용 가능 여부 */
  premium: boolean;
  /** 이 인물에게 실제로 있는 영상 이름 (무료 + 이용 가능한 유료) */
  hasClip: (name: string) => boolean;
  /** 유료 영상이 준비돼 있는지 (잠금 안내를 띄울지 판단) */
  hasPremiumClip: (name: string) => boolean;
  /** 💋 매혹 모드가 켜져 있을 때 쓸 수 있는 매혹 영상 이름 (꺼져 있으면 빈 배열) */
  allureClips?: string[];
  /** 지금 삐져 있는지 (등 돌린 상태) */
  sulking?: boolean;
  /** 인물 성향: 리액션별 영상 확률 배수 (personas/<id>.json traits.reactionBias) */
  reactionBias?: Partial<Record<string, number>>;
}

export interface DirectorDecision {
  /** 3D 모드·디버그 표시용 */
  reaction: AvatarReactionId;
  /** 화면이 재생할 것. clips 가 비어 있으면 움직임만. null 이면 아무것도 하지 않음(현재 상태 유지) */
  cue: ReactionCue | null;
  /** 떠오르는 이모지 */
  particles?: string[];
  /** 터치 연타로 삐짐 시작 (ChatApp 이 단계·자동 해제를 정한다) */
  touchSulk?: boolean;
  /** 유료 리액션 잠금 안내 */
  teaser?: AvatarReactionId;
  /** 단계 상승 연출이었는지 */
  stageUp?: boolean;
  /** 영상으로 재생했는지 (디버그) */
  video: boolean;
}

export function createReactionDirector() {
  const T = DIRECTOR_TUNING;
  let lastAiVideo = 0;
  let lastTouchVideo = 0;
  const lastClip = new Map<string, number>();
  let lastKiss = 0;
  let lastTeaser = 0;
  let lastAllure = 0;

  const now = () => Date.now();
  const firstClip = (clips: string[], ctx: DirectorContext) => clips.find((c) => c !== "idle" && ctx.hasClip(c));
  const bias = (id: string, ctx: DirectorContext) => {
    const b = ctx.reactionBias?.[id];
    return typeof b === "number" && Number.isFinite(b) ? Math.max(0, b) : 1;
  };

  /** 영상 cue (실제 영상이 없으면 움직임으로 자동 대체되므로 그대로 넘겨도 안전) */
  const videoCue = (id: AvatarReactionId): ReactionCue => {
    const d = AVATAR_REACTIONS[id];
    return { clips: d.clips, motion: d.motion, tint: d.tint, hold: d.hold };
  };
  /** 움직임 + 이모지만 */
  const motionCue = (id: AvatarReactionId): ReactionCue => {
    const d = AVATAR_REACTIONS[id];
    return { clips: [], motion: d.motion, tint: d.tint };
  };

  const markVideo = (clip: string | undefined, kind: "ai" | "touch") => {
    const t = now();
    if (clip) lastClip.set(clip, t);
    if (kind === "ai") lastAiVideo = t;
    else lastTouchVideo = t;
  };

  /** 뽀뽀 가능? (불가하면 이유) */
  const kissCheck = (ctx: DirectorContext, ignoreGap = false): "ok" | "locked" | "no" => {
    if (ctx.relationship !== "romance") return "no";
    if (ctx.nextAffection < T.kissAffection) return "no";
    if (!ignoreGap && now() - lastKiss < T.kissGapMs) return "no";
    if (!ctx.premium) return ctx.hasPremiumClip("kiss") ? "locked" : "no";
    return ctx.hasClip("kiss") ? "ok" : "no";
  };

  const maybeTeaser = (): AvatarReactionId | undefined => {
    if (now() - lastTeaser < T.teaserGapMs) return undefined;
    lastTeaser = now();
    return "kiss";
  };

  /**
   * 💋 매혹 모드: 어울리는 순간이면 매혹 영상 하나를 고른다 (없으면 undefined).
   * 너무 자주 나오지 않게 간격·같은 영상 반복·확률로 거른다.
   */
  const pickAllure = (ctx: DirectorContext, chance: number, force = false): string | undefined => {
    const pool = ctx.allureClips ?? [];
    if (pool.length === 0) return undefined;
    const t = now();
    if (!force && (t - lastAllure < ALLURE_TUNING.gapMs || Math.random() >= chance)) return undefined;
    const fresh = pool.filter((c) => t - (lastClip.get(c) ?? 0) > ALLURE_TUNING.sameClipGapMs);
    const from = fresh.length ? fresh : force ? pool : [];
    if (from.length === 0) return undefined;
    return from[Math.floor(Math.random() * from.length)];
  };
  const allureDecision = (clip: string, kind: "ai" | "touch"): DirectorDecision => {
    lastAllure = now();
    markVideo(clip, kind);
    return {
      reaction: "love",
      cue: { clips: [clip], motion: "none", tint: ALLURE_TINT },
      particles: ["💋", "✨", "💗"],
      video: true,
    };
  };

  /** 특별한 순간: 쿨다운 무시하고 영상 */
  const special = (id: AvatarReactionId, ctx: DirectorContext, extra?: Partial<DirectorDecision>): DirectorDecision => {
    const d = AVATAR_REACTIONS[id];
    markVideo(firstClip(d.clips, ctx), "ai");
    if (id === "kiss") lastKiss = now();
    return { reaction: id, cue: videoCue(id), particles: d.particles, video: true, ...extra };
  };

  /** 보상 리액션 (kiss 는 조건이 맞을 때만, 아니면 설렘/잠금 안내) */
  const reward = (want: AvatarReactionId, ctx: DirectorContext, extra?: Partial<DirectorDecision>): DirectorDecision => {
    if (want === "kiss") {
      const k = kissCheck(ctx, true);
      if (k === "ok") return special("kiss", ctx, extra);
      if (k === "locked") return special("love", ctx, { teaser: maybeTeaser(), ...extra });
      return special(ctx.relationship === "romance" ? "love" : "laugh", ctx, extra);
    }
    return special(want, ctx, extra);
  };

  function decideAi(ev: Extract<DirectorEvent, { type: "ai" }>, ctx: DirectorContext): DirectorDecision {
    let id = ev.reaction;
    const t = now();
    const romance = ctx.relationship === "romance";

    // 0) 삐짐이 풀림 → 화해 장면 (선물이면 더 특별하게)
    if (ev.sulkRelease) {
      if (ev.sulkRelease === "gift") {
        const g = BALANCE.sulk.gift;
        const want = (isAvatarReactionId(g.reaction) ? g.reaction : "love") as AvatarReactionId;
        if (g.kissIfPossible && kissCheck(ctx, true) === "ok") return special("kiss", ctx);
        return special(want, ctx);
      }
      const back: AvatarReactionId = romance && ctx.nextAffection >= 45 ? "love" : "shy";
      return special(POSITIVE.has(id) && id !== "kiss" && ctx.hasClip(id) ? id : back, ctx);
    }

    // 1) 삐짐 시작 → 등 돌림 (등 돌린 채 멈춤)
    if (ev.sulkStart) {
      if (ctx.hasClip("turn_away")) return special("turn_away", ctx);
      return { reaction: "pout", cue: { ...motionCue("pout"), hold: false }, particles: ["💢"], video: false };
    }

    // 2) 아직 삐져 있음: 등 돌린 채 그대로 (말풍선만 나온다)
    if (ctx.sulking) return { reaction: "turn_away", cue: null, particles: ["💢"], video: false };

    if (id === "turn_away") id = "pout"; // 삐짐 판단은 lib/sulk.ts 가 한다 → 여기선 삐침 표정으로

    // 3) 호감도 단계에 처음 올라섬 → 단계별 보상 리액션 (다시 올라온 건 보상 없음)
    const stages = stagesOf(ctx.relationship);
    if (ev.stageUp !== undefined && stages[ev.stageUp]) {
      const want = stages[ev.stageUp].reward.reaction;
      return reward((isAvatarReactionId(want) ? want : romance ? "love" : "laugh") as AvatarReactionId, ctx, { stageUp: true });
    }

    // 4) 오랜만에 돌아옴 → 반가운 눈빛
    if (ev.kind === "return") return special(romance ? "love" : "laugh", ctx);

    // 5) 뽀뽀: AI가 골랐거나, 특별한 사이에서 ❤️ 를 받았을 때 가끔
    const kissWanted =
      id === "kiss" ||
      (ev.kind === "reaction" && ev.heart === "love" && (id === "love" || id === "shy") && Math.random() < T.kissFromHeartChance);
    if (kissWanted) {
      const k = kissCheck(ctx);
      if (k === "ok") return special("kiss", ctx);
      if (k === "locked") {
        const teaser = maybeTeaser();
        if (teaser) return special("love", ctx, { teaser });
      }
      id = "love";
    }

    const def = AVATAR_REACTIONS[id] ?? AVATAR_REACTIONS.idle;
    if (id === "idle") return { reaction: id, cue: null, video: false };

    // 5.5) 💋 매혹 모드: 설렘·부끄러움 같은 순간엔 매혹 영상
    if ((ALLURE_TRIGGERS as readonly string[]).includes(id) && ev.affectionDelta >= 0) {
      const a = pickAllure(ctx, ev.kind === "reaction" ? ALLURE_TUNING.heartChance : ALLURE_TUNING.aiChance);
      if (a) return allureDecision(a, "ai");
    }

    // 6) 평소: 강한 감정 + 쿨다운 + 확률 (인물 성향 배수 적용)
    const clip = firstClip(def.clips, ctx);
    const baseChance = ev.kind === "reaction" || ev.kind === "media" ? T.heartVideoChance : T.aiVideoChance;
    const canVideo =
      !!clip &&
      STRONG.has(id) &&
      t - lastAiVideo > T.aiVideoGapMs &&
      t - (lastClip.get(clip) ?? 0) > T.sameClipGapMs &&
      Math.random() < Math.min(1, baseChance * bias(id, ctx));

    if (canVideo) {
      markVideo(clip, "ai");
      return { reaction: id, cue: videoCue(id), particles: def.particles, video: true };
    }
    return { reaction: id, cue: motionCue(id), particles: def.particles, video: false };
  }

  function decideTouch(ev: Extract<DirectorEvent, { type: "touch" }>, ctx: DirectorContext): DirectorDecision {
    const t = now();
    const def = TOUCH_REACTIONS[ev.touch];

    // 삐져 있는 동안엔 영상 없이 💢 만
    if (ctx.sulking) return { reaction: "turn_away", cue: null, particles: ["💢"], video: false };

    // 너무 심한 연타 → 등 돌림 (일정 시간 뒤 저절로 풀림)
    if (ev.combo >= T.touchTurnAwayCombo && ctx.hasClip("turn_away")) {
      const d = AVATAR_REACTIONS.turn_away;
      markVideo("turn_away", "touch");
      return { reaction: "turn_away", cue: videoCue("turn_away"), particles: d.particles, touchSulk: true, video: true };
    }

    // 💋 매혹 모드: 머리 쓰다듬기·볼 터치 첫 터치엔 가끔 매혹 영상
    if (ev.combo === 1 && (ALLURE_TOUCH_TRIGGERS as readonly string[]).includes(ev.touch) && t - lastTouchVideo > T.touchVideoGapMs) {
      const a = pickAllure(ctx, ALLURE_TUNING.touchChance);
      if (a) return allureDecision(a, "touch");
    }

    // 특별한 사이에서 머리를 쓰다듬으면 아주 가끔 뽀뽀
    if (ev.touch === "lovely" && ev.combo === 1 && Math.random() < T.kissFromHeadPatChance) {
      const k = kissCheck(ctx);
      if (k === "ok") {
        lastKiss = t;
        markVideo("kiss", "touch");
        return { reaction: "kiss", cue: videoCue("kiss"), particles: AVATAR_REACTIONS.kiss.particles, video: true };
      }
    }

    const clip = firstClip(def.clips, ctx);
    const canVideo =
      !!clip &&
      t - lastTouchVideo > T.touchVideoGapMs &&
      t - (lastClip.get(clip) ?? 0) > T.touchSameClipGapMs &&
      // 첫 터치는 바로 영상, 연타 중엔 앙탈(pout) 영상만
      (ev.combo === 1 || ev.touch === "pout") &&
      Math.random() < Math.min(1, bias(def.avatar, ctx));

    if (canVideo) {
      markVideo(clip, "touch");
      return { reaction: def.avatar, cue: { clips: def.clips, motion: def.motion, tint: def.tint }, particles: def.particles, video: true };
    }
    return { reaction: def.avatar, cue: { clips: [], motion: def.motion, tint: def.tint }, particles: def.particles, video: false };
  }

  return {
    decide(ev: DirectorEvent, ctx: DirectorContext): DirectorDecision {
      return ev.type === "ai" ? decideAi(ev, ctx) : decideTouch(ev, ctx);
    },
    /** 💋 매혹 모드를 켠 순간: 매혹 영상 하나를 바로 보여 준다 (등 돌린 중이면 없음) */
    allureIntro(ctx: DirectorContext): DirectorDecision | null {
      if (ctx.sulking) return null;
      const a = pickAllure(ctx, 1, true);
      return a ? allureDecision(a, "ai") : null;
    },
    reset() {
      lastAiVideo = lastTouchVideo = lastAllure = 0;
      lastClip.clear();
    },
  };
}

export type ReactionDirector = ReturnType<typeof createReactionDirector>;
