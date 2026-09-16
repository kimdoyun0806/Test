import { describe, expect, it } from "vitest";
import { mergeUsage, readUsageHeaders, type UsageInfo } from "../services/auth";

const headers = (map: Record<string, string>) => ({
  get: (name: string) => map[name.toLowerCase()] ?? null,
});

describe("readUsageHeaders", () => {
  it("프록시 응답 헤더에서 사용량을 읽는다", () => {
    const usage = readUsageHeaders(
      headers({
        "x-zenji-date": "2026-09-16",
        "x-zenji-used": "7",
        "x-zenji-limit": "25",
        "x-zenji-admin": "0",
        "x-zenji-limited": "1",
      }),
    );
    expect(usage).toEqual({
      ok: true,
      admin: false,
      used: 7,
      limit: 25,
      limited: true,
      date: "2026-09-16",
    });
  });

  it("관리자 응답은 admin=true", () => {
    const usage = readUsageHeaders(
      headers({ "x-zenji-used": "3", "x-zenji-limit": "25", "x-zenji-admin": "1" }),
    );
    expect(usage?.admin).toBe(true);
  });

  it("헤더가 없는 구버전 Worker 응답은 null", () => {
    expect(readUsageHeaders(headers({}))).toBeNull();
  });

  it("숫자가 아닌 값은 null", () => {
    expect(readUsageHeaders(headers({ "x-zenji-used": "abc", "x-zenji-limit": "25" }))).toBeNull();
  });
});

describe("mergeUsage", () => {
  const base: UsageInfo = {
    ok: true,
    admin: false,
    used: 9,
    limit: 25,
    limited: true,
    date: "2026-09-16",
  };

  it("같은 날짜에 더 낮은 값이 오면(KV 반영 지연) 숫자를 되돌리지 않는다", () => {
    expect(mergeUsage(base, { ...base, used: 6 }).used).toBe(9);
  });

  it("같은 날짜에 더 높은 값은 반영한다", () => {
    expect(mergeUsage(base, { ...base, used: 11 }).used).toBe(11);
  });

  it("날짜가 바뀌면(자정 리셋) 새 값을 그대로 쓴다", () => {
    expect(mergeUsage(base, { ...base, used: 0, date: "2026-09-17" }).used).toBe(0);
  });

  it("날짜 정보가 없는 구버전 응답은 그대로 반영한다", () => {
    expect(mergeUsage(base, { ...base, used: 2, date: undefined }).used).toBe(2);
  });

  it("사용량 외 필드는 최신 값을 따른다", () => {
    expect(mergeUsage(base, { ...base, used: 6, admin: true }).admin).toBe(true);
  });
});
