"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PersonaPortrait from "@/components/PersonaPortrait";
import type { Persona } from "@/lib/personas/types";
import type { AvatarReactionId, TouchReactionId } from "@/config/reactions";
import { TOUCH_REACTIONS } from "@/config/reactions";

/**
 * 보이스톡 (AI 실시간 음성 대화) — Gemini Live API
 *
 *  1) /api/voice/session 에서 일회용 토큰을 받는다 (인물 프롬프트·목소리는 서버가 토큰에 잠금)
 *  2) 브라우저가 Live API 에 WebSocket 으로 직접 연결 → 마이크(16kHz PCM) 전송, 음성(24kHz PCM) 재생
 *  3) 자막(받아쓰기)을 화면에 보여 주고, 끊으면 대화 내용을 톡 기록으로 남긴다
 *
 * 인물 화면(아바타)은 뒤에 그대로 보이고, 이 컴포넌트는 그 위에 통화 UI 만 올린다.
 * 화면 터치 반응은 상위(ChatApp)가 처리하고 notifyTouch() 로 상대에게도 알려 준다.
 */

export interface VoiceTranscriptLine {
  role: "user" | "ai";
  text: string;
  at: number;
}

export interface VoiceCallResult {
  seconds: number;
  transcript: VoiceTranscriptLine[];
}

export interface VoiceCallHandle {
  /** 유저가 화면을 터치했다는 사실을 상대에게 전달 (말하는 중이 아닐 때만, 너무 잦지 않게) */
  notifyTouch: (id: TouchReactionId) => void;
}

interface VoiceCallProps {
  persona: Persona;
  affection: number;
  recent: { role: "user" | "assistant"; content: string }[];
  onEnd: (result: VoiceCallResult) => void;
  /** 상대가 말하는 중인지 (아바타 말하기 모션용) */
  onSpeakingChange: (speaking: boolean) => void;
  /** 상대 말에 어울리는 표정 (아바타 리액션) */
  onReaction: (r: AvatarReactionId) => void;
  /** 터치 알림 함수를 상위에 등록 */
  registerHandle: (h: VoiceCallHandle | null) => void;
}

type Phase = "connecting" | "live" | "ending" | "error" | "paywall";

/* ── 오디오 유틸 ─────────────────────────────────────────────────────────── */
const IN_RATE = 16000;
const OUT_RATE = 24000;

/** 마이크 프레임을 그대로 메인 스레드로 넘기는 AudioWorklet */
const WORKLET_SRC = `
class Tap extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) this.port.postMessage(ch.slice(0));
    return true;
  }
}
registerProcessor("voice-tap", Tap);
`;

function downsampleToInt16(input: Float32Array, fromRate: number): Int16Array {
  const ratio = fromRate / IN_RATE;
  const len = Math.floor(input.length / ratio);
  const out = new Int16Array(len);
  for (let i = 0; i < len; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    const v = Math.max(-1, Math.min(1, sum / Math.max(1, end - start)));
    out[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
  }
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function base64ToFloat32(b64: string): Float32Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const pcm = new Int16Array(bytes.buffer, 0, Math.floor(bytes.length / 2));
  const out = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) out[i] = pcm[i] / 0x8000;
  return out;
}

/** 상대가 한 말로 표정 고르기 (가벼운 키워드 추정 — 음성 모델은 리액션 값을 따로 주지 않는다) */
function guessReaction(text: string): AvatarReactionId | null {
  const t = text.replace(/\s/g, "");
  const rules: [RegExp, AvatarReactionId][] = [
    [/하하|아하하|ㅋㅋ|웃겨|웃기|재밌/, "laugh"],
    [/부끄|쑥스|창피/, "shy"],
    [/좋아해|사랑|보고싶|설레/, "love"],
    [/고마워|고마워요|감동|뭉클/, "touched"],
    [/미안|속상|슬퍼|힘들었/, "sad"],
    [/흥|삐질|서운|너무해/, "pout"],
    [/헐|진짜\?|어머|깜짝|세상에/, "surprised"],
    [/신난다|신나|대박|최고/, "excited"],
    [/괜찮아|토닥|힘내/, "comfort"],
    [/음+…|글쎄|그러니까/, "thinking"],
  ];
  for (const [re, r] of rules) if (re.test(t)) return r;
  return null;
}

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/* ────────────────────────────────────────────────────────────────────────── */

export default function VoiceCall({
  persona,
  affection,
  recent,
  onEnd,
  onSpeakingChange,
  onReaction,
  registerHandle,
}: VoiceCallProps) {
  const [phase, setPhase] = useState<Phase>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [maxSeconds, setMaxSeconds] = useState(600);
  const [speaking, setSpeaking] = useState(false);
  const [userLevel, setUserLevel] = useState(0);
  const [caption, setCaption] = useState<{ role: "user" | "ai"; text: string } | null>(null);

  // 통화 자원 (렌더와 무관)
  const r = useRef({
    session: null as null | {
      sendRealtimeInput: (p: Record<string, unknown>) => void;
      close: () => void;
    },
    stream: null as MediaStream | null,
    inCtx: null as AudioContext | null,
    outCtx: null as AudioContext | null,
    node: null as AudioWorkletNode | null,
    sources: new Set<AudioBufferSourceNode>(),
    nextTime: 0,
    speakTimer: 0 as number | ReturnType<typeof setTimeout>,
    startedAt: 0,
    transcript: [] as VoiceTranscriptLine[],
    aiBuf: "",
    userBuf: "",
    pending: [] as Int16Array[],
    pendingLen: 0,
    muted: false,
    speaking: false,
    lastTouchNotify: 0,
    ended: false,
  });

  const cb = useRef({ onEnd, onSpeakingChange, onReaction });
  cb.current = { onEnd, onSpeakingChange, onReaction };

  const setSpeakingBoth = useCallback((v: boolean) => {
    if (r.current.speaking === v) return;
    r.current.speaking = v;
    setSpeaking(v);
    cb.current.onSpeakingChange(v);
  }, []);

  /* ── 받아쓰기 정리: 한 사람의 말이 끝나면 기록으로 확정 ────────────────── */
  const flush = useCallback((who: "user" | "ai") => {
    const s = r.current;
    const key = who === "ai" ? "aiBuf" : "userBuf";
    const text = s[key].trim();
    s[key] = "";
    if (!text) return;
    s.transcript.push({ role: who, text, at: Date.now() });
    if (who === "ai") {
      const g = guessReaction(text);
      if (g) cb.current.onReaction(g);
    }
  }, []);

  /* ── 재생 ─────────────────────────────────────────────────────────────── */
  const stopPlayback = useCallback(() => {
    const s = r.current;
    for (const src of s.sources) {
      try {
        src.stop();
      } catch {
        /* 이미 끝남 */
      }
    }
    s.sources.clear();
    s.nextTime = 0;
    clearTimeout(s.speakTimer as number);
    setSpeakingBoth(false);
  }, [setSpeakingBoth]);

  const playChunk = useCallback(
    (b64: string) => {
      const s = r.current;
      const ctx = s.outCtx;
      if (!ctx) return;
      const data = base64ToFloat32(b64);
      if (data.length === 0) return;
      const buf = ctx.createBuffer(1, data.length, OUT_RATE);
      buf.getChannelData(0).set(data);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      const at = Math.max(ctx.currentTime + 0.03, s.nextTime);
      src.start(at);
      s.nextTime = at + buf.duration;
      s.sources.add(src);
      src.onended = () => s.sources.delete(src);
      setSpeakingBoth(true);
      clearTimeout(s.speakTimer as number);
      s.speakTimer = setTimeout(() => setSpeakingBoth(false), (s.nextTime - ctx.currentTime) * 1000 + 250);
    },
    [setSpeakingBoth]
  );

  /* ── 종료 ─────────────────────────────────────────────────────────────── */
  const hangUp = useCallback(() => {
    const s = r.current;
    if (s.ended) return;
    s.ended = true;
    setPhase("ending");
    flush("user");
    flush("ai");
    try {
      s.session?.close();
    } catch {
      /* 무시 */
    }
    s.node?.port.close();
    s.node?.disconnect();
    s.stream?.getTracks().forEach((t) => t.stop());
    stopPlayback();
    s.inCtx?.close().catch(() => {});
    s.outCtx?.close().catch(() => {});
    const seconds = s.startedAt ? Math.round((Date.now() - s.startedAt) / 1000) : 0;
    registerHandle(null);
    cb.current.onEnd({ seconds, transcript: s.transcript });
  }, [flush, stopPlayback, registerHandle]);

  /* ── 연결 ─────────────────────────────────────────────────────────────── */
  useEffect(() => {
    const s = r.current;
    let cancelled = false;

    (async () => {
      try {
        // 1) 마이크 권한 (사용자 동작 직후라 여기서 요청)
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("이 브라우저는 마이크를 지원하지 않아요.");
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
        });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        s.stream = stream;

        // 2) 서버에서 일회용 토큰
        const passHeader: Record<string, string> = {};
        try {
          const pass = localStorage.getItem("ai-rpg.voicePass");
          if (pass) passHeader["x-voice-pass"] = pass;
        } catch {
          /* 저장소 없음 */
        }
        const res = await fetch("/api/voice/session", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...passHeader },
          body: JSON.stringify({
            personaId: persona.id,
            affection,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            recent,
          }),
        });
        const info = (await res.json().catch(() => ({}))) as {
          token?: string;
          model?: string;
          maxSeconds?: number;
          error?: string;
        };
        if (res.status === 402) {
          setError(info.error ?? "보이스톡은 이용권이 필요해요.");
          setPhase("paywall");
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (!res.ok || !info.token || !info.model) throw new Error(info.error ?? `HTTP ${res.status}`);
        if (cancelled) return;
        setMaxSeconds(info.maxSeconds ?? 600);

        // 3) 오디오 장치
        const inCtx = new AudioContext();
        const outCtx = new AudioContext({ sampleRate: OUT_RATE });
        s.inCtx = inCtx;
        s.outCtx = outCtx;
        const url = URL.createObjectURL(new Blob([WORKLET_SRC], { type: "application/javascript" }));
        await inCtx.audioWorklet.addModule(url);
        URL.revokeObjectURL(url);

        // 4) Live API 연결 (SDK 는 통화할 때만 불러온다)
        const { GoogleGenAI } = await import("@google/genai");
        const ai = new GoogleGenAI({ apiKey: info.token, httpOptions: { apiVersion: "v1alpha" } });
        const session = await ai.live.connect({
          model: info.model,
          // 실제 설정(프롬프트·목소리·자막)은 서버가 토큰에 잠가 두었다
          config: {},
          callbacks: {
            onopen: () => {},
            onmessage: (msg) => {
              const sc = msg.serverContent;
              if (!sc) return;
              if (sc.interrupted) {
                // 유저가 말을 끊음 → 재생 중인 음성 즉시 멈춤
                stopPlayback();
                flush("ai");
              }
              for (const part of sc.modelTurn?.parts ?? []) {
                const d = part.inlineData;
                if (d?.data && d.mimeType?.startsWith("audio/")) playChunk(d.data);
              }
              if (sc.inputTranscription?.text) {
                if (s.aiBuf) flush("ai");
                s.userBuf += sc.inputTranscription.text;
                setCaption({ role: "user", text: s.userBuf });
              }
              if (sc.outputTranscription?.text) {
                if (s.userBuf) flush("user");
                s.aiBuf += sc.outputTranscription.text;
                setCaption({ role: "ai", text: s.aiBuf });
              }
              if (sc.turnComplete) flush("ai");
            },
            onerror: (e) => {
              console.error("[voice] error", e);
              if (!s.ended) {
                setError("통화가 불안정해서 끊겼어요.");
                setPhase("error");
              }
            },
            onclose: () => {
              if (!s.ended && !cancelled) hangUp();
            },
          },
        });
        if (cancelled) return session.close();
        s.session = session as unknown as typeof s.session;

        // 5) 마이크 → 16kHz PCM → 전송 (약 64ms 단위로 묶어서)
        const srcNode = inCtx.createMediaStreamSource(stream);
        const node = new AudioWorkletNode(inCtx, "voice-tap");
        s.node = node;
        const CHUNK = IN_RATE * 0.064;
        let levelTick = 0;
        node.port.onmessage = (ev: MessageEvent<Float32Array>) => {
          if (s.ended || !s.session) return;
          const frame = ev.data;
          if (++levelTick % 6 === 0) {
            let sum = 0;
            for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
            setUserLevel(s.muted ? 0 : Math.min(1, Math.sqrt(sum / frame.length) * 6));
          }
          if (s.muted) return;
          const pcm = downsampleToInt16(frame, inCtx.sampleRate);
          s.pending.push(pcm);
          s.pendingLen += pcm.length;
          if (s.pendingLen < CHUNK) return;
          const all = new Int16Array(s.pendingLen);
          let o = 0;
          for (const p of s.pending) {
            all.set(p, o);
            o += p.length;
          }
          s.pending = [];
          s.pendingLen = 0;
          s.session.sendRealtimeInput({
            audio: { data: bytesToBase64(new Uint8Array(all.buffer)), mimeType: `audio/pcm;rate=${IN_RATE}` },
          });
        };
        srcNode.connect(node);

        s.startedAt = Date.now();
        setPhase("live");
        registerHandle({
          notifyTouch: (id) => {
            const now = Date.now();
            if (!s.session || s.ended || s.speaking || now - s.lastTouchNotify < 8000) return;
            s.lastTouchNotify = now;
            s.session.sendRealtimeInput({ text: `[터치] 유저가 화면 속 너를 건드렸다 (${TOUCH_REACTIONS[id].label} 반응).` });
          },
        });
      } catch (err) {
        if (cancelled) return;
        console.error("[voice] start failed", err);
        const name = err instanceof DOMException ? err.name : "";
        setError(
          name === "NotAllowedError"
            ? "마이크 권한이 필요해요. 브라우저 주소창의 권한 설정에서 마이크를 허용해 주세요."
            : err instanceof Error
              ? err.message
              : "보이스톡을 시작하지 못했어요."
        );
        setPhase("error");
        s.stream?.getTracks().forEach((t) => t.stop());
      }
    })();

    return () => {
      cancelled = true;
      if (!s.ended) {
        s.ended = true;
        try {
          s.session?.close();
        } catch {
          /* 무시 */
        }
        s.stream?.getTracks().forEach((t) => t.stop());
        s.inCtx?.close().catch(() => {});
        s.outCtx?.close().catch(() => {});
        cb.current.onSpeakingChange(false);
        registerHandle(null);
      }
    };
    // 통화는 마운트 1회만 시작한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── 통화 시간 / 자동 종료 ─────────────────────────────────────────────── */
  useEffect(() => {
    if (phase !== "live") return;
    const t = setInterval(() => {
      const sec = (Date.now() - r.current.startedAt) / 1000;
      setElapsed(sec);
      if (sec >= maxSeconds) hangUp();
    }, 500);
    return () => clearInterval(t);
  }, [phase, maxSeconds, hangUp]);

  const toggleMute = () => {
    r.current.muted = !r.current.muted;
    setMuted(r.current.muted);
    if (r.current.muted) r.current.session?.sendRealtimeInput({ audioStreamEnd: true });
  };

  const close = () => {
    if (phase === "live" || phase === "connecting") hangUp();
    else {
      r.current.ended = true;
      registerHandle(null);
      cb.current.onEnd({ seconds: 0, transcript: [] });
    }
  };

  const remaining = Math.max(0, maxSeconds - elapsed);
  const status =
    phase === "connecting"
      ? "연결 중…"
      : phase === "ending"
        ? "통화 종료"
        : phase === "error" || phase === "paywall"
          ? "연결되지 않았어요"
        : speaking
          ? "말하는 중"
          : muted
            ? "음소거됨"
            : "듣고 있어요";

  return (
    // 통화 UI: 위쪽(상태)과 아래쪽(자막·버튼)만 터치를 받고, 가운데는 비워서 인물 터치가 되도록 한다
    <div className="pointer-events-none absolute inset-0 z-30 flex flex-col justify-between" data-voice-call={phase}>
      <div className="pointer-events-auto flex flex-col items-center bg-gradient-to-b from-black/70 to-transparent px-4 pb-8 pt-[max(1rem,env(safe-area-inset-top))] text-center">
        <div className={`h-14 w-14 overflow-hidden rounded-full ring-2 ring-pink-300/70 ${speaking ? "voice-ring" : ""}`}>
          <PersonaPortrait persona={persona} size="sm" className="h-full w-full" />
        </div>
        <p className="mt-2 text-base font-semibold text-white [text-shadow:0_1px_3px_rgba(0,0,0,.6)]">
          {persona.name}
          <span className="ml-2 rounded-full bg-pink-500/90 px-2 py-0.5 align-middle text-[10px] font-bold text-white">보이스톡</span>
        </p>
        <p className="text-xs text-white/85" data-voice-status>
          {status}
          {phase === "live" && <span className="ml-2 tabular-nums text-white/70">{fmtTime(elapsed)}</span>}
        </p>
        {phase === "live" && remaining <= 60 && (
          <p className="mt-1 text-[11px] text-amber-300">{Math.ceil(remaining)}초 뒤 통화가 끝나요</p>
        )}
      </div>

      <div className="pointer-events-auto bg-gradient-to-t from-black/80 via-black/50 to-transparent px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-10">
        {(phase === "error" || phase === "paywall") && (
          <div className="mx-auto mb-4 max-w-sm rounded-2xl bg-slate-900/90 p-4 text-center text-sm text-white ring-1 ring-white/10">
            <p>{error}</p>
            {phase === "paywall" && (
              <p className="mt-2 text-xs text-slate-400">이용권 판매는 준비 중이에요. (관리자: docs/VOICE_TALK.md 참고)</p>
            )}
          </div>
        )}
        {caption && phase === "live" && (
          <p
            className={`mx-auto mb-4 line-clamp-3 max-w-md text-center text-[15px] leading-relaxed [text-shadow:0_1px_3px_rgba(0,0,0,.8)] ${
              caption.role === "ai" ? "text-white" : "text-white/60"
            }`}
            data-voice-caption={caption.role}
          >
            {caption.text}
          </p>
        )}
        <div className="flex items-center justify-center gap-8">
          {phase === "live" && (
            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? "마이크 켜기" : "마이크 끄기"}
              className={`relative flex h-14 w-14 items-center justify-center rounded-full text-xl text-white ring-1 ring-white/30 backdrop-blur ${
                muted ? "bg-white/90 text-slate-900" : "bg-white/15"
              }`}
            >
              {/* 내 목소리 크기 표시 */}
              {!muted && (
                <span
                  className="absolute inset-0 rounded-full bg-emerald-400/30 transition-transform duration-100"
                  style={{ transform: `scale(${1 + userLevel * 0.35})` }}
                />
              )}
              <span className="relative">{muted ? "🔇" : "🎙️"}</span>
            </button>
          )}
          <button
            type="button"
            onClick={close}
            aria-label="통화 종료"
            data-voice-hangup
            className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-600 text-2xl text-white shadow-lg hover:bg-rose-500 active:scale-95"
          >
            {phase === "error" || phase === "paywall" ? "✕" : "📞"}
          </button>
        </div>
        {phase === "live" && (
          <p className="mt-3 text-center text-[11px] text-white/50">이어폰을 쓰면 더 잘 들려요 · 화면 속 인물을 터치해 보세요</p>
        )}
      </div>
    </div>
  );
}
