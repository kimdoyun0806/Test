import { DEFAULT_MODEL } from "../../types/analysis";

export interface AppSettings {
  apiKey: string;
  model: string;
  /** true면 API 대신 fixture 기반 목 클라이언트 사용 */
  mockMode: boolean;
  showRomaji: boolean;
  showHangul: boolean;
  /** SRS 신규 카드 일일 상한 */
  newCardsPerDay: number;
  /** 설정 마이그레이션 버전 */
  settingsVersion: number;
}

const KEY = "jp-tutor-settings";
const CURRENT_SETTINGS_VERSION = 2;

export const DEFAULT_SETTINGS: AppSettings = {
  apiKey: "",
  model: DEFAULT_MODEL,
  mockMode: false,
  showRomaji: true,
  showHangul: true,
  newCardsPerDay: 20,
  settingsVersion: CURRENT_SETTINGS_VERSION,
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    const merged = { ...DEFAULT_SETTINGS, ...parsed };
    // v2 마이그레이션: 초기 버전의 기본값(Opus)이 저장돼 있으면 빠른 Haiku로 1회 재설정
    if ((parsed.settingsVersion ?? 1) < CURRENT_SETTINGS_VERSION) {
      merged.model = DEFAULT_MODEL;
      merged.settingsVersion = CURRENT_SETTINGS_VERSION;
      saveSettings(merged);
    }
    return merged;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // localStorage 불가 환경(시크릿 모드 등) — 세션 한정으로 동작
  }
}
