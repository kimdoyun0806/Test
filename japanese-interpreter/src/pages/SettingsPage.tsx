import { useEffect, useState } from "react";
import {
  fetchUsage,
  getAdminCode,
  notifyUsageChanged,
  proxyEnabled,
  setAdminCode,
} from "../services/auth";
import { ENV_PROXY_PASSWORD, ENV_PROXY_URL } from "../services/storage/settings";

/** 프록시 연결 문제를 화면에서 바로 확인하는 진단 도구 */
function Diagnostics() {
  const [lines, setLines] = useState<string[]>([]);
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true);
    const out: string[] = [];
    const base = ENV_PROXY_URL.replace(/\/+$/, "");
    out.push(`내장 URL: ${base || "(없음)"}`);
    out.push(`비밀번호 내장: ${ENV_PROXY_PASSWORD ? "예" : "아니오"}`);

    // 1) GET /usage
    try {
      const t0 = performance.now();
      const res = await fetch(`${base}/usage`, {
        headers: { "x-access-password": ENV_PROXY_PASSWORD },
      });
      const ms = Math.round(performance.now() - t0);
      out.push(`GET /usage → HTTP ${res.status} (${ms}ms): ${(await res.text()).slice(0, 120)}`);
    } catch (e) {
      out.push(`GET /usage → 실패: ${e instanceof Error ? `${e.name}: ${e.message}` : String(e)}`);
    }

    // 2) POST /v1/messages (초소형 요청 — 분석 횟수에 포함 안 됨)
    try {
      const t0 = performance.now();
      const res = await fetch(`${base}/v1/messages`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-access-password": ENV_PROXY_PASSWORD,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5",
          max_tokens: 1,
          messages: [{ role: "user", content: "hi" }],
        }),
      });
      const ms = Math.round(performance.now() - t0);
      out.push(`POST /v1/messages → HTTP ${res.status} (${ms}ms): ${(await res.text()).slice(0, 120)}`);
    } catch (e) {
      out.push(
        `POST /v1/messages → 실패: ${e instanceof Error ? `${e.name}: ${e.message}` : String(e)}`,
      );
    }

    setLines(out);
    setRunning(false);
  };

  /** 카운트 동작 검증: 사용량 조회 → 분석형 초소형 호출 → 사용량 재조회 */
  const runCountTest = async () => {
    setRunning(true);
    const out: string[] = [];
    const base = ENV_PROXY_URL.replace(/\/+$/, "");
    const headers = { "x-access-password": ENV_PROXY_PASSWORD };
    const getUsage = async () => {
      const res = await fetch(`${base}/usage`, { headers });
      return (await res.json()) as { used: number; limit: number; admin: boolean; limited: boolean };
    };
    try {
      const before = await getUsage();
      out.push(
        `사전 조회: used=${before.used}/${before.limit}, admin=${before.admin}, limited(KV연결)=${before.limited}`,
      );
      if (!before.limited) {
        out.push("⚠️ limited=false → Worker에 USAGE(KV) 바인딩이 안 잡혀 있습니다.");
      }
      const res = await fetch(`${base}/v1/messages`, {
        method: "POST",
        headers: {
          ...headers,
          "content-type": "application/json",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5",
          max_tokens: 1,
          system: [{ type: "text", text: "너는 한국인 일본어 학습자를 위한 문장 분석기다. (진단용 호출)" }],
          messages: [{ role: "user", content: "hi" }],
        }),
      });
      out.push(`분석형 테스트 호출 → HTTP ${res.status}`);
      const after = await getUsage();
      out.push(`사후 조회: used=${after.used}/${after.limit}`);
      if (after.admin) out.push("ℹ️ 이 브라우저는 관리자 모드 — 카운트되지 않는 것이 정상입니다.");
      else if (after.used === before.used + 1) out.push("✅ 카운트 정상 동작!");
      else out.push("❌ 카운트가 증가하지 않았습니다 — Worker 코드/바인딩 확인 필요.");
    } catch (e) {
      out.push(`실패: ${e instanceof Error ? `${e.name}: ${e.message}` : String(e)}`);
    }
    setLines(out);
    setRunning(false);
  };

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>연결 진단</h3>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn btn-sm" disabled={running} onClick={() => void run()}>
          {running ? "진단 중…" : "🔧 연결 테스트"}
        </button>
        <button className="btn btn-sm" disabled={running} onClick={() => void runCountTest()}>
          {running ? "진단 중…" : "🔢 카운트 테스트"}
        </button>
      </div>
      {lines.length > 0 && (
        <pre
          style={{
            marginTop: 10,
            fontSize: 12,
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
            background: "var(--color-card-2)",
            borderRadius: 10,
            padding: 10,
          }}
        >
          {lines.join("\n\n")}
        </pre>
      )}
    </div>
  );
}

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

      <Diagnostics />
    </div>
  );
}
