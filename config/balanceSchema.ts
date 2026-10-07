import { z } from "zod";

/**
 * config/balance.json 의 형식 (빌드 시 lib/personas/server.ts 에서 검사).
 * 값을 바꿨는데 형식이 틀리면 "어느 항목이 왜 틀렸는지" 빌드 에러로 알려 준다.
 */
const reactionId = z.enum([
  "idle", "smile", "laugh", "nod", "shake", "shy", "love", "pout", "surprised", "sad",
  "touched", "thinking", "excited", "comfort", "sleepy", "turn_away", "kiss",
]);
const heartId = z.enum(["love", "like", "joy", "shy", "pout", "touched", "haha", "hug", "wow", "sad"]);
const chance = z.number().min(0).max(1);
const ms = z.number().int().min(0);

const stage = z.object({
  min: z.number().min(0).max(100),
  label: z.string().min(1),
  guide: z.string().min(1),
  reward: z.object({ reaction: reactionId, bonusCash: z.number().int().min(0) }),
});
const stages = z
  .array(stage)
  .min(2)
  .refine((s) => s[0].min === 0, "첫 단계의 min 은 0 이어야 함")
  .refine((s) => s.every((x, i) => i === 0 || x.min > s[i - 1].min), "단계 min 은 오름차순이어야 함");

const plan = z.object({
  name: z.string().min(1),
  priceKrw: z.number().int().min(0),
  voiceMinutes: z.number().int().min(0),
  photos: z.number().int().min(0),
  premiumReactions: z.boolean(),
  bonusCash: z.number().int().min(0),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  tagline: z.string(),
});

export const balanceSchema = z.object({
  _readme: z.string().optional(),
  affection: z.object({
    start: z.number().min(0).max(100),
    max: z.literal(100),
    stepCap: z.number().int().min(1).max(20),
    gainMultiplier: z.number().min(0).max(5),
    lossMultiplier: z.number().min(0).max(5),
    gainWhileSulking: z.number().min(0).max(1),
    heartReactionMaxGain: z.number().int().min(0).max(10),
    stages: z.object({ romance: stages, friendship: stages }),
    stageUpBannerMs: ms,
    stageDownNotice: z.boolean(),
  }),
  sulk: z.object({
    startDrop: z.number().int().max(-1),
    levelByDrop: z.array(z.object({ maxDelta: z.number().int().max(0), level: z.number().int().min(1).max(3) })).min(1),
    levelBonusByStage: z.array(z.number().int().min(0).max(2)).min(1),
    escalateWindowMin: z.number().min(0),
    sootheDelta: z.number().int().min(1),
    levels: z
      .array(
        z.object({
          level: z.number().int().min(1).max(3),
          label: z.string().min(1),
          freeHearts: z.array(heartId),
          sootheNeeded: z.number().int().min(1).max(10),
          giftCost: z.number().int().min(0),
          autoReleaseMin: z.number().min(0),
          hint: z.string(),
        })
      )
      .length(3, "levels 는 1·2·3 단계 3개"),
    gift: z.object({ affectionBonus: z.number().int().min(0).max(20), reaction: reactionId, kissIfPossible: z.boolean() }),
    touch: z.object({ level: z.number().int().min(1).max(3), autoReleaseSec: z.number().min(0) }),
  }),
  touch: z.object({
    comboMs: ms,
    fireGapMs: ms,
    poutCombo: z.number().int().min(1),
    poutComboMaybe: z.number().int().min(1),
    poutComboMaybeChance: chance,
    shyUntil: z.number().min(0).max(100),
    closeFrom: z.number().min(0).max(100),
  }),
  director: z.object({
    aiVideoGapMs: ms,
    sameClipGapMs: ms,
    aiVideoChance: chance,
    heartVideoChance: chance,
    touchVideoGapMs: ms,
    touchSameClipGapMs: ms,
    touchTurnAwayCombo: z.number().int().min(2),
    kissGapMs: ms,
    kissAffection: z.number().min(0).max(100),
    kissFromHeartChance: chance,
    kissFromHeadPatChance: chance,
    teaserGapMs: ms,
  }),
  allure: z.object({ gapMs: ms, sameClipGapMs: ms, aiChance: chance, heartChance: chance, touchChance: chance }),
  userMedia: z.object({
    maxImageSide: z.number().int().min(256).max(4096),
    modelImageSide: z.number().int().min(256).max(2048),
    videoFrames: z.number().int().min(1).max(6),
    maxVideoMB: z.number().min(1).max(500),
    maxPerDay: z.number().int().min(0),
    affectionMaxGain: z.number().int().min(0).max(10),
  }),
  aiMedia: z.object({
    requireUserRequest: z.boolean(),
    cooldownTurns: z.number().int().min(0),
    requestKeywords: z.array(z.string().min(1)).min(1),
  }),
  voice: z.object({ freeExchanges: z.number().int().min(0), trialMaxSeconds: z.number().int().min(10), touchNotifyGapMs: ms }),
  cash: z.object({
    voicePerMinute: z.number().int().min(0),
    photo: z.number().int().min(0),
    demoStart: z.number().int().min(0),
    demoTopup: z.number().int().min(0),
  }),
  plans: z.object({ free: plan, best: plan, prime: plan, vip: plan }),
});

export type Balance = z.infer<typeof balanceSchema>;
