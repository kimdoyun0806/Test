import type { Analysis } from "../../types/analysis";
import { getDB, type CachedAnalysis } from "./db";

/** 캐시 키 정규화: NFKC + trim */
export function cacheKey(sentence: string): string {
  return sentence.normalize("NFKC").trim();
}

export async function getCachedAnalysis(sentence: string): Promise<CachedAnalysis | undefined> {
  const db = await getDB();
  return db.get("analysisCache", cacheKey(sentence));
}

export async function putCachedAnalysis(
  sentence: string,
  analysis: Analysis,
  model: string,
): Promise<void> {
  const db = await getDB();
  await db.put("analysisCache", {
    sentence: cacheKey(sentence),
    analysis,
    model,
    createdAt: Date.now(),
  });
}

export async function deleteCachedAnalysis(sentence: string): Promise<void> {
  const db = await getDB();
  await db.delete("analysisCache", cacheKey(sentence));
}

export async function clearAnalysisCache(): Promise<void> {
  const db = await getDB();
  await db.clear("analysisCache");
}

export async function countAnalysisCache(): Promise<number> {
  const db = await getDB();
  return db.count("analysisCache");
}
