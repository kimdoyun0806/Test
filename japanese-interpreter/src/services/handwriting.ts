/** 손글씨 인식 — Google Input Tools 손글씨 API (무료, 키 불필요) */

export interface Stroke {
  x: number[];
  y: number[];
  t: number[];
}

/**
 * 캔버스 획 데이터를 구글 손글씨 인식 서버로 보내 일본어 후보 목록을 받는다.
 * (Google 입력 도구의 공개 엔드포인트 — 크롬 확장/모바일 검색이 쓰는 것과 동일)
 */
export async function recognizeWithGoogle(
  strokes: Stroke[],
  width: number,
  height: number,
): Promise<string[]> {
  const body = {
    options: "enable_pre_space",
    requests: [
      {
        writing_guide: { writing_area_width: width, writing_area_height: height },
        ink: strokes.map((s) => [s.x, s.y, s.t]),
        language: "ja",
      },
    ],
  };
  const res = await fetch("https://inputtools.google.com/request?itc=ja-t-i0-handwrit&num=6", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`인식 서버 오류 (${res.status})`);
  const data = (await res.json()) as unknown[];
  if (data[0] !== "SUCCESS") throw new Error("손글씨를 인식하지 못했습니다.");
  const result = data[1] as [string, string[]][] | undefined;
  return result?.[0]?.[1] ?? [];
}
