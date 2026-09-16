import { ENV_PROXY_PASSWORD, ENV_PROXY_URL } from "./storage/settings";

const ADMIN_KEY = "zenji-admin-code";

export function getAdminCode(): string {
  try {
    return localStorage.getItem(ADMIN_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setAdminCode(code: string): void {
  try {
    if (code) localStorage.setItem(ADMIN_KEY, code);
    else localStorage.removeItem(ADMIN_KEY);
  } catch {
    // 세션 한정 동작
  }
}

/** 내장 프록시로 운영 중인지 (사용량 배지·어드민 기능 표시 여부) */
export function proxyEnabled(): boolean {
  return Boolean(ENV_PROXY_URL);
}

export interface UsageInfo {
  ok: boolean;
  /** 보낸 어드민 코드가 유효한지 */
  admin: boolean;
  /** 오늘 사이트 전체 사용량 */
  used: number;
  limit: number;
  /** KV가 연결되어 실제로 제한이 동작 중인지 */
  limited: boolean;
  /** 집계 기준 날짜(KST, YYYY-MM-DD) — 구버전 Worker는 주지 않는다 */
  date?: string;
}

/** 사이트 사용량 조회 (어드민 코드 검증 겸용) */
export async function fetchUsage(adminCode: string = getAdminCode()): Promise<UsageInfo> {
  if (!ENV_PROXY_URL) throw new Error("프록시가 설정되지 않았습니다.");
  const res = await fetch(`${ENV_PROXY_URL.replace(/\/+$/, "")}/usage`, {
    headers: {
      "x-access-password": ENV_PROXY_PASSWORD,
      "x-admin-code": adminCode,
    },
    // 브라우저·중간 캐시가 오래된 숫자를 돌려주지 않도록
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`사용량 조회 실패 (${res.status})`);
  return (await res.json()) as UsageInfo;
}

/**
 * 프록시 응답 헤더(x-zenji-*)에서 현재 사용량을 읽는다.
 * Worker가 모든 응답에 실어 보내므로, 분석 호출이 끝나는 즉시 추가 요청 없이 배지를 갱신할 수 있다.
 * 헤더가 없으면(구버전 Worker) null.
 */
export function readUsageHeaders(headers: { get(name: string): string | null }): UsageInfo | null {
  const used = Number(headers.get("x-zenji-used"));
  const limit = Number(headers.get("x-zenji-limit"));
  if (headers.get("x-zenji-used") === null || !Number.isFinite(used) || !Number.isFinite(limit)) {
    return null;
  }
  return {
    ok: true,
    admin: headers.get("x-zenji-admin") === "1",
    used,
    limit,
    limited: headers.get("x-zenji-limited") !== "0",
    date: headers.get("x-zenji-date") ?? undefined,
  };
}

/**
 * 같은 날짜 안에서는 사용량이 뒤로 가지 않게 병합한다.
 * (KV는 최종 일관성이라 방금 올라간 숫자를 조회가 잠깐 낮게 돌려줄 수 있다)
 */
export function mergeUsage(prev: UsageInfo | null, next: UsageInfo): UsageInfo {
  if (!prev?.date || !next.date || prev.date !== next.date) return next;
  return { ...next, used: Math.max(prev.used, next.used) };
}

/** 분석 완료 후 사용량 배지 갱신용 이벤트 */
export const USAGE_CHANGED_EVENT = "zenji-usage-changed";

/**
 * 배지 갱신 알림.
 * usage를 주면 배지가 그 값을 즉시 반영하고(네트워크 왕복 없음),
 * 없으면 배지가 스스로 다시 조회한다.
 */
export function notifyUsageChanged(usage?: UsageInfo): void {
  window.dispatchEvent(
    new CustomEvent<UsageInfo | null>(USAGE_CHANGED_EVENT, { detail: usage ?? null }),
  );
}
