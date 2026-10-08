import { NextResponse } from "next/server";
import { currentNotifyPlan } from "@/lib/push/planStore";

export const dynamic = "force-dynamic";

/** 앱이 시작할 때 받아 가는 선톡 일과표 (CMS 에서 바꾸면 여기가 바뀐다). 민감한 값은 없다 */
export async function GET() {
  return NextResponse.json({ plan: currentNotifyPlan() }, { headers: { "Cache-Control": "no-store" } });
}
