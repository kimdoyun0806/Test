import type { Analysis } from "../types/analysis";
import type { VocabCard } from "./storage/db";

export type QuizKind = "fill-blank" | "word-order" | "dictation";

export interface FillBlankQuestion {
  kind: "fill-blank";
  sentence: string;
  translationKo: string;
  /** 빈칸으로 바뀐 토큰의 surface */
  answer: string;
  /** ____ 포함 문장 */
  blanked: string;
  /** 보기 (정답 포함, 셔플됨). 4개 미만이면 주관식 입력으로 폴백 */
  choices: string[];
}

export interface WordOrderQuestion {
  kind: "word-order";
  sentence: string;
  translationKo: string;
  /** 원 순서 토큰 surface 배열 */
  answerTokens: string[];
  /** 셔플된 토큰 (인덱스 포함 — 같은 표기 토큰 구분) */
  shuffledTokens: { id: number; surface: string }[];
}

export interface DictationQuestion {
  kind: "dictation";
  sentence: string;
  translationKo: string;
  readingKana: string;
}

export type QuizQuestion = FillBlankQuestion | WordOrderQuestion | DictationQuestion;

/** Fisher–Yates 셔플 (원본 불변) */
export function shuffle<T>(arr: T[], random: () => number = Math.random): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** 빈칸 문제 생성. vocab 지정 토큰이 없으면 null */
export function makeFillBlank(
  analysis: Analysis,
  wordPool: VocabCard[],
  random: () => number = Math.random,
): FillBlankQuestion | null {
  if (analysis.vocab.length === 0 || analysis.tokens.length === 0) return null;
  const pick = analysis.vocab[Math.floor(random() * analysis.vocab.length)];
  const token = analysis.tokens[pick.token_index];
  if (!token) return null;

  const blanked = analysis.tokens
    .map((t, i) => (i === pick.token_index ? "____" : t.surface))
    .join("");

  // 보기: 정답 + 어휘장의 다른 단어 3개 (같은 level 우선)
  const others = wordPool
    .filter((c) => c.type === "word" && c.front !== token.surface)
    .sort((a, b) => {
      const aSame = a.level === pick.level ? 0 : 1;
      const bSame = b.level === pick.level ? 0 : 1;
      return aSame - bSame;
    })
    .slice(0, 3)
    .map((c) => c.front);

  const choices = others.length >= 3 ? shuffle([token.surface, ...others], random) : [];

  return {
    kind: "fill-blank",
    sentence: analysis.sentence_jp,
    translationKo: analysis.translation_ko,
    answer: token.surface,
    blanked,
    choices,
  };
}

/** 단어 배열 문제. 토큰이 3개 미만이면 null */
export function makeWordOrder(
  analysis: Analysis,
  random: () => number = Math.random,
): WordOrderQuestion | null {
  if (analysis.tokens.length < 3) return null;
  const answerTokens = analysis.tokens.map((t) => t.surface);
  const withIds = answerTokens.map((surface, id) => ({ id, surface }));
  // 셔플 결과가 원 순서와 같으면 한 번 더
  let shuffled = shuffle(withIds, random);
  if (shuffled.every((t, i) => t.id === i)) shuffled = shuffle(withIds, random);
  return {
    kind: "word-order",
    sentence: analysis.sentence_jp,
    translationKo: analysis.translation_ko,
    answerTokens,
    shuffledTokens: shuffled,
  };
}

export function makeDictation(analysis: Analysis): DictationQuestion {
  return {
    kind: "dictation",
    sentence: analysis.sentence_jp,
    translationKo: analysis.translation_ko,
    readingKana: analysis.tokens.map((t) => t.reading_kana).join(""),
  };
}

/**
 * 저장 문장들의 분석 캐시에서 퀴즈 세트를 생성한다.
 * count만큼, 문장 중복 없이 순환하며 생성.
 */
export function buildQuiz(
  kind: QuizKind,
  analyses: Analysis[],
  wordPool: VocabCard[],
  count: number,
  random: () => number = Math.random,
): QuizQuestion[] {
  const pool = shuffle(analyses, random);
  const questions: QuizQuestion[] = [];
  for (const analysis of pool) {
    if (questions.length >= count) break;
    let q: QuizQuestion | null = null;
    if (kind === "fill-blank") q = makeFillBlank(analysis, wordPool, random);
    else if (kind === "word-order") q = makeWordOrder(analysis, random);
    else q = makeDictation(analysis);
    if (q) questions.push(q);
  }
  return questions;
}
