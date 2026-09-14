import { useState } from "react";
import InterpretPage from "./pages/InterpretPage";
import NotebookPage from "./pages/NotebookPage";
import ReviewPage from "./pages/ReviewPage";
import QuizPage from "./pages/QuizPage";
import SettingsPage from "./pages/SettingsPage";
import { loadSettings, saveSettings, type AppSettings } from "./services/storage/settings";

type Tab = "interpret" | "notebook" | "review" | "quiz" | "settings";

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: "interpret", icon: "🎙️", label: "통역" },
  { id: "notebook", icon: "📒", label: "어휘장" },
  { id: "review", icon: "🔁", label: "복습" },
  { id: "quiz", icon: "✏️", label: "퀴즈" },
  { id: "settings", icon: "⚙️", label: "설정" },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("interpret");
  const [settings, setSettings] = useState<AppSettings>(loadSettings);

  const updateSettings = (patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  };

  return (
    <>
      <header className="app-header">
        <span className="app-logo">🎙️ 젠지</span>
        <span className="app-tagline">全字 · 모든 글자를 내 것으로</span>
      </header>
      <main className="app-main">
        {tab === "interpret" && <InterpretPage settings={settings} />}
        {tab === "notebook" && <NotebookPage onStartReview={() => setTab("review")} />}
        {tab === "review" && <ReviewPage />}
        {tab === "quiz" && <QuizPage />}
        {tab === "settings" && (
          <SettingsPage settings={settings} onChange={updateSettings} />
        )}
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
