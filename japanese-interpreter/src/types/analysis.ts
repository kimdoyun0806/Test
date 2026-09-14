import { z } from "zod";

/**
 * 문장 분석 결과의 단일 진실 원천.
 * Claude 구조화 출력(zodOutputFormat)과 UI 컴포넌트 타입에 동시에 사용된다.
 */
export const AnalysisSchema = z.object({
  /** 모델이 인식한 원문 (검증용 에코백) */
  sentence_jp: z.string(),
  /** 자연스러운 한국어 번역 전체 */
  translation_ko: z.string(),
  tokens: z.array(
    z.object({
      /** 표기 (예: "旅行") — 순서대로 이어 붙이면 원문과 일치해야 함 */
      surface: z.string(),
      /** 히라가나 읽기 (예: "りょこう") */
      reading_kana: z.string(),
      /** 모라 단위 하이픈 로마자 (예: "ryo-ko-o") */
      romaji: z.string(),
      /** 한글 발음 (예: "료코오") */
      hangul: z.string(),
      /** 소속 의미 세그먼트 인덱스 (0부터) */
      segment_index: z.number().int(),
    }),
  ),
  /** 의미 덩어리 — 색 = 배열 인덱스 % 6 (클라이언트가 결정) */
  segments: z.array(
    z.object({
      /** 원문의 연속 부분열 — 순서대로 이으면 원문 전체 */
      jp_text: z.string(),
      /** 대응하는 한국어 번역 조각 */
      ko_text: z.string(),
    }),
  ),
  grammar_points: z.array(
    z.object({
      /** 예: "〜なら" */
      pattern: z.string(),
      /** 문장 내 해당 부분 (예: "行くなら") */
      jp_example: z.string(),
      /** 한국어 설명 2~3문장 */
      explanation_ko: z.string(),
    }),
  ),
  vocab: z.array(
    z.object({
      /** tokens 배열 참조 인덱스 */
      token_index: z.number().int(),
      meaning_ko: z.string(),
      level: z.enum(["N5", "N4", "N3", "N2", "N1"]).nullable(),
    }),
  ),
});

export type Analysis = z.infer<typeof AnalysisSchema>;
export type AnalysisToken = Analysis["tokens"][number];
export type AnalysisSegment = Analysis["segments"][number];
export type GrammarPoint = Analysis["grammar_points"][number];

export const SEGMENT_COLOR_COUNT = 6;

export const MODEL_OPTIONS = [
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5 — 저비용, 일상 문장 충분 (기본)" },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5 — 균형" },
  { id: "claude-opus-5", label: "Claude Opus 5 — 최고 품질 (고비용)" },
] as const;

export const DEFAULT_MODEL = "claude-haiku-4-5";

/** 검증 실패 시 자동 승격에 사용하는 고품질 모델 */
export const ESCALATION_MODEL = "claude-opus-5";
