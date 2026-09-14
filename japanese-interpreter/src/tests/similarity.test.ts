import { describe, expect, it } from "vitest";
import {
  gradeOf,
  katakanaToHiragana,
  levenshtein,
  normalizeForSimilarity,
  scorePronunciation,
  similarity,
} from "../services/similarity";

describe("katakanaToHiragana", () => {
  it("가타카나를 히라가나로 변환한다", () => {
    expect(katakanaToHiragana("カタカナ")).toBe("かたかな");
  });
  it("히라가나·한자는 그대로 둔다", () => {
    expect(katakanaToHiragana("旅行にいく")).toBe("旅行にいく");
  });
});

describe("normalizeForSimilarity", () => {
  it("구두점·공백을 제거하고 가타카나를 통일한다", () => {
    expect(normalizeForSimilarity("リョコウ に 行く。")).toBe("りょこうに行く");
    expect(normalizeForSimilarity("こんにちは！")).toBe("こんにちは");
  });
});

describe("levenshtein", () => {
  it("동일 문자열은 0", () => {
    expect(levenshtein("abc", "abc")).toBe(0);
  });
  it("빈 문자열 경계", () => {
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("abc", "")).toBe(3);
  });
  it("치환 1회는 거리 1", () => {
    expect(levenshtein("かたな", "かたか")).toBe(1);
  });
});

describe("similarity / scorePronunciation", () => {
  it("완전 일치는 1", () => {
    expect(similarity("こんにちは", "こんにちは！")).toBe(1);
  });
  it("완전 불일치는 낮은 점수", () => {
    expect(similarity("あいうえお", "かきくけこ")).toBe(0);
  });
  it("빈 입력은 0", () => {
    expect(similarity("", "こんにちは")).toBe(0);
  });
  it("표기 점수가 낮으면 가나 읽기로 구제한다", () => {
    // 동음이의 한자 오인식 시나리오: 표기는 다르지만 읽기는 동일
    const score = scorePronunciation("こうえんにいく", "公園に行く", "こうえんにいく");
    expect(score).toBe(1);
  });
});

describe("gradeOf", () => {
  it("경계값 채점", () => {
    expect(gradeOf(0.8)).toBe("great");
    expect(gradeOf(0.79)).toBe("good");
    expect(gradeOf(0.6)).toBe("good");
    expect(gradeOf(0.59)).toBe("retry");
  });
});
