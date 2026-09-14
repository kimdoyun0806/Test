import { AnalysisSchema, type Analysis } from "../types/analysis";
import ryokouFixture from "../fixtures/ryokou.json";

const RYOKOU: Analysis = AnalysisSchema.parse(ryokouFixture);

/**
 * API 키 없이 앱 전체를 체험할 수 있는 목 분석기.
 * 예시 문장은 fixture를 그대로 반환하고, 그 외 문장은 문자 단위의
 * 자리표시(placeholder) 분석을 생성한다. 로딩 UI 검증을 위해 지연을 흉내낸다.
 */
export async function analyzeMock(sentence: string): Promise<Analysis> {
  await new Promise((r) => setTimeout(r, 500));
  const normalized = sentence.normalize("NFKC").trim();
  if (normalized === RYOKOU.sentence_jp.normalize("NFKC").trim()) {
    return structuredClone(RYOKOU);
  }

  // 임의 문장: 절반씩 2개 세그먼트로 나눈 자리표시 분석
  const half = Math.ceil(normalized.length / 2);
  const partA = normalized.slice(0, half);
  const partB = normalized.slice(half);
  const tokens = [partA, partB]
    .filter((s) => s.length > 0)
    .map((surface, i) => ({
      surface,
      reading_kana: surface,
      romaji: "?",
      hangul: "?",
      segment_index: i,
      meaning_ko: null,
      level: null,
    }));
  return {
    sentence_jp: normalized,
    translation_ko: "(목 모드) 실제 번역은 API 키를 설정하면 제공됩니다.",
    tokens,
    segments: tokens.map((t, i) => ({
      jp_text: t.surface,
      ko_text: i === 0 ? "(목 모드 번역 앞부분)" : "(목 모드 번역 뒷부분)",
    })),
    grammar_points: [],
  };
}

/** 목 모드 예시 문장 (통역 화면의 "예시 입력" 버튼용) */
export const MOCK_EXAMPLE_SENTENCE = RYOKOU.sentence_jp;
