import { useState } from "react";
import { useSrsQueue } from "../hooks/useSrsQueue";
import { speakJapanese, hasJapaneseVoice } from "../services/speech/tts";
import type { SrsQuality } from "../services/srs";

export default function ReviewPage() {
  const { current, queue, loading, grade, reload, reviewedCount, correctCount } = useSrsQueue();
  const [revealed, setRevealed] = useState(false);

  if (loading) return <p className="muted">불러오는 중…</p>;

  if (!current) {
    return (
      <div>
        <h2>🔁 복습</h2>
        <div className="empty-state">
          {reviewedCount > 0 ? (
            <>
              <p>🎉 오늘 복습 완료!</p>
              <p className="muted">
                {reviewedCount}개 복습 · 정답률{" "}
                {Math.round((correctCount / reviewedCount) * 100)}%
              </p>
            </>
          ) : (
            <>
              <p>오늘 복습할 카드가 없습니다.</p>
              <p className="muted">통역 화면에서 단어/문장을 저장하면 복습 카드가 생깁니다.</p>
            </>
          )}
          <button className="btn" onClick={() => void reload()}>새로고침</button>
        </div>
      </div>
    );
  }

  const handleGrade = async (q: SrsQuality) => {
    setRevealed(false);
    await grade(q);
  };

  return (
    <div>
      <h2>🔁 복습</h2>
      <p className="muted">남은 카드: {queue.length}개</p>

      <div className="card flashcard">
        <div className="front-text">{current.front}</div>
        <button
          className="btn btn-sm"
          disabled={!hasJapaneseVoice()}
          onClick={() => speakJapanese(current.front)}
        >
          🔊 듣기
        </button>

        {!revealed ? (
          <div style={{ marginTop: 20 }}>
            <button className="btn btn-primary" onClick={() => setRevealed(true)}>
              정답 보기
            </button>
          </div>
        ) : (
          <>
            <div className="back-info">
              <p style={{ margin: "4px 0" }}>
                {current.readingKana} · {current.readingHangul}
              </p>
              <p className="muted" style={{ margin: "4px 0" }}>{current.romaji}</p>
              <p style={{ fontSize: "1.1rem", margin: "8px 0" }}>{current.meaningKo}</p>
            </div>
            <div className="grade-buttons">
              <button className="btn grade-again" onClick={() => handleGrade(1)}>다시</button>
              <button className="btn grade-hard" onClick={() => handleGrade(3)}>어려움</button>
              <button className="btn" onClick={() => handleGrade(4)}>보통</button>
              <button className="btn grade-easy" onClick={() => handleGrade(5)}>쉬움</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
