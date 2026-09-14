/** Web Speech API SpeechRecognition 래퍼 (ja-JP) — 표준 타입 미제공이라 최소 타입 선언 */

export interface RecognitionCallbacks {
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (message: string) => void;
  onEnd: () => void;
}

interface MinimalSpeechRecognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: MinimalRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

interface MinimalRecognitionEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}

type RecognitionCtor = new () => MinimalSpeechRecognition;

function getRecognitionCtor(): RecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isRecognitionSupported(): boolean {
  return getRecognitionCtor() !== null;
}

export function createRecognizer(callbacks: RecognitionCallbacks): {
  start: () => void;
  stop: () => void;
} | null {
  const Ctor = getRecognitionCtor();
  if (!Ctor) return null;

  const rec = new Ctor();
  rec.lang = "ja-JP";
  rec.interimResults = true;
  rec.continuous = true;

  rec.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) {
        callbacks.onFinal(result[0].transcript);
      } else {
        interim += result[0].transcript;
      }
    }
    if (interim) callbacks.onInterim(interim);
  };
  rec.onerror = (event) => {
    const messages: Record<string, string> = {
      "not-allowed": "마이크 권한이 거부되었습니다. 브라우저 설정에서 허용해 주세요.",
      "no-speech": "음성이 감지되지 않았습니다. 다시 말해 주세요.",
      "audio-capture": "마이크를 찾을 수 없습니다.",
      network: "음성 인식 서버에 연결하지 못했습니다.",
    };
    callbacks.onError(messages[event.error] ?? `음성 인식 오류: ${event.error}`);
  };
  rec.onend = () => callbacks.onEnd();

  return {
    start: () => rec.start(),
    stop: () => rec.stop(),
  };
}
