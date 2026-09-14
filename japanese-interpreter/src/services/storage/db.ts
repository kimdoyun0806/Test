import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Analysis } from "../../types/analysis";
import type { SrsState } from "../srs";

export interface VocabCard {
  id: string;
  type: "word" | "sentence";
  /** 표기 (단어 surface 또는 문장 전체) */
  front: string;
  readingKana: string;
  readingHangul: string;
  romaji: string;
  meaningKo: string;
  /** 출처 문장 (분석 캐시 키와 동일 정규화) — 퀴즈 연동 */
  sourceSentence: string;
  level: string | null;
  srs: SrsState;
  createdAt: number;
}

export interface CachedAnalysis {
  /** NFKC 정규화 + trim된 문장 (keyPath) */
  sentence: string;
  analysis: Analysis;
  model: string;
  /** 분석 스키마 버전 — 다르면 캐시 미스로 처리 (구버전 데이터는 이 필드가 없음) */
  schemaVersion?: number;
  createdAt: number;
}

interface JpTutorDB extends DBSchema {
  vocab: {
    key: string;
    value: VocabCard;
    indexes: { dueAt: number; type: string };
  };
  analysisCache: {
    key: string;
    value: CachedAnalysis;
  };
}

let dbPromise: Promise<IDBPDatabase<JpTutorDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<JpTutorDB>> {
  if (!dbPromise) {
    dbPromise = openDB<JpTutorDB>("jp-tutor", 1, {
      upgrade(db) {
        const vocab = db.createObjectStore("vocab", { keyPath: "id" });
        vocab.createIndex("dueAt", "srs.dueAt");
        vocab.createIndex("type", "type");
        db.createObjectStore("analysisCache", { keyPath: "sentence" });
      },
    });
  }
  return dbPromise;
}
