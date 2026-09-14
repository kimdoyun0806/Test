/** 일본어 문자(히라가나·가타카나·한자)가 포함되어 있는지 */
export function containsJapanese(text: string): boolean {
  return /[぀-ゟ゠-ヿ一-鿿]/.test(text);
}

/**
 * 일본어 텍스트를 문장 단위로 분리한다. 마침표 「。」 기준.
 * ？！는 분리 기준으로 쓰지 않는다 — 「国内派ですか？海外派ですか？」처럼
 * 물음표가 이어지는 선택 의문문은 하나의 발화(분석 단위)이기 때문.
 */
export function splitSentences(text: string): string[] {
  const normalized = text.normalize("NFKC").trim();
  if (!normalized) return [];
  const matches = normalized.match(/[^。]+。?/g);
  if (!matches) return [normalized];
  return matches.map((s) => s.trim()).filter((s) => s.length > 0);
}
