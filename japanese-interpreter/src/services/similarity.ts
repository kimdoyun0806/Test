/** 발음 채점: 정규화 + Levenshtein 유사도 */

/** 가타카나 → 히라가나 (기본 범위 코드포인트 시프트) */
export function katakanaToHiragana(s: string): string {
  return s.replace(/[ァ-ヶ]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60),
  );
}

/** NFKC → 구두점·공백 제거 → 가타카나→히라가나 */
export function normalizeForSimilarity(s: string): string {
  return katakanaToHiragana(
    s
      .normalize("NFKC")
      .replace(/[\s、。！？!?.,「」『』（）()・〜~ー-]/g, ""),
  );
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[b.length];
}

/** 0~1 유사도 */
export function similarity(a: string, b: string): number {
  const na = normalizeForSimilarity(a);
  const nb = normalizeForSimilarity(b);
  if (na.length === 0 && nb.length === 0) return 1;
  if (na.length === 0 || nb.length === 0) return 0;
  return 1 - levenshtein(na, nb) / Math.max(na.length, nb.length);
}

/**
 * 발음 채점: 표기 기반 1차 비교, 점수가 낮으면(<0.7) 가나 읽기 기반 2차 비교 후 최대값.
 * (동음이의 한자 오인식 구제)
 */
export function scorePronunciation(
  recognized: string,
  targetSurface: string,
  targetKana?: string,
): number {
  const surfaceScore = similarity(recognized, targetSurface);
  if (surfaceScore >= 0.7 || !targetKana) return surfaceScore;
  // 인식 결과에서 가나·한자 그대로 두되 정규화만 하여 읽기와 비교
  const kanaScore = similarity(recognized, targetKana);
  return Math.max(surfaceScore, kanaScore);
}

export type ScoreGrade = "great" | "good" | "retry";

export function gradeOf(score: number): ScoreGrade {
  if (score >= 0.8) return "great";
  if (score >= 0.6) return "good";
  return "retry";
}
