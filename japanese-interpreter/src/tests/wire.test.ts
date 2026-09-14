import { describe, expect, it } from "vitest";
import { WireAnalysisSchema, fromWire } from "../types/analysis";

const WIRE = {
  tr: "여행을 간다면, 국내파입니까?",
  t: [
    { s: "旅行", k: "りょこう", g: 0, m: "여행", v: "N5" as const },
    { s: "に", k: "に", g: 0, m: "~에 (조사)", v: null },
  ],
  seg: [{ j: "旅行に", ko: "여행을" }],
  gr: [{ p: "〜なら", ex: "行くなら", d: "가정을 나타냅니다." }],
};

describe("fromWire", () => {
  it("규격 외 v 값(빈 문자열 등)은 null로 정리한다", () => {
    const wire = WireAnalysisSchema.parse({
      ...WIRE,
      t: [{ s: "旅行", k: "りょこう", g: 0, m: "", v: "" }],
    });
    const analysis = fromWire(wire, "旅行");
    expect(analysis.tokens[0].level).toBeNull();
    expect(analysis.tokens[0].meaning_ko).toBeNull();
  });

  it("축약 필드를 내부 형태로 변환하고 로마자·한글을 규칙 생성한다", () => {
    const parsed = WireAnalysisSchema.parse(WIRE);
    const analysis = fromWire(parsed, " 旅行に ");
    expect(analysis.sentence_jp).toBe("旅行に");
    expect(analysis.translation_ko).toBe(WIRE.tr);
    expect(analysis.tokens[0]).toEqual({
      surface: "旅行",
      reading_kana: "りょこう",
      romaji: "ryo-ko-o",
      hangul: "료코오",
      segment_index: 0,
      meaning_ko: "여행",
      level: "N5",
    });
    expect(analysis.tokens[1].romaji).toBe("ni");
    expect(analysis.tokens[1].hangul).toBe("니");
    expect(analysis.tokens[1].meaning_ko).toBe("~에 (조사)");
    expect(analysis.segments[0]).toEqual({ jp_text: "旅行に", ko_text: "여행을" });
    expect(analysis.grammar_points[0]).toEqual({
      pattern: "〜なら",
      jp_example: "行くなら",
      explanation_ko: "가정을 나타냅니다.",
    });
  });
});
