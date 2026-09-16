import { useMemo } from "react";
import { syllabifyKana } from "../../services/kanaTransliterate";
import { speakJapanese, hasJapaneseVoice } from "../../services/speech/tts";

interface Props {
  /** 표기 (한자 포함 단어 또는 문장 조각) */
  surface: string;
  readingKana: string;
  romaji: string;
  hangul: string;
  meaningKo: string | null;
  level: string | null;
  /** 있으면 ⭐ 저장 버튼을 표시한다 (이미 어휘장에 있는 항목은 생략) */
  onSave?: () => void;
  saveLabel?: string;
  onClose: () => void;
}

/**
 * 단어 정보 시트 — 음절마다 가나/로마자/한글 발음을 나눠 보여준다.
 * 통역 카드와 어휘장이 같은 화면을 쓰도록 공용 컴포넌트로 분리했다.
 */
export default function WordDetailSheet({
  surface,
  readingKana,
  romaji,
  hangul,
  meaningKo,
  level,
  onSave,
  saveLabel = "⭐ 어휘장에 저장",
  onClose,
}: Props) {
  const syllables = useMemo(() => syllabifyKana(readingKana), [readingKana]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h3 className="word-title">{surface}</h3>
        <p style={{ margin: "0 0 8px" }}>
          {readingKana} · {romaji} · {hangul}
        </p>

        {syllables.length > 0 && (
          <div className="syllable-row">
            {syllables.map((s, i) => (
              <div key={i} className="syllable">
                <span className="romaji">{s.romaji}</span>
                <span className="kana">{s.kana}</span>
                <span className="hangul">{s.hangul}</span>
                <button
                  type="button"
                  className="syllable-play"
                  disabled={!hasJapaneseVoice()}
                  title={`「${s.kana}」 듣기`}
                  aria-label={`${s.kana} 듣기`}
                  onClick={() => speakJapanese(s.kana)}
                >
                  🔊
                </button>
              </div>
            ))}
          </div>
        )}

        <p style={{ marginTop: 0, fontSize: "1.05rem" }}>
          {meaningKo || "(뜻 정보 없음 — 문장을 다시 분석하면 표시됩니다)"}
          {level && <span className="muted"> · {level}</span>}
        </p>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            className="btn btn-sm"
            disabled={!hasJapaneseVoice()}
            onClick={() => speakJapanese(surface)}
          >
            🔊 듣기
          </button>
          {onSave && (
            <button className="btn btn-sm btn-primary" onClick={onSave}>
              {saveLabel}
            </button>
          )}
          <button className="btn btn-sm" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
