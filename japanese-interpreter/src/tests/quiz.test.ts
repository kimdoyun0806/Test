import { describe, expect, it } from "vitest";
import { AnalysisSchema, type Analysis } from "../types/analysis";
import { buildQuiz, makeFillBlank, makeWordOrder, makeDictation, shuffle } from "../services/quiz";
import type { VocabCard } from "../services/storage/db";
import ryokouFixture from "../fixtures/ryokou.json";

const RYOKOU: Analysis = AnalysisSchema.parse(ryokouFixture);

function fakeWordCard(front: string, level: string | null = "N5"): VocabCard {
  return {
    id: front,
    type: "word",
    front,
    readingKana: front,
    readingHangul: "",
    romaji: "",
    meaningKo: "뜻",
    sourceSentence: "",
    level,
    srs: { easeFactor: 2.5, intervalDays: 0, repetitions: 0, dueAt: 0 },
    createdAt: 0,
  };
}

const POOL = [fakeWordCard("学校"), fakeWordCard("先生"), fakeWordCard("水"), fakeWordCard("犬")];

describe("shuffle", () => {
  it("원본을 변경하지 않고 같은 원소를 유지한다", () => {
    const arr = [1, 2, 3, 4, 5];
    const out = shuffle(arr, () => 0.5);
    expect(arr).toEqual([1, 2, 3, 4, 5]);
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("makeFillBlank", () => {
  it("빈칸 문장과 보기 4개(정답 포함, 중복 없음)를 만든다", () => {
    const q = makeFillBlank(RYOKOU, POOL, () => 0);
    expect(q).not.toBeNull();
    expect(q!.blanked).toContain("____");
    expect(q!.choices).toHaveLength(4);
    expect(q!.choices).toContain(q!.answer);
    expect(new Set(q!.choices).size).toBe(4);
  });

  it("어휘장이 부족하면 보기 없이(주관식) 만든다", () => {
    const q = makeFillBlank(RYOKOU, POOL.slice(0, 2), () => 0);
    expect(q).not.toBeNull();
    expect(q!.choices).toHaveLength(0);
  });

  it("실질어(level 지정) 토큰이 없으면 null", () => {
    const empty = {
      ...RYOKOU,
      tokens: RYOKOU.tokens.map((t) => ({ ...t, level: null })),
    };
    expect(makeFillBlank(empty, POOL)).toBeNull();
  });
});

describe("makeWordOrder", () => {
  it("셔플된 토큰을 원 순서로 복원할 수 있다", () => {
    const q = makeWordOrder(RYOKOU);
    expect(q).not.toBeNull();
    const restored = [...q!.shuffledTokens]
      .sort((a, b) => a.id - b.id)
      .map((t) => t.surface);
    expect(restored).toEqual(q!.answerTokens);
  });

  it("토큰 3개 미만이면 null", () => {
    const short = { ...RYOKOU, tokens: RYOKOU.tokens.slice(0, 2) };
    expect(makeWordOrder(short)).toBeNull();
  });
});

describe("makeDictation", () => {
  it("문장과 가나 읽기를 담는다", () => {
    const q = makeDictation(RYOKOU);
    expect(q.sentence).toBe(RYOKOU.sentence_jp);
    expect(q.readingKana).toContain("りょこう");
  });
});

describe("buildQuiz", () => {
  it("요청 개수만큼(재료 한도 내) 문항을 만든다", () => {
    const questions = buildQuiz("dictation", [RYOKOU, RYOKOU, RYOKOU], POOL, 2);
    expect(questions).toHaveLength(2);
  });

  it("재료가 없으면 빈 배열", () => {
    expect(buildQuiz("fill-blank", [], POOL, 5)).toEqual([]);
  });
});
