import { useCallback, useEffect, useState } from "react";
import type { Analysis } from "../types/analysis";
import type { VocabCard } from "../services/storage/db";
import {
  deleteVocab,
  exportVocab,
  importVocab,
  listVocab,
  listDueVocab,
  type ExportData,
} from "../services/storage/vocabStore";
import { getCachedAnalysis } from "../services/storage/analysisCache";
import { speakJapanese, hasJapaneseVoice } from "../services/speech/tts";
import AnalyzedSentenceView from "../components/interpret/AnalyzedSentenceView";

interface Props {
  onStartReview: () => void;
}

type Filter = "all" | "word" | "sentence";

/** 저장된 문장(세그먼트 카드 묶음) 그룹 */
interface SentenceGroup {
  source: string;
  cards: VocabCard[];
  analysis?: Analysis;
}

export default function NotebookPage({ onStartReview }: Props) {
  const [words, setWords] = useState<VocabCard[]>([]);
  const [groups, setGroups] = useState<SentenceGroup[]>([]);
  const [dueCount, setDueCount] = useState(0);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);

  const handleExport = async () => {
    const data = await exportVocab();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zenji-vocab-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as ExportData;
      if (data.version !== 1 || !Array.isArray(data.vocab)) throw new Error("형식 오류");
      const added = await importVocab(data);
      setBackupMessage(`어휘장 항목 ${added}개를 가져왔습니다.`);
      void reload();
    } catch {
      setBackupMessage("가져오기에 실패했습니다. 이 앱에서 내보낸 JSON 파일인지 확인해 주세요.");
    }
  };

  const reload = useCallback(async () => {
    const all = await listVocab();
    setWords(all.filter((c) => c.type === "word"));

    const sentenceCards = all.filter((c) => c.type === "sentence");
    const bySource = new Map<string, VocabCard[]>();
    for (const c of sentenceCards) {
      const list = bySource.get(c.sourceSentence) ?? [];
      list.push(c);
      bySource.set(c.sourceSentence, list);
    }
    const groupList: SentenceGroup[] = [];
    for (const [source, cards] of bySource) {
      const cached = await getCachedAnalysis(source);
      groupList.push({ source, cards, analysis: cached?.analysis });
    }
    groupList.sort(
      (a, b) => Math.max(...b.cards.map((c) => c.createdAt)) - Math.max(...a.cards.map((c) => c.createdAt)),
    );
    setGroups(groupList);
    setDueCount((await listDueVocab()).length);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const matchesSearch = (text: string) => !search || text.includes(search);

  const visibleWords =
    filter === "sentence"
      ? []
      : words.filter((c) => matchesSearch(c.front) || matchesSearch(c.meaningKo));
  const visibleGroups =
    filter === "word"
      ? []
      : groups.filter(
          (g) => matchesSearch(g.source) || g.cards.some((c) => matchesSearch(c.meaningKo)),
        );

  const isEmpty = visibleWords.length === 0 && visibleGroups.length === 0;

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

      {isEmpty && (
        <div className="empty-state">
          <p>저장된 항목이 없습니다.</p>
          <p className="muted">통역 화면에서 단어를 탭하거나 ⭐ 문장저장을 눌러 보세요.</p>
        </div>
      )}

      {visibleGroups.map((group) => (
        <div key={group.source} className="card">
          {group.analysis ? (
            <>
              {expanded === group.source ? (
                <AnalyzedSentenceView analysis={group.analysis} showGrammar={true} />
              ) : (
                <>
                  <p style={{ margin: "0 0 4px", fontSize: "1.1rem" }}>{group.source}</p>
                  <p className="muted" style={{ margin: 0 }}>
                    {group.analysis.translation_ko}
                  </p>
                </>
              )}
            </>
          ) : (
            <>
              <p style={{ margin: "0 0 4px", fontSize: "1.1rem" }}>{group.source}</p>
              <p className="muted" style={{ margin: 0 }}>
                {group.cards.map((c) => c.meaningKo).join(" ")}
              </p>
            </>
          )}
          <div className="card-actions">
            {group.analysis && (
              <button
                className="btn btn-sm"
                onClick={() => setExpanded(expanded === group.source ? null : group.source)}
              >
                {expanded === group.source ? "접기" : "🎨 분석 보기"}
              </button>
            )}
            <button
              className="btn btn-sm"
              disabled={!hasJapaneseVoice()}
              onClick={() => speakJapanese(group.source)}
            >
              🔊
            </button>
            <span className="muted" style={{ alignSelf: "center" }}>
              복습 카드 {group.cards.length}개
            </span>
            <button
              className="btn btn-sm"
              style={{ marginLeft: "auto" }}
              onClick={async () => {
                for (const c of group.cards) await deleteVocab(c.id);
                void reload();
              }}
            >
              🗑️
            </button>
          </div>
        </div>
      ))}

      {visibleWords.map((card) => (
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
                단어 · 다음 복습: {new Date(card.srs.dueAt).toLocaleDateString("ko-KR")}
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

      <div className="card">
        <h3 style={{ marginTop: 0 }}>백업</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          어휘장은 이 브라우저에 저장됩니다. 다른 기기로 옮기거나 백업하려면 내보내기를
          사용하세요.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-sm" onClick={handleExport}>
            📤 내보내기 (JSON)
          </button>
          <label className="btn btn-sm" style={{ display: "inline-block" }}>
            📥 가져오기
            <input
              type="file"
              accept="application/json"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleImport(file);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        {backupMessage && <p className="muted">{backupMessage}</p>}
      </div>
    </div>
  );
}
