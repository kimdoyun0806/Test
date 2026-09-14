import { useEffect, useState } from "react";
import type { AppSettings } from "../services/storage/settings";
import { MODEL_OPTIONS } from "../types/analysis";
import { clearAnalysisCache, countAnalysisCache } from "../services/storage/analysisCache";
import { exportVocab, importVocab, type ExportData } from "../services/storage/vocabStore";
import { ENV_API_KEY } from "../services/storage/settings";
import { isRecognitionSupported } from "../services/speech/recognition";
import { hasJapaneseVoice, isTtsSupported } from "../services/speech/tts";

interface Props {
  settings: AppSettings;
  onChange: (patch: Partial<AppSettings>) => void;
}

export default function SettingsPage({ settings, onChange }: Props) {
  const [cacheCount, setCacheCount] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [keyDraft, setKeyDraft] = useState("");

  useEffect(() => {
    void countAnalysisCache().then(setCacheCount);
  }, []);

  const handleExport = async () => {
    const data = await exportVocab();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jp-tutor-vocab-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as ExportData;
      if (data.version !== 1 || !Array.isArray(data.vocab)) throw new Error("형식 오류");
      const added = await importVocab(data);
      setMessage(`어휘장 항목 ${added}개를 가져왔습니다.`);
    } catch {
      setMessage("가져오기에 실패했습니다. 이 앱에서 내보낸 JSON 파일인지 확인해 주세요.");
    }
  };

  return (
    <div>
      <h2>⚙️ 설정</h2>

      <div className="card">
        <div className="settings-row">
          <label>Anthropic API 키</label>
          <p className="muted" style={{ marginTop: 0 }}>
            {settings.apiKey
              ? settings.apiKey === ENV_API_KEY
                ? "로컬 환경변수(.env.local) 키 사용 중 ✅"
                : `저장된 키: sk-ant-••••${settings.apiKey.slice(-4)} ✅`
              : "저장된 키가 없습니다."}
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="password"
              placeholder="새 API 키 입력 (sk-ant-...)"
              value={keyDraft}
              onChange={(e) => setKeyDraft(e.target.value)}
              style={{ flex: 1 }}
            />
            <button
              className="btn btn-primary"
              disabled={!keyDraft.trim()}
              onClick={() => {
                onChange({ apiKey: keyDraft.trim() });
                setKeyDraft("");
                setMessage("API 키를 저장했습니다.");
              }}
            >
              저장
            </button>
            {settings.apiKey && (
              <button
                className="btn"
                onClick={() => {
                  onChange({ apiKey: "" });
                  setMessage("API 키를 삭제했습니다.");
                }}
              >
                삭제
              </button>
            )}
          </div>
          <p className="muted">
            키는 이 브라우저의 localStorage에만 저장되며 서버로 전송되지 않습니다. 화면에는
            끝 4자리만 표시됩니다. 공용 PC에서는 사용하지 마세요. 지출 한도는 Anthropic
            콘솔(console.anthropic.com)에서 설정할 수 있습니다.
          </p>
        </div>
        <div className="settings-row">
          <label>분석 모델</label>
          <select value={settings.model} onChange={(e) => onChange({ model: e.target.value })}>
            {MODEL_OPTIONS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          <p className="muted">
            기본값 Haiku는 문장당 약 $0.005 수준으로 일상 문장에 충분하며, 분석 검증에
            실패한 어려운 문장만 자동으로 Opus로 승격해 재분석합니다.
          </p>
        </div>
        <div className="toggle-row">
          <label htmlFor="mock-toggle">목(체험) 모드 — API 키 없이 예시 데이터로 체험</label>
          <input
            id="mock-toggle"
            type="checkbox"
            checked={settings.mockMode}
            onChange={(e) => onChange({ mockMode: e.target.checked })}
          />
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>프록시 모드 (Cloudflare Worker)</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          API 키를 브라우저에 저장하는 대신 Cloudflare Worker가 서버에서 키를 보관합니다.
          Worker URL과 접속 비밀번호를 입력하면 위의 API 키 없이 동작합니다. (설치 방법은
          저장소 <code>japanese-interpreter/worker/</code> 참고)
        </p>
        <div className="settings-row">
          <label>Worker URL</label>
          <input
            type="text"
            placeholder="https://zenji-proxy.내계정.workers.dev"
            value={settings.proxyUrl}
            onChange={(e) => onChange({ proxyUrl: e.target.value.trim() })}
          />
        </div>
        <div className="settings-row">
          <label>접속 비밀번호</label>
          <input
            type="password"
            placeholder="Worker에 설정한 ACCESS_PASSWORD"
            value={settings.proxyPassword}
            onChange={(e) => onChange({ proxyPassword: e.target.value })}
          />
        </div>
        {settings.proxyUrl && (
          <p className="muted">✅ 프록시 모드 활성 — API 키 입력 없이 프록시로 호출합니다.</p>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>표시</h3>
        <div className="toggle-row">
          <label htmlFor="romaji-toggle">로마자 표기 (위)</label>
          <input
            id="romaji-toggle"
            type="checkbox"
            checked={settings.showRomaji}
            onChange={(e) => onChange({ showRomaji: e.target.checked })}
          />
        </div>
        <div className="toggle-row">
          <label htmlFor="hangul-toggle">한글 발음 표기 (아래)</label>
          <input
            id="hangul-toggle"
            type="checkbox"
            checked={settings.showHangul}
            onChange={(e) => onChange({ showHangul: e.target.checked })}
          />
        </div>
        <p className="muted">
          로마자는 모라 단위 반복 표기(ryo-ko-o), 한글은 교재식 관용 표기를 사용합니다. 표기는
          근사치이며 실제 발음은 듣기·발음 연습으로 익혀 주세요.
        </p>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>음성 상태</h3>
        <p className="muted" style={{ margin: 0 }}>
          음성 인식(STT): {isRecognitionSupported() ? "✅ 지원" : "❌ 미지원 (Chrome/Edge 권장)"}
          <br />
          음성 합성(TTS): {isTtsSupported() ? "✅ 지원" : "❌ 미지원"} · 일본어 보이스:{" "}
          {hasJapaneseVoice() ? "✅ 있음" : "❌ 없음 (OS 언어팩 설치 필요할 수 있음)"}
        </p>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>데이터 관리</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-sm" onClick={handleExport}>
            📤 어휘장 내보내기 (JSON)
          </button>
          <label className="btn btn-sm" style={{ display: "inline-block" }}>
            📥 어휘장 가져오기
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
          <button
            className="btn btn-sm"
            onClick={async () => {
              await clearAnalysisCache();
              setCacheCount(0);
              setMessage("분석 캐시를 비웠습니다.");
            }}
          >
            🗑️ 분석 캐시 비우기{cacheCount !== null ? ` (${cacheCount}건)` : ""}
          </button>
        </div>
        {message && <p className="muted">{message}</p>}
        <p className="muted">
          브라우저 데이터 삭제 시 어휘장이 사라질 수 있으니 주기적으로 내보내기를 권장합니다.
        </p>
      </div>
    </div>
  );
}
