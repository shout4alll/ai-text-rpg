import ChatApp from "@/components/ChatApp";
import { listPublicPersonas } from "@/lib/personas/server";

/**
 * 서버 컴포넌트: personas/*.json 을 서버에서 읽어, 공개 필드만 클라이언트로 넘긴다.
 * (시스템 프롬프트는 브라우저로 전달되지 않는다)
 */
export default function Page() {
  return <ChatApp personas={listPublicPersonas()} />;
}
