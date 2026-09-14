/** speechSynthesis 래퍼 — ja-JP 보이스 탐색 및 재생 */

let cachedVoice: SpeechSynthesisVoice | null | undefined;

function findJapaneseVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis?.getVoices() ?? [];
  return (
    voices.find((v) => v.lang === "ja-JP") ??
    voices.find((v) => v.lang.startsWith("ja")) ??
    null
  );
}

export function isTtsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** ja-JP 보이스가 있는지. 보이스 목록은 비동기 로드될 수 있어 캐시+재조회 */
export function hasJapaneseVoice(): boolean {
  if (!isTtsSupported()) return false;
  if (cachedVoice === undefined || cachedVoice === null) cachedVoice = findJapaneseVoice();
  return cachedVoice !== null;
}

export function speakJapanese(text: string, rate = 1.0): void {
  if (!isTtsSupported()) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ja-JP";
  utterance.rate = rate;
  const voice = cachedVoice ?? findJapaneseVoice();
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if (isTtsSupported()) window.speechSynthesis.cancel();
}

// 일부 브라우저는 voices를 늦게 로드 — 변경 시 캐시 갱신
if (isTtsSupported()) {
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoice = findJapaneseVoice();
  };
}
