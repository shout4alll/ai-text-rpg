/**
 * 사진·영상 보내기 설정 (클라이언트·서버 공용)
 *
 *  ▸ 앨범 (무료, 즉시): 인물마다 미리 찍어 둔 사진·영상. personas/<id>.json 의 "album" 에 등록.
 *  ▸ 실시간 사진 (유료, 캐시 차감): "지금 모습" 이나 앨범에 없는 특정 모습을 요청하면
 *      앱이 모달로 비용을 안내 → 확인 시 캐시 차감 → 인물 사진을 기준으로 새 사진 생성.
 *
 * 비용·시작 캐시는 여기서 조정한다. (실제 결제 연동 전까지 캐시는 브라우저에만 저장되는 테스트용)
 */
import { CASH_PRICE } from "@/config/plans";
import { BALANCE } from "@/config/balance";

/** 캐시 가격은 config/plans.ts 의 CASH_PRICE 한 곳에서 관리 */
export const MEDIA_COST = {
  /** 실시간 사진 1장 */
  photo: CASH_PRICE.photo,
} as const;

/** 테스트용 시작 캐시 (결제 연동 전) */
export const DEMO_START_CASH = BALANCE.cash.demoStart;
/** 테스트용 충전 단위 */
export const DEMO_TOPUP = BALANCE.cash.demoTopup;

export type MediaType = "photo" | "video";

/** 화면에 보내는 앨범 항목 */
export interface AlbumItem {
  id: string;
  type: MediaType;
  /** 공개 URL */
  src: string;
  /** 어떤 사진인지 (AI가 고를 때 참고, 화면엔 안 보임) */
  desc: string;
}

/** /api/chat 응답의 사진·영상 지시 */
export type MediaDirective =
  | { action: "album"; item: AlbumItem }
  | { action: "custom"; type: "photo"; request: string };
