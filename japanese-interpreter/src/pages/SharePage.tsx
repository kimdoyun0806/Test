import { useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import type { Analysis } from "../types/analysis";
import { listVocab } from "../services/storage/vocabStore";
import { getCachedAnalysis } from "../services/storage/analysisCache";
import AnalyzedSentenceView from "../components/interpret/AnalyzedSentenceView";

interface ShareItem {
  source: string;
  analysis: Analysis;
}

/** 문장 카드를 이미지·텍스트로 내보내는 공유 페이지 */
export default function SharePage() {
  const [items, setItems] = useState<ShareItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    void (async () => {
      const vocab = await listVocab();
      const sources = [...new Set(vocab.filter((c) => c.type === "sentence").map((c) => c.sourceSentence))];
      const found: ShareItem[] = [];
      for (const source of sources) {
        const cached = await getCachedAnalysis(source);
        if (cached) found.push({ source, analysis: cached.analysis });
      }
      setItems(found);
      setLoaded(true);
    })();
  }, []);

  const showMessage = (m: string) => {
    setMessage(m);
    setTimeout(() => setMessage(null), 2500);
  };

  const shareText = (item: ShareItem) => {
    const a = item.analysis;
    return [
      a.sentence_jp,
      `발음: ${a.tokens.map((t) => t.hangul).join(" ")} (${a.tokens.map((t) => t.romaji).join(" ")})`,
      `번역: ${a.translation_ko}`,
      ...a.grammar_points.map((g) => `문법 ${g.pattern}: ${g.explanation_ko}`),
      "",
      "— 젠지(ZENJI)로 분석",
    ].join("\n");
  };

  const handleCopy = async (item: ShareItem) => {
    try {
      await navigator.clipboard.writeText(shareText(item));
      showMessage("텍스트를 복사했습니다. 스터디 단톡방에 붙여넣어 보세요!");
    } catch {
      showMessage("복사에 실패했습니다.");
    }
  };

  const handleImage = async (item: ShareItem) => {
    const node = cardRefs.current.get(item.source);
    if (!node) return;
    try {
      const dataUrl = await toPng(node, {
        backgroundColor: getComputedStyle(document.body).backgroundColor,
        pixelRatio: 2,
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `zenji-${item.source.slice(0, 12)}.png`;
      a.click();
      showMessage("이미지를 저장했습니다.");
    } catch {
      showMessage("이미지 생성에 실패했습니다.");
    }
  };

  const handleWebShare = async (item: ShareItem) => {
    if (!navigator.share) {
      showMessage("이 브라우저는 공유 기능을 지원하지 않습니다. 텍스트 복사를 이용해 주세요.");
      return;
    }
    try {
      await navigator.share({ title: "젠지 문장 분석", text: shareText(item) });
    } catch {
      // 사용자가 공유 시트를 닫은 경우 — 무시
    }
  };

  if (!loaded) return <p className="muted">불러오는 중…</p>;

  return (
    <div>
      <h2>📤 공유</h2>
      {items.length === 0 ? (
        <div className="empty-state">
          <p>공유할 문장이 없습니다.</p>
          <p className="muted">통역 화면에서 ⭐ 문장저장을 누르면 여기에 나타납니다.</p>
        </div>
      ) : (
        <>
          <p className="muted">
            저장한 문장을 이미지나 텍스트로 내보내 스터디원과 공유할 수 있어요.
          </p>
          {items.map((item) => (
            <div key={item.source} className="card">
              <div
                ref={(el) => {
                  if (el) cardRefs.current.set(item.source, el);
                  else cardRefs.current.delete(item.source);
                }}
                style={{ padding: 8 }}
              >
                <AnalyzedSentenceView analysis={item.analysis} showGrammar={false} />
                <p className="muted" style={{ margin: "4px 0 0", fontSize: 11, textAlign: "right" }}>
                  🎙️ 젠지 ZENJI
                </p>
              </div>
              <div className="card-actions">
                <button className="btn btn-sm" onClick={() => handleImage(item)}>
                  🖼️ 이미지 저장
                </button>
                <button className="btn btn-sm" onClick={() => handleCopy(item)}>
                  📋 텍스트 복사
                </button>
                <button className="btn btn-sm" onClick={() => handleWebShare(item)}>
                  📤 공유
                </button>
              </div>
            </div>
          ))}
        </>
      )}
      {message && (
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
            whiteSpace: "nowrap",
          }}
        >
          {message}
        </div>
      )}
    </div>
  );
}
