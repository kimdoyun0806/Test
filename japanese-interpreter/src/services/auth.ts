import { ENV_PROXY_PASSWORD, ENV_PROXY_URL } from "./storage/settings";

const CODE_KEY = "zenji-user-code";

export function getUserCode(): string {
  try {
    return localStorage.getItem(CODE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setUserCode(code: string): void {
  try {
    localStorage.setItem(CODE_KEY, code);
  } catch {
    // 세션 한정 동작
  }
}

export function clearUserCode(): void {
  try {
    localStorage.removeItem(CODE_KEY);
  } catch {
    // 무시
  }
}

/** 로그인(이용 코드) 게이트가 필요한지 — 내장 프록시로 운영될 때만 */
export function loginRequired(): boolean {
  return Boolean(ENV_PROXY_URL);
}

export interface UsageInfo {
  ok: boolean;
  admin: boolean;
  used: number;
  limit: number;
  /** KV가 연결되어 실제로 제한이 동작 중인지 */
  limited: boolean;
}

/** 이용 코드 검증 + 오늘 사용량 조회. 코드가 틀리면 null */
export async function fetchUsage(code: string): Promise<UsageInfo | null> {
  if (!ENV_PROXY_URL) return null;
  const res = await fetch(`${ENV_PROXY_URL.replace(/\/+$/, "")}/usage`, {
    headers: {
      "x-access-password": ENV_PROXY_PASSWORD,
      "x-user-code": code,
    },
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`사용량 조회 실패 (${res.status})`);
  return (await res.json()) as UsageInfo;
}

/** 분석 완료 후 사용량 배지 갱신용 이벤트 */
export const USAGE_CHANGED_EVENT = "zenji-usage-changed";
export function notifyUsageChanged(): void {
  window.dispatchEvent(new Event(USAGE_CHANGED_EVENT));
}
