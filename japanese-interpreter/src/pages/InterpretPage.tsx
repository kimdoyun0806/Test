import { useCallback, useState } from "react";
import type { AppSettings } from "../services/storage/settings";
import { useAnalysis } from "../hooks/useAnalysis";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import { containsJapanese, splitSentences } from "../services/sentenceSplit";
import { MOCK_EXAMPLE_SENTENCE } from "../api/mockClient";
import SentenceCard from "../components/interpret/SentenceCard";
import { MicIcon, StopIcon } from "../components/common/Icons";

interface Props {
  settings: AppSettings;
}

const HANGUL_RE = /[가-힯]/;

export default function InterpretPage({ settings }: Props) {
  const { cards, analyze, analyzeKorean, removeCard } = useAnalysis(settings);
  const [text, setText] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2500);
  }, []);

  const analyzeText = useCallback(
    (input: string) => {
      for (const sentence of splitSentences(input)) analyze(sentence);
    },
    [analyze],
  );

  // 마이크 결과 필터: 일본어가 아니거나 확신도가 낮으면 분석하지 않는다 (API 낭비 방지)
  const speech = useSpeechRecognition((finalText, confidence) => {
    if (!containsJapanese(finalText)) {
      showToast(`일본어로 인식되지 않아 건너뛰었어요: "${finalText.slice(0, 20)}"`);
      return;
    }
    if (confidence < 0.5) {
      showToast("인식이 불확실해 건너뛰었어요. 또박또박 다시 말해 주세요.");
      return;
    }
    analyzeText(finalText);
  });

  const handleSubmit = () => {
    const input = text.trim();
    if (!input) return;
    if (containsJapanese(input)) {
      analyzeText(input);
    } else if (HANGUL_RE.test(input)) {
      // 한국어 입력 → 일본어로 번역 후 동일한 분석 카드 생성
      analyzeKorean(input);
    } else {
      showToast("일본어 또는 한국어 문장을 입력해 주세요.");
      return;
    }
    setText("");
  };

  return (
    <div>
      {!speech.supported && (
        <div className="notice">
          이 브라우저는 음성 인식을 지원하지 않습니다 (Chrome/Edge 권장). 아래 텍스트 입력을
          이용해 주세요.
        </div>
      )}
      {settings.mockMode && (
        <div className="notice">
          목(체험) 모드입니다. 예시 문장 외에는 자리표시 분석이 표시됩니다. 실제 분석은
          설정에서 API 키를 입력하고 목 모드를 꺼 주세요.
        </div>
      )}

      {speech.supported && (
        <>
          <button
            className={`mic-button${speech.listening ? " listening" : ""}`}
            onClick={speech.toggle}
            title={speech.listening ? "탭하여 종료" : "탭하여 일본어로 말하기"}
            aria-label={speech.listening ? "음성 인식 종료" : "음성 인식 시작"}
          >
            {speech.listening ? <StopIcon size={28} /> : <MicIcon size={30} />}
          </button>
          <p className="interim-text" style={{ textAlign: "center" }}>
            {speech.listening ? speech.interim || "일본어로 말해 주세요…" : ""}
          </p>
          {speech.error && <div className="error-box" style={{ marginBottom: 12 }}>{speech.error}</div>}
        </>
      )}

      <div className="transcript-bar">
        <textarea
          placeholder="일본어 또는 한국어 문장 입력 — 한국어를 쓰면 일본어로 번역해 분석해요"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />
        <button className="btn btn-primary" onClick={handleSubmit} disabled={!text.trim()}>
          분석
        </button>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        <button
          className="btn btn-sm"
          onClick={() => analyzeText(MOCK_EXAMPLE_SENTENCE)}
        >
          ✨ 예시 문장 분석해 보기
        </button>
      </p>

      {cards.length === 0 && (
        <div className="empty-state">
          <p>🎙️ 마이크 버튼을 누르고 일본어로 말하거나,</p>
          <p>텍스트로 일본어 문장을 입력하면 분석 카드가 생성됩니다.</p>
        </div>
      )}
      {cards.map((card) => (
        <SentenceCard
          key={card.id}
          card={card}
          showRomaji={settings.showRomaji}
          showHangul={settings.showHangul}
          onRemove={() => removeCard(card.id)}
          onToast={showToast}
        />
      ))}

      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 76,
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--color-text)",
            color: "var(--color-bg)",
            padding: "8px 16px",
            borderRadius: 8,
            fontSize: 14,
            zIndex: 30,
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
