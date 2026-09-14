import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  WireAnalysisSchema,
  fromWire,
  ESCALATION_MODEL,
  type Analysis,
} from "../types/analysis";
import { validateAnalysis } from "./validate";

export const ANALYSIS_SYSTEM_PROMPT = `너는 한국인 일본어 학습자를 위한 문장 분석기다. 입력된 일본어 문장을 분석해 JSON으로만 응답한다.

출력 필드:
- tr: 자연스러운 한국어 번역 전체
- t: 토큰 배열 — s=표기, k=히라가나 읽기, r=로마자, h=한글 발음, g=소속 세그먼트 번호(0부터), m=한국어 뜻, v=JLPT 레벨 또는 null
- seg: 의미 세그먼트 배열 — j=일본어 부분, ko=대응하는 한국어 번역 조각
- gr: 문법 포인트 배열 — p=문형, ex=문장 내 해당 부분, d=한국어 설명

규칙:
1. t: 어절(단어+조사 단위)로 분할한다. 모든 s를 순서대로 이어 붙이면 구두점·공백 포함 원문과 정확히 일치해야 한다. 구두점(、。？！)은 바로 앞 토큰에 붙인다.
2. r: 모라 단위 하이픈 구분. 장음은 모음 반복(りょこう → "ryo-ko-o", ō/ou 표기 금지), ん="n", っ=뒤 자음 중복(がっこう → "ga-k-ko-o"). 헵번식 기반.
3. h: 한국 일본어 교재 관용 표기. 어두 청음도 격음 통일(か=카, た=타), つ=츠, ざ행=자/즈/조, ん=받침 ㄴ/ㅇ, っ=받침 ㅅ, 장음=모음 반복(료코오).
4. m: 모든 토큰에 필수. 실질어는 뜻(예: 今→"지금"), 조사·어미·활용형은 문법 기능을 짧게(예: は→"~는(주제 조사)", んですが→"~인데요(부드러운 역접)").
5. v: 실질어(명사·동사·형용사·부사)만 JLPT 레벨(N5~N1), 조사·어미·구두점 토큰은 null.
6. seg: 문장을 2~6개 의미 덩어리로 나눈다. j를 순서대로 이으면 원문 전체가 되고, ko를 순서대로 이으면 tr과 의미가 같은 자연스러운 번역이 된다. 각 토큰의 g는 소속 세그먼트 번호다.
7. gr: N5~N3 학습자에게 유용한 문형만 0~3개, d는 1~2문장 존댓말로 간결하게.`;

export interface AnalyzeOptions {
  apiKey: string;
  model: string;
}

/** effort 파라미터를 지원하지 않는 모델 (Haiku 4.5 등 — 보내면 400) */
function supportsEffort(model: string): boolean {
  return !model.startsWith("claude-haiku");
}

async function callOnce(
  client: Anthropic,
  model: string,
  sentence: string,
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
      ...(supportsEffort(model) ? { effort: "low" as const } : {}),
      format: zodOutputFormat(WireAnalysisSchema),
    },
  });
  if (!res.parsed_output) throw new Error("분석 결과를 파싱하지 못했습니다.");
  return fromWire(res.parsed_output, sentence);
}

/**
 * 문장 하나를 분석한다. 후검증 실패 시 1회 재시도하되,
 * 기본 모델이 저비용(Haiku 등)이면 고품질 모델(Opus)로 자동 승격해 재시도한다
 * — 평소엔 저렴하게, 어려운 문장에서만 고품질 모델 비용이 발생.
 * 재시도도 실패하면 마지막 결과를 그대로 반환한다 (UI가 색상 없이 우아한 저하 처리).
 */
export async function analyzeSentence(sentence: string, opts: AnalyzeOptions): Promise<Analysis> {
  const client = new Anthropic({ apiKey: opts.apiKey, dangerouslyAllowBrowser: true });
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: sentence }];

  const analysis = await callOnce(client, opts.model, sentence, messages);
  const result = validateAnalysis(analysis, sentence);
  if (result.ok) return analysis;

  const retryModel = opts.model === ESCALATION_MODEL ? opts.model : ESCALATION_MODEL;
  const retryMessages: Anthropic.MessageParam[] = [
    ...messages,
    {
      role: "user",
      content: `이전 분석에 다음 문제가 있었다. 규칙을 지켜 전체 JSON을 다시 생성하라:\n- ${result.errors.join("\n- ")}`,
    },
  ];
  try {
    const retried = await callOnce(client, retryModel, sentence, retryMessages);
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
