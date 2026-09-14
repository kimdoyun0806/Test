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
}

/** 사이트 사용량 조회 (어드민 코드 검증 겸용) */
export async function fetchUsage(adminCode: string = getAdminCode()): Promise<UsageInfo> {
  if (!ENV_PROXY_URL) throw new Error("프록시가 설정되지 않았습니다.");
  const res = await fetch(`${ENV_PROXY_URL.replace(/\/+$/, "")}/usage`, {
    headers: {
      "x-access-password": ENV_PROXY_PASSWORD,
      "x-admin-code": adminCode,
    },
  });
  if (!res.ok) throw new Error(`사용량 조회 실패 (${res.status})`);
  return (await res.json()) as UsageInfo;
}

/** 분석 완료 후 사용량 배지 갱신용 이벤트 */
export const USAGE_CHANGED_EVENT = "zenji-usage-changed";
export function notifyUsageChanged(): void {
  window.dispatchEvent(new Event(USAGE_CHANGED_EVENT));
}
