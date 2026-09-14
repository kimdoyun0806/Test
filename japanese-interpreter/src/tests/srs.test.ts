import { describe, expect, it } from "vitest";
import { DAY_MS, initialSrsState, review } from "../services/srs";

const NOW = 1_700_000_000_000;

describe("SM-2 SRS", () => {
  it("첫 복습(보통)은 1일 간격", () => {
    const s = review(initialSrsState(NOW), 4, NOW);
    expect(s.intervalDays).toBe(1);
    expect(s.repetitions).toBe(1);
    expect(s.dueAt).toBe(NOW + DAY_MS);
  });

  it("두 번째 복습은 6일 간격", () => {
    let s = review(initialSrsState(NOW), 4, NOW);
    s = review(s, 4, NOW);
    expect(s.intervalDays).toBe(6);
    expect(s.repetitions).toBe(2);
  });

  it("세 번째부터는 간격 × EF로 증가", () => {
    let s = review(initialSrsState(NOW), 5, NOW);
    s = review(s, 5, NOW);
    const third = review(s, 5, NOW);
    expect(third.intervalDays).toBeGreaterThan(6);
  });

  it("'다시(1)'는 반복 초기화 + 1일 후 재출제", () => {
    let s = review(initialSrsState(NOW), 5, NOW);
    s = review(s, 5, NOW);
    const failed = review(s, 1, NOW);
    expect(failed.repetitions).toBe(0);
    expect(failed.intervalDays).toBe(1);
  });

  it("EF는 1.3 아래로 내려가지 않는다", () => {
    let s = initialSrsState(NOW);
    for (let i = 0; i < 20; i++) s = review(s, 3, NOW);
    expect(s.easeFactor).toBeGreaterThanOrEqual(1.3);
  });

  it("쉬움(5)은 어려움(3)보다 EF가 높아진다", () => {
    const easy = review(initialSrsState(NOW), 5, NOW);
    const hard = review(initialSrsState(NOW), 3, NOW);
    expect(easy.easeFactor).toBeGreaterThan(hard.easeFactor);
  });
});
