import { useCallback, useEffect, useState } from "react";
import { USAGE_CHANGED_EVENT, fetchUsage, type UsageInfo } from "../../services/auth";

/** 헤더에 오늘 사이트 사용량(N/한도)을 표시하는 배지 — 분석 완료 시 자동 갱신 */
export default function UsageBadge() {
  const [usage, setUsage] = useState<UsageInfo | null>(null);

  const refresh = useCallback(async () => {
    try {
      setUsage(await fetchUsage());
    } catch {
      // 조회 실패는 조용히 무시 (다음 갱신에서 재시도)
    }
  }, []);

  useEffect(() => {
    void refresh();
    const handler = () => void refresh();
    window.addEventListener(USAGE_CHANGED_EVENT, handler);
    return () => window.removeEventListener(USAGE_CHANGED_EVENT, handler);
  }, [refresh]);

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
