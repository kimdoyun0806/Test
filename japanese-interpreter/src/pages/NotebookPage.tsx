import { useCallback, useEffect, useState } from "react";
import type { VocabCard } from "../services/storage/db";
import { deleteVocab, listVocab, listDueVocab } from "../services/storage/vocabStore";
import { speakJapanese, hasJapaneseVoice } from "../services/speech/tts";

interface Props {
  onStartReview: () => void;
}

type Filter = "all" | "word" | "sentence";

export default function NotebookPage({ onStartReview }: Props) {
  const [cards, setCards] = useState<VocabCard[]>([]);
  const [dueCount, setDueCount] = useState(0);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  const reload = useCallback(async () => {
    setCards(await listVocab());
    setDueCount((await listDueVocab()).length);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filtered = cards.filter((c) => {
    if (filter !== "all" && c.type !== filter) return false;
    if (search && !c.front.includes(search) && !c.meaningKo.includes(search)) return false;
    return true;
  });

  return (
    <div>
      <h2>📒 어휘장</h2>

      {dueCount > 0 && (
        <button className="btn btn-primary" style={{ width: "100%", marginBottom: 12 }} onClick={onStartReview}>
          🔁 복습 시작 — 오늘 {dueCount}개
        </button>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          type="text"
          placeholder="검색 (일본어/뜻)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1 }}
        />
        <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
          <option value="all">전체</option>
          <option value="word">단어</option>
          <option value="sentence">문장</option>
        </select>
      </div>

      {filtered.length === 0 && (
        <div className="empty-state">
          <p>저장된 항목이 없습니다.</p>
          <p className="muted">통역 화면에서 단어를 탭하거나 ⭐ 문장저장을 눌러 보세요.</p>
        </div>
      )}

      {filtered.map((card) => (
        <div key={card.id} className="card">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <div>
              <strong style={{ fontSize: "1.1rem" }}>{card.front}</strong>{" "}
              <span className="muted">
                {card.readingKana}
                {card.level ? ` · ${card.level}` : ""}
              </span>
              <br />
              <span>{card.meaningKo}</span>
              <br />
              <span className="muted">
                {card.type === "word" ? "단어" : "문장"} · 다음 복습:{" "}
                {new Date(card.srs.dueAt).toLocaleDateString("ko-KR")}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <button
                className="btn btn-sm"
                disabled={!hasJapaneseVoice()}
                onClick={() => speakJapanese(card.front)}
              >
                🔊
              </button>
              <button
                className="btn btn-sm"
                onClick={async () => {
                  await deleteVocab(card.id);
                  void reload();
                }}
              >
                🗑️
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
