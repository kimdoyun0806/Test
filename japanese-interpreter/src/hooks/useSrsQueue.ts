import { useCallback, useEffect, useState } from "react";
import type { VocabCard } from "../services/storage/db";
import { gradeVocab, listDueVocab } from "../services/storage/vocabStore";
import type { SrsQuality } from "../services/srs";

/** 오늘 복습할 카드 큐 */
export function useSrsQueue() {
  const [queue, setQueue] = useState<VocabCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);

  const reload = useCallback(async () => {
    setLoading(true);
    const due = await listDueVocab();
    setQueue(due);
    setReviewedCount(0);
    setCorrectCount(0);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** 현재 카드(큐 맨 앞)를 채점하고 다음으로 넘어간다 */
  const grade = useCallback(
    async (q: SrsQuality) => {
      const card = queue[0];
      if (!card) return;
      await gradeVocab(card.id, q);
      setReviewedCount((n) => n + 1);
      if (q >= 4) setCorrectCount((n) => n + 1);
      setQueue((prev) => {
        const [first, ...rest] = prev;
        // "다시(1)"는 세션 말미에 재출제
        return q < 3 && first ? [...rest, first] : rest;
      });
    },
    [queue],
  );

  return { queue, current: queue[0], loading, grade, reload, reviewedCount, correctCount };
}
