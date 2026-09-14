import { useState } from "react";
import type { Analysis } from "../../types/analysis";
import { useSpeechRecognition } from "../../hooks/useSpeechRecognition";
import { speakJapanese, hasJapaneseVoice } from "../../services/speech/tts";
import {
  scorePronunciation,
  gradeOf,
  normalizeForSimilarity,
  type ScoreGrade,
} from "../../services/similarity";

interface Props {
  analysis: Analysis;
  onClose: () => void;
}

const GRADE_TEXT: Record<ScoreGrade, { label: string; className: string }> = {
  great: { label: "훌륭해요! 🎉", className: "answer-correct" },
  good: { label: "좋아요, 한 번 더! 💪", className: "" },
  retry: { label: "다시 들어보고 천천히 따라해 보세요.", className: "answer-wrong" },
};

/** 간단한 문자 diff 표시: 목표와 인식 결과를 나란히, 다른 부분 강조 */
function CharDiff({ target, recognized }: { target: string; recognized: string }) {
  const t = normalizeForSimilarity(target);
  const r = normalizeForSimilarity(recognized);
  return (
    <div className="muted" style={{ marginTop: 8 }}>
      <div>
        목표: {[...t].map((ch, i) => (
          <span key={i} className={r[i] === ch ? "" : "diff-ins"}>{ch}</span>
        ))}
      </div>
      <div>
        내 발음: {[...r].map((ch, i) => (
          <span key={i} className={t[i] === ch ? "" : "diff-del"}>{ch}</span>
        ))}
      </div>
    </div>
  );
}

export default function PronunciationPractice({ analysis, onClose }: Props) {
  const [result, setResult] = useState<{ recognized: string; score: number } | null>(null);

  const targetKana = analysis.tokens.map((t) => t.reading_kana).join("");
  const speech = useSpeechRecognition((text) => {
    const score = scorePronunciation(text, analysis.sentence_jp, targetKana);
    setResult({ recognized: text, score });
    speech.stop();
  });

  const grade = result ? gradeOf(result.score) : null;

  return (
    <div className="grammar-section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong>🎤 발음 연습</strong>
        <button className="btn btn-sm" onClick={onClose}>닫기</button>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <button
          className="btn btn-sm"
          disabled={!hasJapaneseVoice()}
          onClick={() => speakJapanese(analysis.sentence_jp)}
        >
          🔊 원어민 듣기
        </button>
        <button
          className="btn btn-sm"
          disabled={!hasJapaneseVoice()}
          onClick={() => speakJapanese(analysis.sentence_jp, 0.7)}
        >
          🐢 천천히 듣기
        </button>
        {speech.supported ? (
          <button
            className={`btn btn-sm${speech.listening ? " btn-primary" : ""}`}
            onClick={() => {
              setResult(null);
              speech.toggle();
            }}
          >
            {speech.listening ? "⏹ 말하는 중… (탭하여 종료)" : "🎙️ 따라 말하기"}
          </button>
        ) : (
          <span className="muted">이 브라우저는 음성 인식을 지원하지 않습니다 (Chrome 권장).</span>
        )}
      </div>
      {speech.interim && <p className="interim-text">{speech.interim}</p>}
      {speech.error && <p className="error-box" style={{ marginTop: 8 }}>{speech.error}</p>}
      {result && grade && (
        <div style={{ marginTop: 10 }}>
          <strong className={GRADE_TEXT[grade].className}>
            일치도 {Math.round(result.score * 100)}% — {GRADE_TEXT[grade].label}
          </strong>
          <CharDiff target={analysis.sentence_jp} recognized={result.recognized} />
        </div>
      )}
    </div>
  );
}
