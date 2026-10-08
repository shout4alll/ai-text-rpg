import { NextResponse } from "next/server";
import { describeFallbacks, describeModel, providerKeys } from "@/config/ai";
import { modelStats } from "@/lib/modelRouter";
import { resolveSetting, settingValue } from "@/config/settings";
import { MODEL_CHOICES } from "@/config/models";
import { SAFETY_RULES, MINOR_GUARD, absoluteRules } from "@/config/rules";
import { defaultLevelRules } from "@/config/allure";
import { defaultOwnerRules, isOwnerToken } from "@/lib/owner";
import { PERSONA_FIELDS, RULE_FIELDS, applyPersonaOverride, type OverrideValue } from "@/lib/ownerOverrides";
import { persistedPersona, persistedRules } from "@/lib/overridesStore";
import { DEFAULT_PERSONA_ID, getPersonaFile, isPersonaId, SHARED_RULES_LIST } from "@/lib/personas/server";

/**
 * GET /api/owner/config?persona=<id> — 🛠 모델·캐릭터·규칙 탭이 쓰는 "현재 기본값" (헤더 x-owner-token 필요)
 *  편집 폼은 이 값 + 항목 정의(lib/ownerOverrides.ts)로 자동으로 그려진다. 테스트 편집값은 앱이 보관한다.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isOwnerToken(request.headers.get("x-owner-token"))) {
    return NextResponse.json({ error: "주인님 모드에서만 볼 수 있어요." }, { status: 403 });
  }
  const id = new URL(request.url).searchParams.get("persona") ?? DEFAULT_PERSONA_ID;
  const base = getPersonaFile(isPersonaId(id) ? id : DEFAULT_PERSONA_ID);
  // 편집창의 "기본값" = 파일 + CMS 저장값 (🛠 테스트값은 앱에 따로 있음)
  const { persona: p, extra } = applyPersonaOverride(base, persistedPersona(base.id));

  const personaDefaults: Record<string, OverrideValue | undefined> = {
    occupation: p.occupation,
    age: p.age,
    identity: p.prompt.identity,
    personality: p.prompt.personality,
    speech: p.prompt.speech,
    chatStyle: p.prompt.chatStyle,
    lifestyle: p.prompt.lifestyle,
    relationship: p.prompt.relationship,
    examples: p.prompt.examples,
    temperature: p.prompt.temperature ?? 1,
    background: p.story?.background ?? "",
    allurePrompt: p.allure?.prompt ?? "",
    extra: extra ?? "",
  };
  const pr = persistedRules();
  const rulesDefaults: Record<string, OverrideValue> = {
    shared: (pr?.shared as string[] | undefined) ?? SHARED_RULES_LIST,
    safety: (pr?.safety as string[] | undefined) ?? [...SAFETY_RULES],
    absolute: (pr?.absolute as string[] | undefined) ?? absoluteRules(p.name),
    allureRules: (pr?.allureRules as string | undefined) ?? defaultLevelRules(p.name, p.gender),
    ownerRules: (pr?.ownerRules as string | undefined) ?? p.cheatRules ?? defaultOwnerRules(p.name),
  };

  const keys = providerKeys();
  const m = describeModel();
  return NextResponse.json({
    models: {
      choices: MODEL_CHOICES.map((c) => ({ ...c, hasKey: keys[c.provider] })),
      providers: keys,
      server: { provider: m.provider, main: m.modelId, light: m.lightModelId, cheap: m.cheapModelId, mature: resolveSetting("matureModel").value || "" },
      fallbackOn: settingValue("serviceFallback") !== "off",
      fallback: describeFallbacks().map((f) => {
        const st = modelStats().find((x) => x.id === f.modelId);
        return { ...f, ok: st?.ok ?? 0, fail: st?.fail ?? 0, rate: st?.rate ?? 50 };
      }),
    },
    persona: { id: p.id, name: p.name, hasAllure: !!p.allure, fields: PERSONA_FIELDS, defaults: personaDefaults },
    rules: { fields: RULE_FIELDS, defaults: rulesDefaults, hard: [MINOR_GUARD] },
  });
}
