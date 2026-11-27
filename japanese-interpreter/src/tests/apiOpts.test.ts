import { describe, expect, it } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import { apiOptsFrom, describeApiError } from "../api/claude";

const base = { model: "claude-haiku-4-5", apiKey: "", proxyUrl: "", proxyPassword: "" };
const builtin = { url: "https://proxy.example", password: "pw" };
const none = { url: "", password: "" };

describe("apiOptsFrom", () => {
  it("내장 프록시가 있으면 브라우저에 남은 옛 키·프록시를 무시한다", () => {
    const opts = apiOptsFrom(
      { ...base, apiKey: "sk-ant-expired", proxyUrl: "https://old.example", proxyPassword: "old" },
      builtin,
    );
    expect(opts).toEqual({
      apiKey: "",
      model: base.model,
      proxyUrl: "https://proxy.example",
      proxyPassword: "pw",
    });
  });

  it("내장 프록시가 없으면 저장된 프록시를 쓴다", () => {
    const opts = apiOptsFrom({ ...base, proxyUrl: "https://mine.example", proxyPassword: "p" }, none);
    expect(opts.proxyUrl).toBe("https://mine.example");
    expect(opts.proxyPassword).toBe("p");
  });

  it("내장·저장 프록시가 모두 없으면 API 키로 직접 호출한다", () => {
    const opts = apiOptsFrom({ ...base, apiKey: "sk-ant-local" }, none);
    expect(opts).toEqual({ apiKey: "sk-ant-local", model: base.model });
  });
});

describe("describeApiError — 401 출처 구분", () => {
  const make = (body: object) =>
    Anthropic.APIError.generate(401, body, undefined, new Headers());

  it("프록시가 거절하면 접속 비밀번호 안내", () => {
    expect(describeApiError(make({ error: "invalid access password" }))).toContain(
      "ZENJI_PROXY_PASSWORD",
    );
  });

  it("Anthropic이 거절하면 API 키 안내", () => {
    const msg = describeApiError(
      make({ type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }),
    );
    expect(msg).toContain("ANTHROPIC_API_KEY");
  });
});
