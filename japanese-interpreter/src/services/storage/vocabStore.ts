import { getDB, type VocabCard } from "./db";
import { initialSrsState, review, type SrsQuality } from "../srs";
import type { Analysis, AnalysisToken } from "../../types/analysis";
import { cacheKey } from "./analysisCache";

export async function listVocab(): Promise<VocabCard[]> {
  const db = await getDB();
  const all = await db.getAll("vocab");
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

/** 오늘 복습할 카드 (dueAt <= now) */
export async function listDueVocab(now: number = Date.now()): Promise<VocabCard[]> {
  const db = await getDB();
  return db.getAllFromIndex("vocab", "dueAt", IDBKeyRange.upperBound(now));
}

export async function deleteVocab(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("vocab", id);
}

export async function gradeVocab(id: string, q: SrsQuality): Promise<VocabCard | undefined> {
  const db = await getDB();
  const card = await db.get("vocab", id);
  if (!card) return undefined;
  const updated: VocabCard = { ...card, srs: review(card.srs, q) };
  await db.put("vocab", updated);
  return updated;
}

async function existsByFront(front: string, type: VocabCard["type"]): Promise<boolean> {
  const all = await listVocab();
  return all.some((c) => c.front === front && c.type === type);
}

/** 단어(토큰) 저장. 이미 같은 표기의 단어가 있으면 저장하지 않고 false 반환 */
export async function saveWord(
  token: AnalysisToken,
  sourceSentence: string,
  fallbackMeaning?: string,
): Promise<boolean> {
  if (await existsByFront(token.surface, "word")) return false;
  const db = await getDB();
  await db.put("vocab", {
    id: crypto.randomUUID(),
    type: "word",
    front: token.surface,
    readingKana: token.reading_kana,
    readingHangul: token.hangul,
    romaji: token.romaji,
    meaningKo: token.meaning_ko ?? fallbackMeaning ?? "",
    sourceSentence: cacheKey(sourceSentence),
    level: token.level,
    srs: initialSrsState(),
    createdAt: Date.now(),
  });
  return true;
}

/** 문장 저장 */
export async function saveSentence(analysis: Analysis): Promise<boolean> {
  if (await existsByFront(analysis.sentence_jp, "sentence")) return false;
  const db = await getDB();
  await db.put("vocab", {
    id: crypto.randomUUID(),
    type: "sentence",
    front: analysis.sentence_jp,
    readingKana: analysis.tokens.map((t) => t.reading_kana).join(""),
    readingHangul: analysis.tokens.map((t) => t.hangul).join(" "),
    romaji: analysis.tokens.map((t) => t.romaji).join(" "),
    meaningKo: analysis.translation_ko,
    sourceSentence: cacheKey(analysis.sentence_jp),
    level: null,
    srs: initialSrsState(),
    createdAt: Date.now(),
  });
  return true;
}

export interface ExportData {
  version: 1;
  exportedAt: number;
  vocab: VocabCard[];
}

export async function exportVocab(): Promise<ExportData> {
  return { version: 1, exportedAt: Date.now(), vocab: await listVocab() };
}

/** 가져오기: id 충돌 시 기존 유지, 새 항목만 추가. 추가된 개수 반환 */
export async function importVocab(data: ExportData): Promise<number> {
  const db = await getDB();
  let added = 0;
  for (const card of data.vocab) {
    const exists = await db.get("vocab", card.id);
    if (!exists) {
      await db.put("vocab", card);
      added++;
    }
  }
  return added;
}
