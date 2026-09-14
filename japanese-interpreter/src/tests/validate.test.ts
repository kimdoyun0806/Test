import { describe, expect, it } from "vitest";
import { AnalysisSchema, type Analysis } from "../types/analysis";
import { validateAnalysis } from "../api/validate";
import ryokouFixture from "../fixtures/ryokou.json";

const RYOKOU: Analysis = AnalysisSchema.parse(ryokouFixture);
const ORIGINAL = RYOKOU.sentence_jp;

describe("validateAnalysis", () => {
  it("골든 fixture는 검증을 통과한다", () => {
    const result = validateAnalysis(RYOKOU, ORIGINAL);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("토큰이 누락되면 실패한다 (재시도 트리거)", () => {
    const broken = structuredClone(RYOKOU);
    broken.tokens.splice(0, 1);
    const result = validateAnalysis(broken, ORIGINAL);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("토큰"))).toBe(true);
  });

  it("번역이 비어 있으면 실패한다", () => {
    const broken = { ...RYOKOU, translation_ko: "  " };
    const result = validateAnalysis(broken, ORIGINAL);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("tr"))).toBe(true);
  });

  it("segment_index가 역행하면 실패하되 segmentOnlyFailure로 표시된다", () => {
    const broken = structuredClone(RYOKOU);
    broken.tokens[7] = { ...broken.tokens[7], segment_index: 0 };
    const result = validateAnalysis(broken, ORIGINAL);
    expect(result.ok).toBe(false);
    expect(result.segmentOnlyFailure).toBe(true);
  });

  it("segment_index가 범위를 벗어나면 실패한다", () => {
    const broken = structuredClone(RYOKOU);
    broken.tokens[7] = { ...broken.tokens[7], segment_index: 99 };
    const result = validateAnalysis(broken, ORIGINAL);
    expect(result.ok).toBe(false);
  });

  it("공백·NFKC 차이는 허용한다", () => {
    const result = validateAnalysis(RYOKOU, ` ${ORIGINAL} `);
    expect(result.ok).toBe(true);
  });
});
