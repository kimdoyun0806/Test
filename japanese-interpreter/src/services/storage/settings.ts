import { DEFAULT_MODEL } from "../../types/analysis";

export interface AppSettings {
  apiKey: string;
  model: string;
  /** Cloudflare Worker 프록시 URL — 설정되면 API 키 대신 프록시로 호출 */
  proxyUrl: string;
  /** 프록시 접속 비밀번호 (x-access-password 헤더) */
  proxyPassword: string;
  /** true면 API 대신 fixture 기반 목 클라이언트 사용 */
  mockMode: boolean;
  showRomaji: boolean;
  showHangul: boolean;
  /** SRS 신규 카드 일일 상한 */
  newCardsPerDay: number;
  /** 설정 마이그레이션 버전 */
  settingsVersion: number;
}

/**
 * 빌드에 내장된 공용 프록시 (공용 사이트용 — 방문자는 아무 설정 없이 사용).
 * GitHub 저장소 Settings → Actions Variables의 ZENJI_PROXY_URL / ZENJI_PROXY_PASSWORD가
 * 배포 워크플로에서 VITE_PROXY_URL / VITE_PROXY_PASSWORD로 주입된다.
 */
export const ENV_PROXY_URL: string =
  (import.meta.env.VITE_PROXY_URL as string | undefined) ?? "";
export const ENV_PROXY_PASSWORD: string =
  (import.meta.env.VITE_PROXY_PASSWORD as string | undefined) ?? "";

/** 실제 분석을 호출할 자격(키·프록시·내장 프록시)이 있는지 */
export function hasCredentials(settings: AppSettings): boolean {
  return Boolean(settings.apiKey || settings.proxyUrl || ENV_PROXY_URL);
}

const KEY = "jp-tutor-settings";
const CURRENT_SETTINGS_VERSION = 2;

export const DEFAULT_SETTINGS: AppSettings = {
  apiKey: "",
  proxyUrl: "",
  proxyPassword: "",
  model: DEFAULT_MODEL,
  mockMode: false,
  showRomaji: true,
  showHangul: true,
  newCardsPerDay: 20,
  settingsVersion: CURRENT_SETTINGS_VERSION,
};

/**
 * 로컬 개발 전용 키 주입: japanese-interpreter/.env.local 에
 * VITE_ANTHROPIC_API_KEY=sk-ant-... 을 넣으면 입력 없이 사용된다.
 * (.env.local은 gitignore됨. 배포 워크플로에는 이 변수가 없으므로
 *  공개 배포본에 키가 포함될 일이 없다 — 절대 CI 시크릿으로 넣지 말 것)
 */
export const ENV_API_KEY: string =
  (import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined) ?? "";

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<AppSettings>) : {};
    const merged = { ...DEFAULT_SETTINGS, ...parsed };
    // v2 마이그레이션: 초기 버전의 기본값(Opus)이 저장돼 있으면 빠른 Haiku로 1회 재설정
    if (raw && (parsed.settingsVersion ?? 1) < CURRENT_SETTINGS_VERSION) {
      merged.model = DEFAULT_MODEL;
      merged.settingsVersion = CURRENT_SETTINGS_VERSION;
      saveSettings(merged);
    }
    // 저장된 키가 없으면 로컬 환경변수 키 사용 (localStorage에는 저장하지 않음)
    if (!merged.apiKey && ENV_API_KEY) merged.apiKey = ENV_API_KEY;
    return merged;
  } catch {
    return { ...DEFAULT_SETTINGS, apiKey: ENV_API_KEY };
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // localStorage 불가 환경(시크릿 모드 등) — 세션 한정으로 동작
  }
}
