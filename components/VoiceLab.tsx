"use client";

import { apiUrl } from "@/lib/apiBase";
import { useEffect, useMemo, useRef, useState } from "react";
import PersonaPortrait from "@/components/PersonaPortrait";
import { GEMINI_VOICES, readVoiceOverride, writeVoiceOverride, type GeminiVoiceName } from "@/config/voices";
import type { Persona } from "@/lib/personas/types";

/** L16 PCM(base64) → WAV Blob URL */
function pcmToWavUrl(b64: string, mime: string): string {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  if (/wav/i.test(mime) || (bytes[0] === 0x52 && bytes[1] === 0x49)) {
    return URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
  }
  const rate = Number(/rate=(\d+)/.exec(mime)?.[1] ?? 24000);
  const h = new DataView(new ArrayBuffer(44));
  const w = (o: number, s: string) => [...s].forEach((c, i) => h.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF");
  h.setUint32(4, 36 + bytes.length, true);
  w(8, "WAVE");
  w(12, "fmt ");
  h.setUint32(16, 16, true);
  h.setUint16(20, 1, true);
  h.setUint16(22, 1, true);
  h.setUint32(24, rate, true);
  h.setUint32(28, rate * 2, true);
  h.setUint16(32, 2, true);
  h.setUint16(34, 16, true);
  w(36, "data");
  h.setUint32(40, bytes.length, true);
  return URL.createObjectURL(new Blob([h.buffer, bytes], { type: "audio/wav" }));
}

const CLIP_LABEL: Record<string, string> = {
  shy: "부끄러움",
  laugh: "웃음",
  love: "설렘",
  pout: "토라짐",
  turn_away: "등 돌림",
  touch_joy: "터치 웃음",
  kiss: "손 키스",
};

/**
 * 목소리 맞추기 — 리액션 영상(소리 포함)을 들으며 보이스톡 목소리 후보를 비교하고 고른다.
 * 고른 값은 이 기기의 보이스톡에 바로 적용되고, 아래 JSON 을 personas/<id>.json 에 넣으면 모든 사용자 기본값이 된다.
 */
export default function VoiceLab({ personas }: { personas: Persona[] }) {
  const [pid, setPid] = useState(personas[0]?.id ?? "");
  const persona = personas.find((p) => p.id === pid) ?? personas[0];
  const [showAll, setShowAll] = useState(false);
  const [line, setLine] = useState("");
  const [picked, setPicked] = useState<GeminiVoiceName | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cache = useRef(new Map<string, string>());
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setPicked(persona ? readVoiceOverride(persona.id) : null);
    setLine("");
    setError(null);
  }, [persona]);

  const clips = useMemo(() => {
    if (!persona) return [];
    const all = { ...persona.assets.clips, ...persona.assets.premiumClips, ...persona.assets.allureClips };
    return Object.entries(all).filter(([n]) => n !== "idle" && n !== "talk");
  }, [persona]);

  if (!persona) return null;
  const current = picked ?? persona.voiceName;
  const voices = GEMINI_VOICES.filter((v) => showAll || v.gender === persona.profile.gender);

  const play = async (voice: GeminiVoiceName) => {
    const text = line.trim() || persona.greeting.slice(0, 120);
    const key = `${persona.id}|${voice}|${text}`;
    setError(null);
    try {
      let url = cache.current.get(key);
      if (!url) {
        setLoading(voice);
        let pass: string | null = null;
        try {
          pass = localStorage.getItem("ai-rpg.voicePass");
        } catch {
          /* 없음 */
        }
        const res = await fetch(apiUrl("/api/voice/preview"), {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(pass ? { "x-voice-pass": pass } : {}) },
          body: JSON.stringify({ personaId: persona.id, voice, text }),
        });
        const data = (await res.json().catch(() => ({}))) as { audio?: string; mimeType?: string; error?: string };
        if (!res.ok || !data.audio) throw new Error(data.error ?? `HTTP ${res.status}`);
        url = pcmToWavUrl(data.audio, data.mimeType ?? "audio/L16;rate=24000");
        cache.current.set(key, url);
      }
      audio.current?.pause();
      audio.current = new Audio(url);
      await audio.current.play();
    } catch (e) {
      setError(e instanceof Error ? e.message : "재생 실패");
    } finally {
      setLoading(null);
    }
  };

  const choose = (v: GeminiVoiceName | null) => {
    writeVoiceOverride(persona.id, v);
    setPicked(v);
  };

  return (
    <main className="min-h-[100dvh] bg-slate-950 px-4 pb-16 pt-6 text-slate-100">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-lg font-bold">🎙 목소리 맞추기</h1>
          <a href="/" className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800">
            대화로 돌아가기
          </a>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">
          리액션 영상의 목소리를 들어 보고, 가장 비슷한 보이스톡 목소리를 고르세요. 고른 목소리는 이 기기의 보이스톡에 바로 적용돼요.
          모든 사용자 기본값으로 바꾸려면 아래 설정 줄을 전달해 주세요.
        </p>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {personas.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPid(p.id)}
              className={`flex shrink-0 items-center gap-2 rounded-full px-2.5 py-1 text-xs ring-1 ${
                p.id === persona.id ? "bg-slate-100 text-slate-900 ring-slate-100" : "text-slate-300 ring-slate-700 hover:bg-slate-800"
              }`}
            >
              <span className="h-6 w-6 overflow-hidden rounded-full">
                <PersonaPortrait persona={p} size="sm" className="h-full w-full" />
              </span>
              {p.name}
            </button>
          ))}
        </div>

        <section className="mt-5">
          <h2 className="text-sm font-semibold">1. 영상 속 목소리 듣기</h2>
          {clips.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">이 인물은 아직 리액션 영상이 없어요. 성격에 맞는 목소리를 골라 주세요.</p>
          ) : (
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {clips.map(([name, src]) => (
                <figure key={name} className="overflow-hidden rounded-xl bg-slate-900 ring-1 ring-slate-800">
                  <video src={src} controls playsInline preload="metadata" className="aspect-[4/5] w-full object-cover" />
                  <figcaption className="px-2 py-1 text-[11px] text-slate-400">
                    {CLIP_LABEL[name] ?? name.replace(/^allure_/, "💋 ")}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </section>

        <section className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">2. 보이스톡 목소리 비교</h2>
            <label className="flex items-center gap-1.5 text-xs text-slate-400">
              <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
              모든 목소리 보기
            </label>
          </div>
          <input
            value={line}
            onChange={(e) => setLine(e.target.value)}
            maxLength={200}
            placeholder={`들어 볼 대사 (비우면 첫인사: ${persona.greeting.slice(0, 30)}…)`}
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-indigo-400"
          />
          {error && <p className="mt-2 text-xs text-rose-400">⚠️ {error}</p>}
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {voices.map((v) => {
              const isCur = v.name === current;
              return (
                <div
                  key={v.name}
                  className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 ring-1 ${
                    isCur ? "bg-indigo-600/20 ring-indigo-400" : "bg-slate-900 ring-slate-800"
                  }`}
                  data-voice={v.name}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      {v.name}
                      {v.name === persona.voiceName && <span className="ml-1.5 text-[10px] font-normal text-slate-400">기본값</span>}
                      {isCur && picked && <span className="ml-1.5 text-[10px] font-normal text-indigo-300">선택됨</span>}
                    </p>
                    <p className="text-[11px] text-slate-400">{v.trait}</p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      type="button"
                      onClick={() => play(v.name)}
                      disabled={loading !== null}
                      className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs hover:bg-slate-700 disabled:opacity-50"
                    >
                      {loading === v.name ? "…" : "▶ 듣기"}
                    </button>
                    <button
                      type="button"
                      onClick={() => choose(v.name)}
                      disabled={isCur}
                      className="rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-semibold hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-400"
                    >
                      {isCur ? "사용 중" : "이걸로"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-6 rounded-xl bg-slate-900 p-3 ring-1 ring-slate-800">
          <h2 className="text-sm font-semibold">3. 고른 목소리</h2>
          <p className="mt-1 text-xs text-slate-400">
            {persona.name}: <b className="text-slate-100">{current}</b> {picked ? "(이 기기에서 선택)" : "(기본값)"}
          </p>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-black/40 p-2 text-[11px] text-emerald-300">{`"voice": { "name": "${current}" }   ← personas/${persona.id}.json`}</pre>
          {picked && (
            <button type="button" onClick={() => choose(null)} className="mt-2 text-xs text-slate-400 underline">
              기본값으로 되돌리기
            </button>
          )}
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            미리 듣기는 Gemini TTS 로 만들고, 보이스톡은 Gemini Live 를 써요. 같은 목소리 이름이라 음색은 같지만 말투는 조금 다를 수 있어요.
            배포 환경에서는 보이스톡과 같은 이용 권한(VOICE_DEV_PASS)이 있어야 들을 수 있어요.
          </p>
        </section>
      </div>
    </main>
  );
}
