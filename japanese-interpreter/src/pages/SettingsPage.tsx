import { useEffect, useState } from "react";
import {
  fetchUsage,
  getAdminCode,
  notifyUsageChanged,
  proxyEnabled,
  setAdminCode,
} from "../services/auth";

/** 최소 설정 화면 — 관리자 코드 입력 (관리자는 일일 한도 없이 사용) */
export default function SettingsPage() {
  const [draft, setDraft] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!proxyEnabled() || !getAdminCode()) return;
    void fetchUsage().then((u) => setIsAdmin(u.admin)).catch(() => undefined);
  }, []);

  const applyCode = async () => {
    const code = draft.trim();
    if (!code) return;
    setChecking(true);
    setMessage(null);
    try {
      const usage = await fetchUsage(code);
      if (usage.admin) {
        setAdminCode(code);
        setIsAdmin(true);
        setDraft("");
        setMessage("✅ 관리자 인증 성공 — 이 브라우저는 일일 한도 없이 사용됩니다.");
        notifyUsageChanged();
      } else {
        setMessage("코드가 올바르지 않습니다.");
      }
    } catch {
      setMessage("서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setChecking(false);
    }
  };

  const clearCode = () => {
    setAdminCode("");
    setIsAdmin(false);
    setMessage("관리자 모드를 해제했습니다.");
    notifyUsageChanged();
  };

  if (!proxyEnabled()) {
    return (
      <div>
        <h2>⚙️ 설정</h2>
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            이 사이트에는 아직 API 프록시가 연결되지 않았습니다. 관리자가 배포 설정을
            완료하면 사용할 수 있습니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2>⚙️ 설정</h2>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>관리자</h3>
        {isAdmin ? (
          <>
            <p style={{ marginTop: 0 }}>✅ 관리자 모드 활성 — 일일 한도 없이 사용 중입니다.</p>
            <button className="btn btn-sm" onClick={clearCode}>
              관리자 모드 해제
            </button>
          </>
        ) : (
          <>
            <p className="muted" style={{ marginTop: 0 }}>
              관리자 코드를 입력하면 이 브라우저는 일일 분석 한도 없이 사용됩니다.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="password"
                placeholder="관리자 코드"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void applyCode()}
                style={{ flex: 1 }}
              />
              <button
                className="btn btn-primary"
                disabled={checking || !draft.trim()}
                onClick={() => void applyCode()}
              >
                {checking ? "확인 중…" : "확인"}
              </button>
            </div>
          </>
        )}
        {message && <p className="muted">{message}</p>}
      </div>
    </div>
  );
}
