import { useCallback, useState } from "react";
import type { Analysis } from "../types/analysis";
import { analyzeSentence, apiOptsFrom, describeApiError, translateKoToJa } from "../api/claude";
import { analyzeMock } from "../api/mockClient";
import { getCachedAnalysis, putCachedAnalysis } from "../services/storage/analysisCache";
import { splitSentences } from "../services/sentenceSplit";
import { validateAnalysis } from "../api/validate";
import { hasCredentials, type AppSettings } from "../services/storage/settings";
import { notifyUsageChanged } from "../services/auth";

export interface SentenceCardData {
  id: string;
  sentence: string;
  /** 한→일 경로일 때 사용자가 입력한 한국어 원문 */
  sourceKo?: string;
  status: "loading" | "done" | "error";
  analysis?: Analysis;
  /** 세그먼트 정합 실패 → 색상 매핑 없이 표시 */
  degraded?: boolean;
  errorMessage?: string;
}

/** 문장 분석 파이프라인: 캐시 조회 → (목|실API) 호출 → 검증 → 캐시 저장 */
export function useAnalysis(settings: AppSettings) {
  const [cards, setCards] = useState<SentenceCardData[]>([]);

  const updateCard = useCallback((id: string, patch: Partial<SentenceCardData>) => {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }, []);

  /** 일본어 문장을 분석해 기존 카드(id)에 결과를 채운다 */
  const runAnalysis = useCallback(
    async (id: string, sentence: string) => {
      try {
        const cached = await getCachedAnalysis(sentence);
        if (cached) {
          const v = validateAnalysis(cached.analysis, sentence);
          updateCard(id, {
            sentence,
            status: "done",
            analysis: cached.analysis,
            degraded: !v.ok,
          });
          return;
        }

        let analysis: Analysis;
        if (settings.mockMode || !hasCredentials(settings)) {
          if (!settings.mockMode && !hasCredentials(settings)) {
            updateCard(id, {
              status: "error",
              errorMessage:
                "사이트에 API 프록시가 아직 연결되지 않았습니다. 관리자에게 문의해 주세요.",
            });
            return;
          }
          analysis = await analyzeMock(sentence);
        } else {
          analysis = await analyzeSentence(sentence, apiOptsFrom(settings));
        }

        const v = validateAnalysis(analysis, sentence);
        await putCachedAnalysis(sentence, analysis, settings.mockMode ? "mock" : settings.model);
        updateCard(id, { sentence, status: "done", analysis, degraded: !v.ok });
        notifyUsageChanged();
      } catch (error) {
        updateCard(id, { status: "error", errorMessage: describeApiError(error) });
      }
    },
    [settings, updateCard],
  );

  /** 일본어 입력 → 분석 카드 */
  const analyze = useCallback(
    (sentence: string) => {
      const id = crypto.randomUUID();
      setCards((prev) => [{ id, sentence, status: "loading" }, ...prev]);
      void runAnalysis(id, sentence);
    },
    [runAnalysis],
  );

  /** 한국어 입력 → 일본어 번역 → 분석 카드 */
  const analyzeKorean = useCallback(
    (korean: string) => {
      const id = crypto.randomUUID();
      setCards((prev) => [
        { id, sentence: korean, sourceKo: korean, status: "loading" },
        ...prev,
      ]);
      void (async () => {
        if (settings.mockMode || !hasCredentials(settings)) {
          updateCard(id, {
            status: "error",
            errorMessage: settings.mockMode
              ? "목 모드에서는 한→일 번역이 지원되지 않습니다."
              : "사이트에 API 프록시가 아직 연결되지 않았습니다. 관리자에게 문의해 주세요.",
          });
          return;
        }
        try {
          const ja = await translateKoToJa(korean, apiOptsFrom(settings));
          // 번역 결과가 여러 문장이면 문장별 카드로 나눠 병렬 분석 (긴 출력 방지 → 속도 개선)
          const sentences = splitSentences(ja);
          const [first, ...rest] = sentences.length > 0 ? sentences : [ja];
          for (const s of rest.reverse()) {
            const extraId = crypto.randomUUID();
            setCards((prev) => {
              const idx = prev.findIndex((c) => c.id === id);
              const card: SentenceCardData = { id: extraId, sentence: s, status: "loading" };
              const next = [...prev];
              next.splice(idx + 1, 0, card);
              return next;
            });
            void runAnalysis(extraId, s);
          }
          await runAnalysis(id, first);
        } catch (error) {
          updateCard(id, { status: "error", errorMessage: describeApiError(error) });
        }
      })();
    },
    [settings, runAnalysis, updateCard],
  );

  const removeCard = useCallback((id: string) => {
    setCards((prev) => prev.filter((c) => c.id !== id));
  }, []);

  return { cards, analyze, analyzeKorean, removeCard };
}
