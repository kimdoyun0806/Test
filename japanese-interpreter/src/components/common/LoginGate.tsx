import { useState } from "react";
import { fetchUsage, setUserCode } from "../../services/auth";

interface Props {
  onSuccess: (code: string) => void;
}

/** 이용 코드 입력 화면 — 내장 프록시 운영 시 첫 진입 게이트 */
export default function LoginGate({ onSuccess }: Props) {
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setChecking(true);
    setError(null);
    try {
      const usage = await fetchUsage(trimmed);
      if (!usage) {
        setError("코드가 올바르지 않습니다. 관리자에게 받은 코드를 확인해 주세요.");
        return;
      }
      setUserCode(trimmed);
      onSuccess(trimmed);
    } catch {
      setError("서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="app-main" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="card" style={{ width: "100%", maxWidth: 400, textAlign: "center" }}>
        <p style={{ fontSize: 40, margin: "8px 0" }}>🎙️</p>
        <h2 style={{ margin: "0 0 4px" }}>젠지 (ZENJI)</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          全字 · 모든 글자를 내 것으로
        </p>
        <p style={{ margin: "20px 0 8px" }}>이용 코드를 입력해 주세요</p>
        <input
          type="text"
          placeholder="예: minsu"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void submit()}
          style={{ width: "100%", textAlign: "center", marginBottom: 12 }}
          autoFocus
        />
        <button
          className="btn btn-primary"
          style={{ width: "100%" }}
          disabled={checking || !code.trim()}
          onClick={() => void submit()}
        >
          {checking ? "확인 중…" : "시작하기"}
        </button>
        {error && <p className="answer-wrong" style={{ fontSize: 13 }}>{error}</p>}
        <p className="muted" style={{ marginBottom: 0 }}>
          코드는 관리자(스터디장)에게 받을 수 있어요. 한 번 입력하면 이 브라우저에 저장됩니다.
        </p>
      </div>
    </div>
  );
}
