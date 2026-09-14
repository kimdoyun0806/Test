import { useState } from "react";
import InterpretPage from "./pages/InterpretPage";
import NotebookPage from "./pages/NotebookPage";
import ReviewPage from "./pages/ReviewPage";
import SharePage from "./pages/SharePage";
import { loadSettings } from "./services/storage/settings";
import { MicIcon, BookIcon, RepeatIcon, ShareIcon } from "./components/common/Icons";
import type { ReactNode } from "react";

type Tab = "interpret" | "notebook" | "review" | "share";

const TABS: { id: Tab; icon: ReactNode; label: string }[] = [
  { id: "interpret", icon: <MicIcon />, label: "통역" },
  { id: "notebook", icon: <BookIcon />, label: "어휘장" },
  { id: "review", icon: <RepeatIcon />, label: "복습" },
  { id: "share", icon: <ShareIcon />, label: "공유" },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("interpret");
  const [settings] = useState(loadSettings);

  return (
    <>
      <header className="app-header">
        <span className="app-logo">젠지</span>
        <span className="app-tagline">全字 · 모든 글자를 내 것으로</span>
      </header>
      <main className="app-main">
        {/* 통역 화면은 항상 마운트 유지 — 탭 이동 중에도 분석이 계속되고 카드가 보존됨 */}
        <div style={{ display: tab === "interpret" ? "block" : "none" }}>
          <InterpretPage settings={settings} active={tab === "interpret"} />
        </div>
        {tab === "notebook" && <NotebookPage onStartReview={() => setTab("review")} />}
        {tab === "review" && <ReviewPage />}
        {tab === "share" && <SharePage />}
      </main>
      <nav className="tab-bar">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? "active" : ""}
            onClick={() => setTab(t.id)}
          >
            <span className="tab-icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </>
  );
}
