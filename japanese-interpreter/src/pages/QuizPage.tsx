import { useCallback, useEffect, useState } from "react";
import type { Analysis } from "../types/analysis";
import type { VocabCard } from "../services/storage/db";
import { listVocab } from "../services/storage/vocabStore";
import { getCachedAnalysis } from "../services/storage/analysisCache";
import { buildQuiz, type QuizKind, type QuizQuestion } from "../services/quiz";
import FillBlankQuiz from "../components/quiz/FillBlankQuiz";
import WordOrderQuiz from "../components/quiz/WordOrderQuiz";
import DictationQuiz from "../components/quiz/DictationQuiz";

const KIND_LABELS: { id: QuizKind; label: string; desc: string }[] = [
  { id: "fill-blank", label: "빈칸 채우기", desc: "문장 속 단어를 고르세요" },
  { id: "word-order", label: "단어 배열", desc: "셔플된 단어로 문장 완성" },
  { id: "dictation", label: "듣기 받아쓰기", desc: "듣고 입력 (TTS 필요)" },
];

interface SessionState {
  questions: QuizQuestion[];
  index: number;
  correct: number;
  /** 오답 문항 — 세션 말미 복기용 */
  wrong: QuizQuestion[];
  /** 전체 세션 누적 (결과 화면용) */
  totalAnswered: number;
  totalCorrect: number;
  showResult: boolean;
}

export default function QuizPage() {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [wordPool, setWordPool] = useState<VocabCard[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [session, setSession] = useState<SessionState | null>(null);
  const [count, setCount] = useState(5);

  useEffect(() => {
    void (async () => {
      const vocab = await listVocab();
      setWordPool(vocab.filter((c) => c.type === "word"));
      const sentences = vocab.filter((c) => c.type === "sentence");
      const found: Analysis[] = [];
      for (const s of sentences) {
        const cached = await getCachedAnalysis(s.sourceSentence);
        if (cached) found.push(cached.analysis);
      }
      setAnalyses(found);
      setLoaded(true);
    })();
  }, []);

  const start = useCallback(
    (kind: QuizKind) => {
      const questions = buildQuiz(kind, analyses, wordPool, count);
      if (questions.length === 0) return;
      setSession({
        questions,
        index: 0,
        correct: 0,
        wrong: [],
        totalAnswered: 0,
        totalCorrect: 0,
        showResult: false,
      });
    },
    [analyses, wordPool, count],
  );

  const handleAnswer = (correct: boolean) => {
    setSession((s) => {
      if (!s) return s;
      const q = s.questions[s.index];
      return {
        ...s,
        correct: s.correct + (correct ? 1 : 0),
        wrong: correct ? s.wrong : [...s.wrong, q],
        totalAnswered: s.totalAnswered + 1,
        totalCorrect: s.totalCorrect + (correct ? 1 : 0),
      };
    });
  };

  const next = () => {
    setSession((s) => {
      if (!s) return s;
      if (s.index + 1 < s.questions.length) return { ...s, index: s.index + 1 };
      // 오답 복기: 남은 오답이 있으면 재출제
      if (s.wrong.length > 0) {
        return { ...s, questions: s.wrong, index: 0, correct: 0, wrong: [] };
      }
      return { ...s, showResult: true };
    });
  };

  if (!loaded) return <p className="muted">불러오는 중…</p>;

  if (!session) {
    return (
      <div>
        <h2>✏️ 퀴즈</h2>
        {analyses.length === 0 ? (
          <div className="empty-state">
            <p>퀴즈를 만들 문장이 없습니다.</p>
            <p className="muted">
              통역 화면에서 ⭐ 문장저장을 누르면 그 문장으로 퀴즈가 생성됩니다.
            </p>
          </div>
        ) : (
          <>
            <p className="muted">저장 문장 {analyses.length}개로 퀴즈를 만듭니다.</p>
            <div className="settings-row">
              <label>문항 수</label>
              <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
                <option value={5}>5문항</option>
                <option value={10}>10문항</option>
              </select>
            </div>
            {KIND_LABELS.map((k) => (
              <div key={k.id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong>{k.label}</strong>
                  <br />
                  <span className="muted">{k.desc}</span>
                </div>
                <button className="btn btn-primary" onClick={() => start(k.id)}>
                  시작
                </button>
              </div>
            ))}
          </>
        )}
      </div>
    );
  }

  if (session.showResult) {
    return (
      <div>
        <h2>✏️ 퀴즈</h2>
        <div className="empty-state">
          <p>🎉 퀴즈 완료!</p>
          <p className="muted">
            총 {session.totalAnswered}문항 풀이 · 정답{" "}
            {session.totalCorrect}개 (
            {Math.round((session.totalCorrect / Math.max(1, session.totalAnswered)) * 100)}%)
          </p>
          <button className="btn btn-primary" onClick={() => setSession(null)}>
            다른 퀴즈 풀기
          </button>
        </div>
      </div>
    );
  }

  const q = session.questions[session.index];
  const isLast = session.index + 1 >= session.questions.length;
  const finished = isLast && session.wrong.length === 0;

  return (
    <div>
      <h2>✏️ 퀴즈</h2>
      <p className="muted">
        {session.index + 1} / {session.questions.length} · 정답 {session.correct}
      </p>

      {q.kind === "fill-blank" && (
        <FillBlankQuiz key={session.index} question={q} onAnswer={handleAnswer} />
      )}
      {q.kind === "word-order" && (
        <WordOrderQuiz key={session.index} question={q} onAnswer={handleAnswer} />
      )}
      {q.kind === "dictation" && (
        <DictationQuiz key={session.index} question={q} onAnswer={handleAnswer} />
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn" onClick={() => setSession(null)}>
          그만하기
        </button>
        <button className="btn btn-primary" onClick={next}>
          {finished ? "결과 보기" : isLast ? "오답 복기" : "다음 →"}
        </button>
      </div>
    </div>
  );
}
