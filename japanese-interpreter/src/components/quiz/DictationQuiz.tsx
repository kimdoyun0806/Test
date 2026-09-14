import { useState } from "react";
import type { DictationQuestion } from "../../services/quiz";
import { speakJapanese, hasJapaneseVoice } from "../../services/speech/tts";
import { similarity } from "../../services/similarity";

interface Props {
  question: DictationQuestion;
  onAnswer: (correct: boolean) => void;
}

export default function DictationQuiz({ question, onAnswer }: Props) {
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState<{ score: number; correct: boolean } | null>(null);

  const submit = () => {
    if (result) return;
    // 표기 또는 가나 읽기 어느 쪽으로 입력해도 인정
    const score = Math.max(
      similarity(typed, question.sentence),
      similarity(typed, question.readingKana),
    );
    const correct = score >= 0.8;
    setResult({ score, correct });
    onAnswer(correct);
  };

  return (
    <div className="card">
      <p className="muted" style={{ marginTop: 0 }}>문장을 듣고 받아쓰세요 (한자 또는 가나)</p>
      <button
        className="btn"
        disabled={!hasJapaneseVoice()}
        onClick={() => speakJapanese(question.sentence)}
      >
        🔊 문장 듣기
      </button>
      {!hasJapaneseVoice() && (
        <p className="muted">일본어 TTS 보이스가 없어 이 퀴즈를 진행할 수 없습니다.</p>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input
          type="text"
          value={typed}
          placeholder="들린 대로 입력"
          onChange={(e) => setTyped(e.target.value)}
          disabled={result !== null}
          style={{ flex: 1 }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <button className="btn btn-primary" disabled={result !== null || !typed.trim()} onClick={submit}>
          확인
        </button>
      </div>

      {result && (
        <div style={{ marginTop: 8 }}>
          <p className={result.correct ? "answer-correct" : "answer-wrong"}>
            일치도 {Math.round(result.score * 100)}% — {result.correct ? "정답! 🎉" : "오답"}
          </p>
          <p className="muted">
            정답: {question.sentence}
            <br />뜻: {question.translationKo}
          </p>
        </div>
      )}
    </div>
  );
}
