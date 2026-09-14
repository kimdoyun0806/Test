/**
 * 젠지(ZENJI) API 프록시 — Cloudflare Worker
 *
 * Anthropic API 키를 서버(Worker 시크릿)에 보관하고, 접속 비밀번호를 아는
 * 클라이언트만 /v1/messages 호출을 중계한다. 배포 사이트에 키가 노출되지 않는다.
 *
 * 필요 변수 (Worker Settings → Variables):
 *  - ANTHROPIC_API_KEY (Secret)  : sk-ant-... 실제 API 키
 *  - ACCESS_PASSWORD   (Secret)  : 앱 설정에 입력할 접속 비밀번호
 *  - ALLOWED_ORIGINS   (Variable): 허용 출처, 쉼표 구분
 *      예) https://kimdoyun0806.github.io,http://localhost:5173
 */

function corsHeaders(request) {
  const reqHeaders =
    request.headers.get("Access-Control-Request-Headers") ??
    "content-type, x-api-key, anthropic-version, anthropic-beta, anthropic-dangerous-direct-browser-access, x-access-password";
  return {
    "Access-Control-Allow-Origin": request.headers.get("Origin") ?? "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": reqHeaders,
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function isAllowedOrigin(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return allowed.length === 0 || allowed.includes(origin);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") ?? "";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    if (!isAllowedOrigin(origin, env)) {
      return new Response(JSON.stringify({ error: "origin not allowed" }), {
        status: 403,
        headers: { "content-type": "application/json", ...corsHeaders(request) },
      });
    }

    if (!env.ACCESS_PASSWORD || request.headers.get("x-access-password") !== env.ACCESS_PASSWORD) {
      return new Response(JSON.stringify({ error: "invalid access password" }), {
        status: 401,
        headers: { "content-type": "application/json", ...corsHeaders(request) },
      });
    }

    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/v1/messages") {
      return new Response(JSON.stringify({ error: "not found" }), {
        status: 404,
        headers: { "content-type": "application/json", ...corsHeaders(request) },
      });
    }

    // 남용 방지 가드: 허용 모델·토큰 상한 밖의 요청은 중계하지 않는다 (요청당 비용 상한)
    let bodyText;
    try {
      bodyText = await request.text();
      const body = JSON.parse(bodyText);
      const model = String(body.model ?? "");
      const okModel =
        model.startsWith("claude-haiku") ||
        model.startsWith("claude-sonnet") ||
        model.startsWith("claude-opus");
      if (!okModel || (body.max_tokens ?? 0) > 8192) {
        return new Response(JSON.stringify({ error: "request not allowed" }), {
          status: 400,
          headers: { "content-type": "application/json", ...corsHeaders(request) },
        });
      }
    } catch {
      return new Response(JSON.stringify({ error: "invalid body" }), {
        status: 400,
        headers: { "content-type": "application/json", ...corsHeaders(request) },
      });
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
