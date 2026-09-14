import type { Analysis } from "../types/analysis";

/** 비교 전 정규화: NFKC + 모든 공백 제거 */
export function normalizeForCompare(s: string): string {
  return s.normalize("NFKC").replace(/\s+/g, "");
}

export interface ValidationResult {
  ok: boolean;
  /** 실패 항목 설명 (재요청 프롬프트에 그대로 사용) */
  errors: string[];
  /** 색상 매핑만 실패한 경우 true — 번역+루비는 표시 가능 */
  segmentOnlyFailure: boolean;
}

/**
 * 분석 결과가 원문과 정합하는지 기계 검증한다.
 * - 토큰 surface 연결 == 원문
 * - 세그먼트 jp_text 연결 == 원문
 * - segment_index 단조 비감소·범위 내
 * - vocab token_index 유효
 */
export function validateAnalysis(analysis: Analysis, original: string): ValidationResult {
  const errors: string[] = [];
  const src = normalizeForCompare(original);

  const tokenJoin = normalizeForCompare(analysis.tokens.map((t) => t.surface).join(""));
  const tokensOk = tokenJoin === src;
  if (!tokensOk) {
    errors.push(
      `tokens의 surface를 이어 붙인 결과("${tokenJoin}")가 원문("${src}")과 일치하지 않습니다.`,
    );
  }

  const segJoin = normalizeForCompare(analysis.segments.map((s) => s.jp_text).join(""));
  let segmentsOk = segJoin === src;
  if (!segmentsOk) {
    errors.push(
      `segments의 jp_text를 이어 붙인 결과("${segJoin}")가 원문("${src}")과 일치하지 않습니다.`,
    );
  }

  let prev = 0;
  for (const [i, t] of analysis.tokens.entries()) {
    if (t.segment_index < prev || t.segment_index >= analysis.segments.length) {
      errors.push(
        `tokens[${i}].segment_index(${t.segment_index})가 범위를 벗어나거나 순서가 역행합니다.`,
      );
      segmentsOk = false;
      break;
    }
    prev = t.segment_index;
  }

  for (const [i, v] of analysis.vocab.entries()) {
    if (v.token_index < 0 || v.token_index >= analysis.tokens.length) {
      errors.push(`vocab[${i}].token_index(${v.token_index})가 tokens 범위를 벗어납니다.`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    // 토큰과 vocab은 정상이고 세그먼트 정합만 깨진 경우 → 색상 없이 표시 가능
    segmentOnlyFailure: tokensOk && !segmentsOk && errors.every((e) => e.includes("segment")),
  };
}
