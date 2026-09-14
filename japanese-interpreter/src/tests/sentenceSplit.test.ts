import { describe, expect, it } from "vitest";
import { containsJapanese, splitSentences } from "../services/sentenceSplit";

describe("containsJapanese", () => {
  it("가나·한자가 있으면 true", () => {
    expect(containsJapanese("こんにちは")).toBe(true);
    expect(containsJapanese("カタカナ")).toBe(true);
    expect(containsJapanese("旅行")).toBe(true);
  });
  it("한국어·영어·숫자만 있으면 false", () => {
    expect(containsJapanese("안녕하세요")).toBe(false);
    expect(containsJapanese("hello 123!")).toBe(false);
    expect(containsJapanese("")).toBe(false);
  });
});

describe("splitSentences", () => {
  it("。기준으로 분리한다", () => {
    expect(splitSentences("こんにちは。元気です。")).toEqual(["こんにちは。", "元気です。"]);
  });

  it("？는 분리 기준이 아니다 — 선택 의문문은 한 발화", () => {
    expect(splitSentences("国内派ですか？海外派ですか？")).toEqual([
      "国内派ですか?海外派ですか?", // NFKC로 ？는 반각이 된다
    ]);
  });

  it("구두점 없는 한 문장은 그대로", () => {
    expect(splitSentences("旅行に行く")).toEqual(["旅行に行く"]);
  });

  it("빈 입력은 빈 배열", () => {
    expect(splitSentences("   ")).toEqual([]);
  });

  it("。뒤에 이어지는 의문문도 분리된다", () => {
    expect(splitSentences("わかりました。本当ですか？")).toEqual([
      "わかりました。",
      "本当ですか?",
    ]);
  });
});
