/** SM-2 간격 반복 알고리즘 (순수 함수) */

export const DAY_MS = 24 * 60 * 60 * 1000;

export interface SrsState {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  /** 다음 복습 시각 (epoch ms) */
  dueAt: number;
}

/** 복습 채점 품질: 1=다시, 3=어려움, 4=보통, 5=쉬움 */
export type SrsQuality = 1 | 3 | 4 | 5;

export function initialSrsState(now: number = Date.now()): SrsState {
  return { easeFactor: 2.5, intervalDays: 0, repetitions: 0, dueAt: now };
}

export function review(s: SrsState, q: SrsQuality, now: number = Date.now()): SrsState {
  if (q < 3) {
    return { ...s, repetitions: 0, intervalDays: 1, dueAt: now + DAY_MS };
  }
  const ef = Math.max(1.3, s.easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  const intervalDays =
    s.repetitions === 0 ? 1 : s.repetitions === 1 ? 6 : Math.round(s.intervalDays * ef);
  return {
    easeFactor: ef,
    intervalDays,
    repetitions: s.repetitions + 1,
    dueAt: now + intervalDays * DAY_MS,
  };
}
