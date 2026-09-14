import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
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
- t: 토큰 배열 — s=표기, k=히라가나 읽기, g=소속 세그먼트 번호(0부터), m=한국어 뜻, v=JLPT 레벨 또는 null
- seg: 의미 세그먼트 배열 — j=일본어 부분, ko=대응하는 한국어 번역 조각
- gr: 문법 포인트 배열 — p=문형, ex=문장 내 해당 부분, d=한국어 설명

규칙:
1. t: 어절(단어+조사 단위)로 분할한다. 모든 s를 순서대로 이어 붙이면 구두점·공백 포함 원문과 정확히 일치해야 한다. 구두점(、。？！)은 바로 앞 토큰에 붙인다.
2. k: 히라가나 읽기만 넣는다 (숫자·라틴 문자는 읽는 소리를 히라가나로, 구두점은 제외). 절대로 뜻이나 설명을 넣지 않는다.
3. m: 모든 토큰에 필수. 실질어는 뜻(예: 今→"지금"), 조사·어미·활용형은 문법 기능을 짧게(예: は→"~는(주제 조사)", んですが→"~인데요(부드러운 역접)"). 뜻·설명은 오직 m에만 넣는다.
4. v: 실질어(명사·동사·형용사·부사)만 JLPT 레벨(N5~N1), 조사·어미·구두점 토큰은 null.
5. seg: 문장을 2~6개 의미 덩어리로 나눈다. j를 순서대로 이으면 원문 전체가 되고, ko를 순서대로 이으면 tr과 의미가 같은 자연스러운 번역이 된다. 각 토큰의 g는 소속 세그먼트 번호다.
6. gr: N5~N3 학습자에게 유용한 문형만 0~3개, d는 1~2문장 존댓말로 간결하게.`;

export interface AnalyzeOptions {
  apiKey: string;
  model: string;
}

const KO_TO_JA_PROMPT = `너는 한국어 문장을 자연스러운 일본어로 옮기는 번역가다. 일상 회화체(です・ます체)를 기본으로, 간결하고 자연스럽게 번역한다. JSON으로만 응답한다. ja 필드에 일본어 번역문만 넣는다.`;

const KoToJaSchema = z.object({ ja: z.string() });

/** 한국어 문장 → 자연스러운 일본어 번역 (이후 일반 분석 파이프라인에 넣는다) */
export async function translateKoToJa(korean: string, opts: AnalyzeOptions): Promise<string> {
  const client = new Anthropic({ apiKey: opts.apiKey, dangerouslyAllowBrowser: true });
  const res = await client.messages.parse({
    model: opts.model,
    max_tokens: 1000,
    system: [
      { type: "text", text: KO_TO_JA_PROMPT, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: korean }],
    output_config: {
      ...(supportsEffort(opts.model) ? { effort: "low" as const } : {}),
      format: zodOutputFormat(KoToJaSchema),
    },
  });
  const ja = res.parsed_output?.ja?.trim();
  if (!ja) throw new Error("일본어 번역에 실패했습니다.");
  return ja;
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
  // 색상 매핑만 깨진 경우: 재시도(추가 비용·대기) 없이 즉시 색상 없는 표시로 넘긴다
  if (result.segmentOnlyFailure) return analysis;

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

/** 손글씨 이미지(캔버스 PNG)를 Claude Vision으로 인식 — 구글 인식 실패 시 폴백 */
export async function recognizeHandwritingImage(
  imageDataUrl: string,
  opts: AnalyzeOptions,
): Promise<string> {
  const client = new Anthropic({ apiKey: opts.apiKey, dangerouslyAllowBrowser: true });
  const base64 = imageDataUrl.split(",")[1] ?? "";
  const res = await client.messages.create({
    model: opts.model,
    max_tokens: 200,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: "image/png", data: base64 },
          },
          {
            type: "text",
            text: "이 손글씨 이미지에 적힌 일본어 텍스트만 정확히 출력하라. 설명이나 다른 말은 하지 마라.",
          },
        ],
      },
    ],
  });
  const text = res.content.find((b) => b.type === "text")?.text.trim() ?? "";
  if (!text) throw new Error("손글씨를 인식하지 못했습니다.");
  return text;
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
