/**
 * 젠지(ZENJI) API 프록시 — Cloudflare Worker (로그인·일일 사용 제한 포함)
 *
 * 필요 설정 (Worker Settings):
 *  [Variables and Secrets]
 *  - ANTHROPIC_API_KEY (Secret)  : sk-ant-... 실제 API 키
 *  - ACCESS_PASSWORD   (Secret)  : 사이트 빌드에 내장되는 공용 접속 비밀번호
 *  - ALLOWED_ORIGINS   (Text)    : 예) https://kimdoyun0806.github.io,http://localhost:5173
 *  - USER_CODES        (Text)    : 이용 코드 목록, 쉼표 구분. 예) minsu,younghee,jiho
 *  - ADMIN_CODE        (Secret)  : 관리자 코드 (사용량 무제한)
 *  - DAILY_LIMIT       (Text)    : 코드당 일일 분석 횟수 (기본 10)
 *  [Bindings]
 *  - USAGE : KV Namespace 바인딩 (사용량 기록용. 없으면 제한 없이 동작)
 *
 * 횟수 계산: "문장 분석" 호출만 1회로 센다. (한→일 번역, 손글씨 인식 등 부가
 * 호출은 무료 — 요청 본문의 system 프롬프트로 구분)
 */

const ANALYSIS_PROMPT_PREFIX = "너는 한국인 일본어 학습자를 위한 문장 분석기";

function corsHeaders(request) {
  const reqHeaders =
    request.headers.get("Access-Control-Request-Headers") ??
    "content-type, x-api-key, anthropic-version, anthropic-beta, anthropic-dangerous-direct-browser-access, x-access-password, x-user-code";
  return {
    "Access-Control-Allow-Origin": request.headers.get("Origin") ?? "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": reqHeaders,
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(request, status, obj) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders(request) },
  });
}

function isAllowedOrigin(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return allowed.length === 0 || allowed.includes(origin);
}

function userCodes(env) {
  return (env.USER_CODES ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function dailyLimit(env) {
  const n = parseInt(env.DAILY_LIMIT ?? "10", 10);
  return Number.isFinite(n) && n > 0 ? n : 10;
}

/** KST 기준 날짜 (자정 리셋) */
function todayKst() {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

async function readUsed(env, code) {
  if (!env.USAGE) return 0;
  const raw = await env.USAGE.get(`u:${code}:${todayKst()}`);
  return parseInt(raw ?? "0", 10) || 0;
}

async function writeUsed(env, code, used) {
  if (!env.USAGE) return;
  // 이틀 뒤 자동 삭제
  await env.USAGE.put(`u:${code}:${todayKst()}`, String(used), { expirationTtl: 172800 });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") ?? "";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    if (!isAllowedOrigin(origin, env)) {
      return json(request, 403, { error: "origin not allowed" });
    }

    if (!env.ACCESS_PASSWORD || request.headers.get("x-access-password") !== env.ACCESS_PASSWORD) {
      return json(request, 401, { error: "invalid access password" });
    }

    // 이용 코드 확인 (로그인)
    const code = (request.headers.get("x-user-code") ?? "").trim();
    const isAdmin = Boolean(env.ADMIN_CODE) && code === env.ADMIN_CODE;
    const isUser = userCodes(env).includes(code);
    if (!isAdmin && !isUser) {
      return json(request, 401, { error: "invalid user code" });
    }

    const url = new URL(request.url);
    const limit = dailyLimit(env);

    // 사용량 조회 (로그인 검증 겸용)
    if (request.method === "GET" && url.pathname === "/usage") {
      const used = isAdmin ? 0 : await readUsed(env, code);
      return json(request, 200, {
        ok: true,
        admin: isAdmin,
        used,
        limit,
        limited: Boolean(env.USAGE) && !isAdmin,
      });
    }

    if (request.method !== "POST" || url.pathname !== "/v1/messages") {
      return json(request, 404, { error: "not found" });
    }

    // 본문 검사: 남용 가드 + "문장 분석" 호출 여부 판별
    let bodyText;
    let isAnalysis = false;
    try {
      bodyText = await request.text();
      const body = JSON.parse(bodyText);
      const model = String(body.model ?? "");
      const okModel =
        model.startsWith("claude-haiku") ||
        model.startsWith("claude-sonnet") ||
        model.startsWith("claude-opus");
      if (!okModel || (body.max_tokens ?? 0) > 8192) {
        return json(request, 400, { error: "request not allowed" });
      }
      const systemText = Array.isArray(body.system)
        ? String(body.system[0]?.text ?? "")
        : String(body.system ?? "");
      isAnalysis = systemText.startsWith(ANALYSIS_PROMPT_PREFIX);
    } catch {
      return json(request, 400, { error: "invalid body" });
    }

    // 일일 한도: 문장 분석 호출만 카운트, 어드민 제외
    if (!isAdmin && isAnalysis && env.USAGE) {
      const used = await readUsed(env, code);
      if (used >= limit) {
        return json(request, 429, { error: "daily_limit_exceeded", used, limit });
      }
      await writeUsed(env, code, used + 1);
    }

    const upstreamHeaders = {
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": request.headers.get("anthropic-version") ?? "2023-06-01",
    };
    const beta = request.headers.get("anthropic-beta");
    if (beta) upstreamHeaders["anthropic-beta"] = beta;

    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: upstreamHeaders,
      body: bodyText,
    });

    const headers = new Headers(corsHeaders(request));
    headers.set("content-type", upstream.headers.get("content-type") ?? "application/json");
    return new Response(upstream.body, { status: upstream.status, headers });
  },
};
