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
 * - 번역(tr) 비어 있지 않음
 * - 토큰 표기(s) 연결 == 원문
 * - 토큰의 세그먼트 번호(g) 단조 비감소·범위 내
 * (일본어 세그먼트 문자열은 토큰에서 조립하므로 별도 검증 불필요)
 */
export function validateAnalysis(analysis: Analysis, original: string): ValidationResult {
  const errors: string[] = [];
  const src = normalizeForCompare(original);

  const translationOk = analysis.translation_ko.trim().length > 0;
  if (!translationOk) {
    errors.push("tr(한국어 번역)이 비어 있다. 반드시 전체 번역을 넣어라.");
  }

  const tokenJoin = normalizeForCompare(analysis.tokens.map((t) => t.surface).join(""));
  const tokensOk = tokenJoin === src;
  if (!tokensOk) {
    errors.push(
      `토큰 표기(s)를 순서대로 이어 붙인 결과("${tokenJoin}")가 원문("${src}")과 일치하지 않는다.`,
    );
  }

  let segmentsOk = true;
  let prev = 0;
  for (const [i, t] of analysis.tokens.entries()) {
    if (t.segment_index < prev || t.segment_index >= analysis.segments.length) {
      errors.push(
        `${i}번째 토큰의 세그먼트 번호(g=${t.segment_index})가 범위를 벗어나거나 순서가 역행한다.`,
      );
      segmentsOk = false;
      break;
    }
    prev = t.segment_index;
  }

  return {
    ok: errors.length === 0,
    errors,
    // 토큰·번역은 정상이고 세그먼트 번호만 깨진 경우 → 색상 없이 표시 가능
    segmentOnlyFailure: tokensOk && translationOk && !segmentsOk,
  };
}
