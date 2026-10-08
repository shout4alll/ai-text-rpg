/**
 * 💎 보석(재화) 설정.
 * 시작 보석·테스트 충전 단위는 config/balance.json 의 cash 항목. 여기서는 충전 상품과 테스트 스위치.
 *
 * GEM_TEST_TOPUP = true 인 동안은 결제 없이 무료로 충전된다 ("테스트 충전" 표시).
 * 스토어 출시 전에 false 로 바꾸고 구글 플레이/애플 결제를 연결한다. (docs/GEMS.md)
 */
export const GEM_TEST_TOPUP = true;

/** 충전 상품 (가격은 자리표시 — 실제 결제 연동 시 스토어 상품 ID 와 맞춘다) */
export const GEM_PACKS = [
  { id: "g30", gems: 30, price: 1100 },
  { id: "g100", gems: 100, price: 3300, tag: "인기" },
  { id: "g300", gems: 300, price: 9900, tag: "+10% 보너스" },
] as const;

export type GemPack = (typeof GEM_PACKS)[number];
