import { NextResponse } from "next/server";
import type { ChatResponse } from "@/types/game";

export const dynamic = "force-dynamic";

/**
 * Mock 채팅 API.
 * TODO: 실제 LLM 연결 시 request body의 message를 모델에 전달하고,
 *       모델 출력을 ChatResponse 스키마(JSON)로 파싱/검증해서 반환하세요.
 */
export async function POST(request: Request) {
  let message = "";
  try {
    const body = (await request.json()) as { message?: unknown };
    if (typeof body.message === "string") message = body.message.trim();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const response: ChatResponse = {
    text: "앗, 몬스터가 나타났어요!",
    emotion: "surprised",
    animation: "jump",
    hp_change: -10,
  };

  return NextResponse.json(response);
}
