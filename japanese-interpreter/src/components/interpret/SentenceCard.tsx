import { useEffect, useState } from "react";
import type { SentenceCardData } from "../../hooks/useAnalysis";
import type { AnalysisToken } from "../../types/analysis";
import AnalyzedSentenceView from "./AnalyzedSentenceView";
import PronunciationPractice from "../practice/PronunciationPractice";
import { speakJapanese, hasJapaneseVoice } from "../../services/speech/tts";
import { saveWord, saveSentence } from "../../services/storage/vocabStore";

interface Props {
  card: SentenceCardData;
  showRomaji: boolean;
  showHangul: boolean;
  onRemove: () => void;
  onToast: (message: string) => void;
}

/** 분석 중 카드 — 경과 시간을 표시해 대기 체감을 줄인다 */
function LoadingCard({ sentence, translating }: { sentence: string; translating: boolean }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="card">
      <p className="muted" style={{ margin: 0 }}>
        「{sentence}」 {translating ? "일본어로 번역 후 분석" : "분석"} 중… {elapsed}초
      </p>
      <p className="muted" style={{ margin: "4px 0 0", fontSize: 12 }}>
        문장 길이에 따라 보통 3~15초 걸립니다. 같은 문장은 다음부터 즉시 표시돼요.
      </p>
    </div>
  );
}

export default function SentenceCard({
  card,
  showRomaji,
  showHangul,
  onRemove,
  onToast,
}: Props) {
  const [selectedToken, setSelectedToken] = useState<AnalysisToken | null>(null);
  const [practicing, setPracticing] = useState(false);

  if (card.status === "loading") {
    return <LoadingCard sentence={card.sentence} translating={!!card.sourceKo} />;
  }

  if (card.status === "error" || !card.analysis) {
    return (
      <div className="card">
        <p style={{ margin: "0 0 8px" }}>{card.sentence}</p>
        <div className="error-box">{card.errorMessage ?? "분석에 실패했습니다."}</div>
        <div className="card-actions">
          <button className="btn btn-sm" onClick={onRemove}>닫기</button>
        </div>
      </div>
    );
  }

  const { analysis } = card;
  const colorEnabled = !card.degraded;

  const handleSaveWord = async (token: AnalysisToken) => {
    const added = await saveWord(token, analysis.sentence_jp, analysis.translation_ko);
    onToast(added ? `"${token.surface}" 단어를 어휘장에 저장했습니다.` : "이미 저장된 단어입니다.");
    setSelectedToken(null);
  };

  const handleSaveSentence = async () => {
    const added = await saveSentence(analysis);
    onToast(
      added > 0
        ? `문장을 저장했습니다. 복습 카드 ${added}개가 만들어졌어요.`
        : "이미 저장된 문장입니다.",
    );
  };

  return (
    <div className="card">
      {card.sourceKo && (
        <p className="muted" style={{ marginTop: 0 }}>
          🇰🇷 입력: {card.sourceKo}
        </p>
      )}
      {card.degraded && (
        <p className="muted" style={{ marginTop: 0 }}>
          ⚠️ 구간 매핑 검증에 실패해 색상 없이 표시합니다.
        </p>
      )}

      <AnalyzedSentenceView
        analysis={analysis}
        colorEnabled={colorEnabled}
        showRomaji={showRomaji}
        showHangul={showHangul}
        onTokenClick={setSelectedToken}
      />

      {practicing && (
        <PronunciationPractice analysis={analysis} onClose={() => setPracticing(false)} />
      )}

      <div className="card-actions">
        <button
          className="btn btn-sm"
          disabled={!hasJapaneseVoice()}
          title={hasJapaneseVoice() ? "" : "일본어 TTS 보이스가 없습니다"}
          onClick={() => speakJapanese(analysis.sentence_jp)}
        >
          🔊 듣기
        </button>
        <button className="btn btn-sm" onClick={() => setPracticing((p) => !p)}>
          🎤 발음연습
        </button>
        <button className="btn btn-sm" onClick={handleSaveSentence}>
          ⭐ 문장저장
        </button>
        <button className="btn btn-sm" onClick={onRemove} style={{ marginLeft: "auto" }}>
          ✕
        </button>
      </div>

      {selectedToken && (
        <div className="sheet-backdrop" onClick={() => setSelectedToken(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h3 className="word-title">{selectedToken.surface}</h3>
            <p style={{ margin: "0 0 4px" }}>
              {selectedToken.reading_kana} · {selectedToken.romaji} · {selectedToken.hangul}
            </p>
            <p style={{ marginTop: 0, fontSize: "1.05rem" }}>
              {selectedToken.meaning_ko ?? "(뜻 정보 없음 — 문장을 다시 분석하면 표시됩니다)"}
              {selectedToken.level && (
                <span className="muted"> · {selectedToken.level}</span>
              )}
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="btn btn-sm"
                disabled={!hasJapaneseVoice()}
                onClick={() => speakJapanese(selectedToken.surface)}
              >
                🔊 듣기
              </button>
              <button className="btn btn-sm btn-primary" onClick={() => handleSaveWord(selectedToken)}>
                ⭐ 어휘장에 저장
              </button>
              <button className="btn btn-sm" onClick={() => setSelectedToken(null)}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
