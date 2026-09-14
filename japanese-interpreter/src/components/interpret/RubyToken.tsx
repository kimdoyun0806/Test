import type { AnalysisToken } from "../../types/analysis";
import { SEGMENT_COLOR_COUNT } from "../../types/analysis";
import type { CSSProperties } from "react";

interface Props {
  token: AnalysisToken;
  /** false면 색상 매핑 비활성 (검증 실패 시 우아한 저하) */
  colorEnabled: boolean;
  showRomaji: boolean;
  showHangul: boolean;
  highlighted: boolean;
  onHover: (segmentIndex: number | null) => void;
  onClick: () => void;
}

/** 3단 스택 토큰: 로마자(위) / 일본어(중) / 한글(아래) */
export default function RubyToken({
  token,
  colorEnabled,
  showRomaji,
  showHangul,
  highlighted,
  onHover,
  onClick,
}: Props) {
  const colorIdx = token.segment_index % SEGMENT_COLOR_COUNT;
  const style = colorEnabled
    ? ({
        "--seg-color": `var(--seg-color-${colorIdx})`,
        "--seg-bg": `var(--seg-bg-${colorIdx})`,
      } as CSSProperties)
    : undefined;

  return (
    <button
      type="button"
      className={`ruby-token${highlighted ? " highlighted" : ""}`}
      style={style}
      onMouseEnter={() => onHover(token.segment_index)}
      onMouseLeave={() => onHover(null)}
      onClick={onClick}
      title="탭하여 단어 정보 보기"
    >
      {showRomaji && <span className="romaji">{token.romaji}</span>}
      <span className="surface">{token.surface}</span>
      {showHangul && <span className="hangul">{token.hangul}</span>}
    </button>
  );
}
