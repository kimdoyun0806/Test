import { useState } from "react";
import type { WordOrderQuestion } from "../../services/quiz";

interface Props {
  question: WordOrderQuestion;
  onAnswer: (correct: boolean) => void;
}

export default function WordOrderQuiz({ question, onAnswer }: Props) {
  const [pickedIds, setPickedIds] = useState<number[]>([]);
  const [done, setDone] = useState(false);
  const [correct, setCorrect] = useState(false);

  const pick = (id: number) => {
    if (done || pickedIds.includes(id)) return;
    const next = [...pickedIds, id];
    setPickedIds(next);
    if (next.length === question.shuffledTokens.length) {
      const built = next
        .map((tid) => question.shuffledTokens.find((t) => t.id === tid)!.surface)
        .join("");
      const isCorrect = built === question.answerTokens.join("");
      setCorrect(isCorrect);
      setDone(true);
      onAnswer(isCorrect);
    }
  };

  const undo = () => {
    if (done) return;
    setPickedIds((prev) => prev.slice(0, -1));
  };

  const pickedText = pickedIds
    .map((tid) => question.shuffledTokens.find((t) => t.id === tid)!.surface)
    .join("");

  return (
    <div className="card">
      <p className="muted" style={{ marginTop: 0 }}>단어를 순서대로 탭해 문장을 완성하세요</p>
      <p className="muted">💡 {question.translationKo}</p>

      <div className="word-chips">
        {pickedText || <span className="muted">여기에 문장이 만들어집니다</span>}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {question.shuffledTokens.map((t) => (
          <button
            key={t.id}
            className="word-chip"
            disabled={done || pickedIds.includes(t.id)}
            onClick={() => pick(t.id)}
          >
            {t.surface}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <button className="btn btn-sm" disabled={done || pickedIds.length === 0} onClick={undo}>
          ↩ 하나 지우기
        </button>
      </div>

      {done && (
        <p className={correct ? "answer-correct" : "answer-wrong"}>
          {correct ? "정답! 🎉" : `오답 — 정답: ${question.sentence}`}
        </p>
      )}
    </div>
  );
}
