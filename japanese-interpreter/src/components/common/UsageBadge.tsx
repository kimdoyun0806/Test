import { useCallback, useEffect, useState } from "react";
import {
  USAGE_CHANGED_EVENT,
  fetchUsage,
  mergeUsage,
  type UsageInfo,
} from "../../services/auth";

/**
 * 헤더에 오늘 사이트 사용량(N/한도)을 표시하는 배지.
 * 갱신 경로는 셋:
 *  1) 분석 응답에 실려 온 사용량 헤더 → 응답 도착 즉시 반영 (네트워크 왕복 없음)
 *  2) 값 없는 갱신 이벤트(관리자 모드 전환 등) → 서버에 다시 조회
 *  3) 탭 복귀·창 포커스 → 다른 기기/탭에서 쓴 횟수 반영
 */
export default function UsageBadge() {
  const [usage, setUsage] = useState<UsageInfo | null>(null);

  // 같은 날짜에서는 숫자가 뒤로 가지 않게 병합 (KV 반영 지연 대비)
  const apply = useCallback((next: UsageInfo) => {
    setUsage((prev) => mergeUsage(prev, next));
  }, []);

  const refresh = useCallback(async () => {
    try {
      apply(await fetchUsage());
    } catch {
      // 조회 실패는 조용히 무시 (다음 갱신에서 재시도)
    }
  }, [apply]);

  useEffect(() => {
    void refresh();

    const onUsageChanged = (event: Event) => {
      const detail = (event as CustomEvent<UsageInfo | null>).detail;
      if (detail) apply(detail);
      else void refresh();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };

    window.addEventListener(USAGE_CHANGED_EVENT, onUsageChanged);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      window.removeEventListener(USAGE_CHANGED_EVENT, onUsageChanged);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [refresh, apply]);

  if (!usage) return null;

  const label = usage.admin
    ? "관리자 · 무제한"
    : usage.limited
      ? `오늘 ${usage.used}/${usage.limit}회`
      : "무제한";

  return (
    <span
      className="muted"
      style={{
        marginLeft: "auto",
        background: "var(--color-card-2)",
        borderRadius: 10,
        padding: "4px 10px",
        fontSize: 12,
      }}
    >
      {label}
    </span>
  );
}
