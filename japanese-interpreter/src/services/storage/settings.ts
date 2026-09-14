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
}

const KEY = "jp-tutor-settings";

export const DEFAULT_SETTINGS: AppSettings = {
  apiKey: "",
  model: DEFAULT_MODEL,
  mockMode: false,
  showRomaji: true,
  showHangul: true,
  newCardsPerDay: 20,
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) };
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
