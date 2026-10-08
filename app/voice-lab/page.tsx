import VoiceLab from "@/components/VoiceLab";
import { listPublicPersonas } from "@/lib/personas/server";

export const metadata = { title: "목소리 맞추기 · WitH" };

/** 목소리 맞추기 — 리액션 영상 속 목소리와 보이스톡 목소리를 비교해 고른다 (docs/VOICE_TALK.md) */
export default function Page() {
  return <VoiceLab personas={listPublicPersonas()} />;
}
