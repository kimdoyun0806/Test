import { useCallback, useEffect, useRef, useState } from "react";
import { createRecognizer, isRecognitionSupported } from "../services/speech/recognition";

export interface SpeechState {
  supported: boolean;
  listening: boolean;
  interim: string;
  error: string | null;
}

/**
 * 마이크 토글 훅. 최종 인식 결과는 onFinal 콜백으로 전달된다.
 */
export function useSpeechRecognition(onFinal: (text: string) => void) {
  const [state, setState] = useState<SpeechState>({
    supported: isRecognitionSupported(),
    listening: false,
    interim: "",
    error: null,
  });
  const recognizerRef = useRef<{ start: () => void; stop: () => void } | null>(null);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  const stop = useCallback(() => {
    recognizerRef.current?.stop();
    recognizerRef.current = null;
    setState((s) => ({ ...s, listening: false, interim: "" }));
  }, []);

  const start = useCallback(() => {
    if (!isRecognitionSupported() || recognizerRef.current) return;
    setState((s) => ({ ...s, error: null }));
    const recognizer = createRecognizer({
      onInterim: (text) => setState((s) => ({ ...s, interim: text })),
      onFinal: (text) => {
        setState((s) => ({ ...s, interim: "" }));
        onFinalRef.current(text);
      },
      onError: (message) => setState((s) => ({ ...s, error: message })),
      onEnd: () => {
        recognizerRef.current = null;
        setState((s) => ({ ...s, listening: false, interim: "" }));
      },
    });
    if (!recognizer) return;
    recognizerRef.current = recognizer;
    recognizer.start();
    setState((s) => ({ ...s, listening: true }));
  }, []);

  const toggle = useCallback(() => {
    if (recognizerRef.current) stop();
    else start();
  }, [start, stop]);

  useEffect(() => () => recognizerRef.current?.stop(), []);

  return { ...state, start, stop, toggle };
}
