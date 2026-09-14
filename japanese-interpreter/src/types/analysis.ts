import { z } from "zod";
import { transliterateKana } from "../services/kanaTransliterate";

/**
 * API 통신용(wire) 스키마 — 필드명을 축약해 출력 토큰을 줄인다 (생성 속도·비용 절감).
 * s=표기, k=가나 읽기, g=세그먼트 번호, m=뜻, v=JLPT 레벨.
 * 로마자·한글 발음은 모델에게 시키지 않고 k에서 규칙 변환한다 (정확성+속도).
 */
export const WireAnalysisSchema = z.object({
  tr: z.string(),
  t: z.array(
    z.object({
      s: z.string(),
      k: z.string(),
      g: z.number().int(),
      // m·v는 모델이 가끔 빈 값/규격 외 값을 넣으므로 느슨하게 받고 fromWire에서 정리한다
      m: z.string().nullable(),
      v: z.string().nullable(),
    }),
  ),
  seg: z.array(z.object({ j: z.string(), ko: z.string() })),
  gr: z.array(z.object({ p: z.string(), ex: z.string(), d: z.string() })),
});
export type WireAnalysis = z.infer<typeof WireAnalysisSchema>;

/** 앱 내부·저장용 스키마 (UI가 사용하는 형태) */
export const AnalysisSchema = z.object({
  sentence_jp: z.string(),
  translation_ko: z.string(),
  tokens: z.array(
    z.object({
      surface: z.string(),
      reading_kana: z.string(),
      romaji: z.string(),
      hangul: z.string(),
      segment_index: z.number().int(),
      /** 모든 토큰의 한국어 뜻 (조사·어미는 문법 기능 설명). 구버전 캐시에는 없을 수 있음 */
      meaning_ko: z.string().nullable(),
      /** 실질어의 JLPT 레벨, 조사·어미는 null */
      level: z.enum(["N5", "N4", "N3", "N2", "N1"]).nullable(),
    }),
  ),
  segments: z.array(z.object({ jp_text: z.string(), ko_text: z.string() })),
  grammar_points: z.array(
    z.object({
      pattern: z.string(),
      jp_example: z.string(),
      explanation_ko: z.string(),
    }),
  ),
});

export type Analysis = z.infer<typeof AnalysisSchema>;
export type AnalysisToken = Analysis["tokens"][number];
export type AnalysisSegment = Analysis["segments"][number];
export type GrammarPoint = Analysis["grammar_points"][number];

const LEVELS = ["N5", "N4", "N3", "N2", "N1"] as const;

/** 구두점·공백만으로 이루어진 표기인지 */
const PUNCT_ONLY_RE = /^[\s、。！？!?.,・「」『』（）()〜~…ー]+$/;

/** wire → 내부 형태 변환. 로마자·한글 발음은 가나 읽기에서 규칙 생성한다 */
export function fromWire(wire: WireAnalysis, sentence: string): Analysis {
  const tokens: Analysis["tokens"] = [];
  for (const t of wire.t) {
    // 구두점만 있는 토큰은 앞 토큰에 병합 (외톨이 、/。 카드 방지)
    if (PUNCT_ONLY_RE.test(t.s) && tokens.length > 0) {
      tokens[tokens.length - 1].surface += t.s;
      continue;
    }
    const { romaji, hangul } = transliterateKana(t.k);
    const level = LEVELS.includes(t.v as (typeof LEVELS)[number])
      ? (t.v as (typeof LEVELS)[number])
      : null;
    tokens.push({
      surface: t.s,
      reading_kana: t.k,
      romaji,
      hangul,
      segment_index: t.g,
      meaning_ko: t.m || null,
      level,
    });
  }
  return {
    sentence_jp: sentence.normalize("NFKC").trim(),
    translation_ko: wire.tr.trim(),
    tokens,
    segments: wire.seg.map((s) => ({ jp_text: s.j, ko_text: s.ko })),
    grammar_points: wire.gr.map((g) => ({
      pattern: g.p,
      jp_example: g.ex,
      explanation_ko: g.d,
    })),
  };
}

/** 분석 결과 형태가 바뀌면 올려서 구버전 캐시를 무효화한다 */
export const ANALYSIS_SCHEMA_VERSION = 3;

export const SEGMENT_COLOR_COUNT = 6;

export const MODEL_OPTIONS = [
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5 — 저비용, 일상 문장 충분 (기본)" },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5 — 균형" },
  { id: "claude-opus-5", label: "Claude Opus 5 — 최고 품질 (고비용)" },
] as const;

export const DEFAULT_MODEL = "claude-haiku-4-5";
