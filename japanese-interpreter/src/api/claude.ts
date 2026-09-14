import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { AnalysisSchema, type Analysis } from "../types/analysis";
import { validateAnalysis } from "./validate";

export const ANALYSIS_SYSTEM_PROMPT = `너는 한국인 일본어 학습자를 위한 문장 분석기다. 입력된 일본어 한 문장을 분석해 JSON으로만 응답한다.

규칙:
1. tokens: 문장을 어절(단어+조사 단위)로 분할한다. 모든 tokens[i].surface를 순서대로 이어 붙이면 구두점·공백 포함 원문과 정확히 일치해야 한다. 구두점(、。？！)은 바로 앞 토큰에 붙인다.
2. romaji: 모라 단위로 하이픈 구분한다. 장음은 모음을 반복 표기한다 (りょこう → "ryo-ko-o", ō/ou 표기 금지). ん은 "n", っ는 뒤 자음 중복(がっこう → "ga-k-ko-o"). 헵번식 기반.
3. hangul: 한국 일본어 교재 관용 표기. 어두 청음도 격음으로 통일(か=카, た=타), つ=츠, ざ행=자/즈/조, ん=받침 ㄴ/ㅇ(뒤 자음에 따라), っ=받침 ㅅ, 장음=모음 반복(료코오).
4. segments: 문장을 2~6개의 의미 덩어리로 나눈다. 각 segments[i].jp_text는 원문의 연속 부분열이고, 순서대로 이어 붙이면 원문 전체가 된다. ko_text를 순서대로 이어 붙이면 자연스러운 한국어 번역이 되도록 하며 translation_ko와 의미가 일치해야 한다. 각 토큰의 segment_index는 그 토큰이 포함된 세그먼트 번호(0부터)다.
5. grammar_points: N5~N3 수준 학습자에게 유용한 문형만 0~3개 (예: 〜なら, 〜たい, 〜派). explanation_ko는 2~3문장, 존댓말.
6. vocab: 학습 가치가 있는 실질어(명사/동사/형용사) 토큰만 token_index로 지정한다.
7. sentence_jp에는 입력받은 원문을 그대로 넣는다.`;

export interface AnalyzeOptions {
  apiKey: string;
  model: string;
}

async function callOnce(
  client: Anthropic,
  model: string,
  messages: Anthropic.MessageParam[],
): Promise<Analysis> {
  const res = await client.messages.parse({
    model,
    max_tokens: 8000,
    system: [
      {
        type: "text",
        text: ANALYSIS_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages,
    output_config: {
      effort: "low",
      format: zodOutputFormat(AnalysisSchema),
    },
  });
  if (!res.parsed_output) throw new Error("분석 결과를 파싱하지 못했습니다.");
  return res.parsed_output;
}

/**
 * 문장 하나를 분석한다. 후검증 실패 시 실패 항목을 알려주며 1회 재시도하고,
 * 그래도 실패하면 마지막 결과를 그대로 반환한다 (UI가 우아한 저하 처리).
 */
export async function analyzeSentence(sentence: string, opts: AnalyzeOptions): Promise<Analysis> {
  const client = new Anthropic({ apiKey: opts.apiKey, dangerouslyAllowBrowser: true });
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: sentence }];

  let analysis = await callOnce(client, opts.model, messages);
  const result = validateAnalysis(analysis, sentence);
  if (result.ok) return analysis;

  const retryMessages: Anthropic.MessageParam[] = [
    ...messages,
    { role: "assistant", content: JSON.stringify(analysis) },
    {
      role: "user",
      content: `이전 분석에 다음 문제가 있다. 규칙을 지켜 전체 JSON을 다시 생성하라:\n- ${result.errors.join("\n- ")}`,
    },
  ];
  try {
    const retried = await callOnce(client, opts.model, retryMessages);
    if (validateAnalysis(retried, sentence).ok) return retried;
    return retried;
  } catch {
    return analysis;
  }
}

/** 사용자 친화적 에러 메시지로 변환 */
export function describeApiError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) {
    return "API 키가 올바르지 않습니다. 설정에서 키를 확인해 주세요.";
  }
  if (error instanceof Anthropic.RateLimitError) {
    return "요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.";
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return "네트워크 연결에 실패했습니다. 인터넷 상태를 확인해 주세요.";
  }
  if (error instanceof Anthropic.APIError) {
    return `API 오류 (${error.status}): ${error.message}`;
  }
  return error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
}
