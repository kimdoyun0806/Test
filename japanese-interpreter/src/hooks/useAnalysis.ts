import { useCallback, useState } from "react";
import type { Analysis } from "../types/analysis";
import { analyzeSentence, describeApiError } from "../api/claude";
import { analyzeMock } from "../api/mockClient";
import { getCachedAnalysis, putCachedAnalysis } from "../services/storage/analysisCache";
import { validateAnalysis } from "../api/validate";
import type { AppSettings } from "../services/storage/settings";

export interface SentenceCardData {
  id: string;
  sentence: string;
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

  const analyze = useCallback(
    async (sentence: string) => {
      const id = crypto.randomUUID();
      setCards((prev) => [{ id, sentence, status: "loading" }, ...prev]);

      try {
        const cached = await getCachedAnalysis(sentence);
        if (cached) {
          const v = validateAnalysis(cached.analysis, sentence);
          updateCard(id, {
            status: "done",
            analysis: cached.analysis,
            degraded: !v.ok,
          });
          return;
        }

        let analysis: Analysis;
        if (settings.mockMode || !settings.apiKey) {
          if (!settings.mockMode && !settings.apiKey) {
            updateCard(id, {
              status: "error",
              errorMessage: "API 키가 없습니다. 설정에서 키를 입력하거나 목 모드를 켜 주세요.",
            });
            return;
          }
          analysis = await analyzeMock(sentence);
        } else {
          analysis = await analyzeSentence(sentence, {
            apiKey: settings.apiKey,
            model: settings.model,
          });
        }

        const v = validateAnalysis(analysis, sentence);
        await putCachedAnalysis(sentence, analysis, settings.mockMode ? "mock" : settings.model);
        updateCard(id, { status: "done", analysis, degraded: !v.ok });
      } catch (error) {
        updateCard(id, { status: "error", errorMessage: describeApiError(error) });
      }
    },
    [settings, updateCard],
  );

  const removeCard = useCallback((id: string) => {
    setCards((prev) => prev.filter((c) => c.id !== id));
  }, []);

  return { cards, analyze, removeCard };
}
