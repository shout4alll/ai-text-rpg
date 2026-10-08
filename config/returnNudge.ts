/**
 * 💬 대화방에 다시 들어왔을 때 상대가 먼저 말을 거는 확률.
 * 자리를 비운 시간이 길수록 확률이 높다. 값만 고치면 된다. (0 = 안 함, 1 = 항상)
 */
export const RETURN_CHANCE: { minGapMin: number; chance: number }[] = [
  { minGapMin: 15, chance: 0.08 },
  { minGapMin: 60, chance: 0.2 },
  { minGapMin: 3 * 60, chance: 0.45 },
  { minGapMin: 12 * 60, chance: 0.7 },
  { minGapMin: 24 * 60, chance: 0.85 },
];

export function returnChance(gapMs: number): number {
  const min = gapMs / 60000;
  let c = 0;
  for (const b of RETURN_CHANCE) if (min >= b.minGapMin) c = b.chance;
  return c;
}
