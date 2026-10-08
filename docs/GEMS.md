# 💎 보석(재화)

- 화면 왼쪽 위의 💎 뱃지에 남은 개수가 보이고, 누르면 충전창이 열립니다 (목록·대화방 모두).
- 새 사용자는 **30개**로 시작합니다 (`config/balance.json` → `cash.demoStart`). 이미 쓰던 기기는 기존 값을 유지합니다.
- 선물, 실시간 사진, 보이스톡 분당 요금 등 기존 유료 기능이 모두 같은 보석을 씁니다. 가격표는 `config/plans.ts` 의 `CASH_PRICE`.
- 충전 상품은 `config/gems.ts` 의 `GEM_PACKS`. 지금은 **테스트 충전**(`GEM_TEST_TOPUP = true`)이라 무료로 더해집니다.

## 출시 전에 할 일
1. `GEM_TEST_TOPUP = false` 로 바꾸고 `components/ChatApp.tsx` 의 `onCharge` 에서 구글 플레이/애플 결제를 호출한 뒤 성공 시에만 `setCash(...)`.
2. 보석은 아직 기기(localStorage)에 저장됩니다. 사용자가 값을 바꿀 수 있으므로 판매 전에 서버(DB)로 옮기세요. (`docs/MEDIA.md`)
