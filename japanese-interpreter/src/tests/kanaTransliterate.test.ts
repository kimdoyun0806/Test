import { describe, expect, it } from "vitest";
import { syllabifyKana, transliterateKana } from "../services/kanaTransliterate";

describe("transliterateKana", () => {
  it("기본 변환: りょこう → ryo-ko-o / 료코오 (장음 모음 반복)", () => {
    expect(transliterateKana("りょこう")).toEqual({ romaji: "ryo-ko-o", hangul: "료코오" });
  });

  it("촉음 っ: がっこう → ga-k-ko-o / 갓코오 (받침 ㅅ)", () => {
    expect(transliterateKana("がっこう")).toEqual({ romaji: "ga-k-ko-o", hangul: "갓코오" });
  });

  it("あい 연속 모음은 그대로: かいがい → ka-i-ga-i / 카이가이", () => {
    expect(transliterateKana("かいがい")).toEqual({ romaji: "ka-i-ga-i", hangul: "카이가이" });
  });

  it("ん 받침: にほん → ni-ho-n / 니혼", () => {
    expect(transliterateKana("にほん")).toEqual({ romaji: "ni-ho-n", hangul: "니혼" });
  });

  it("ん + か행 → 받침 ㅇ: てんき → 텡키", () => {
    expect(transliterateKana("てんき").hangul).toBe("텡키");
  });

  it("ん + ま/ば/ぱ행 → 받침 ㅁ: さんぽ → 삼포", () => {
    expect(transliterateKana("さんぽ").hangul).toBe("삼포");
  });

  it("가타카나·장음 기호: ドキドキ, コーヒー", () => {
    expect(transliterateKana("ドキドキ")).toEqual({ romaji: "do-ki-do-ki", hangul: "도키도키" });
    expect(transliterateKana("コーヒー")).toEqual({ romaji: "ko-o-hi-i", hangul: "코오히이" });
  });

  it("어두 청음도 격음 통일: か=카, た=타", () => {
    expect(transliterateKana("かたち").hangul).toBe("카타치");
  });

  it("しています → shi-te-i-ma-su / 시테이마스", () => {
    expect(transliterateKana("しています")).toEqual({
      romaji: "shi-te-i-ma-su",
      hangul: "시테이마스",
    });
  });

  it("구두점은 건너뛴다", () => {
    expect(transliterateKana("ですか？")).toEqual({ romaji: "de-su-ka", hangul: "데스카" });
  });

  it("요음: じゃ/しゅ/ちょ", () => {
    expect(transliterateKana("じゃあ").romaji).toBe("ja-a");
    expect(transliterateKana("しゅみ")).toEqual({ romaji: "shu-mi", hangul: "슈미" });
  });
});

describe("syllabifyKana", () => {
  it("음절마다 가나/로마자/한글을 나눈다: りょこう", () => {
    expect(syllabifyKana("りょこう")).toEqual([
      { kana: "りょ", romaji: "ryo", hangul: "료" },
      { kana: "こう", romaji: "ko-o", hangul: "코오" },
    ]);
  });

  it("촉음·발음은 앞 음절에 붙는다: がっこう / にほん", () => {
    expect(syllabifyKana("がっこう")).toEqual([
      { kana: "がっ", romaji: "ga-k", hangul: "갓" },
      { kana: "こう", romaji: "ko-o", hangul: "코오" },
    ]);
    expect(syllabifyKana("にほん")).toEqual([
      { kana: "に", romaji: "ni", hangul: "니" },
      { kana: "ほん", romaji: "ho-n", hangul: "혼" },
    ]);
  });

  it("장음 기호도 앞 음절에 붙는다: コーヒー", () => {
    expect(syllabifyKana("コーヒー")).toEqual([
      { kana: "こー", romaji: "ko-o", hangul: "코오" },
      { kana: "ひー", romaji: "hi-i", hangul: "히이" },
    ]);
  });

  it("음절을 이어 붙이면 transliterateKana 결과와 같다", () => {
    for (const kana of ["がっこう", "てんき", "さんぽ", "しています", "ですか？", "かいがい"]) {
      const units = syllabifyKana(kana);
      expect({
        romaji: units.map((u) => u.romaji).join("-"),
        hangul: units.map((u) => u.hangul).join(""),
      }).toEqual(transliterateKana(kana));
    }
  });

  it("빈 문자열·구두점만 있으면 빈 배열", () => {
    expect(syllabifyKana("")).toEqual([]);
    expect(syllabifyKana("。")).toEqual([]);
  });
});
