import { useState } from "react";
import type { FillBlankQuestion } from "../../services/quiz";

interface Props {
  question: FillBlankQuestion;
  onAnswer: (correct: boolean) => void;
}

export default function FillBlankQuiz({ question, onAnswer }: Props) {
  const [picked, setPicked] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const answered = picked !== null;
  const correct = picked === question.answer;

  const submit = (value: string) => {
    if (answered) return;
    setPicked(value);
    onAnswer(value === question.answer);
  };

  return (
    <div className="card">
      <p className="muted" style={{ marginTop: 0 }}>빈칸에 들어갈 말은?</p>
      <p style={{ fontSize: "1.3rem" }}>{question.blanked}</p>
      <p className="muted">💡 {question.translationKo}</p>

      {question.choices.length > 0 ? (
        <div className="quiz-choices">
          {question.choices.map((choice) => (
            <button
              key={choice}
              className={`btn${
                answered
                  ? choice === question.answer
                    ? " answer-correct"
                    : choice === picked
                      ? " answer-wrong"
                      : ""
                  : ""
              }`}
              disabled={answered}
              onClick={() => submit(choice)}
            >
              {choice}
            </button>
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            value={typed}
            placeholder="답 입력"
            onChange={(e) => setTyped(e.target.value)}
            disabled={answered}
            style={{ flex: 1 }}
          />
          <button
            className="btn btn-primary"
            disabled={answered || !typed.trim()}
            onClick={() => submit(typed.trim())}
          >
            확인
          </button>
        </div>
      )}

      {answered && (
        <p className={correct ? "answer-correct" : "answer-wrong"}>
          {correct ? "정답! 🎉" : `오답 — 정답은 "${question.answer}"`}
        </p>
      )}
    </div>
  );
}
