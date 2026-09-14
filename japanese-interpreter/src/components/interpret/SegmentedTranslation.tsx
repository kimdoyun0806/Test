import type { Analysis } from "../../types/analysis";
import { SEGMENT_COLOR_COUNT } from "../../types/analysis";
import type { CSSProperties } from "react";

interface Props {
  analysis: Analysis;
  /** false면 색상 없이 translation_ko 전체만 표시 */
  colorEnabled: boolean;
  highlightedSegment: number | null;
  onHover: (segmentIndex: number | null) => void;
}

/** 색상 매핑된 한국어 번역 — 일본어 세그먼트와 같은 색 배경 */
export default function SegmentedTranslation({
  analysis,
  colorEnabled,
  highlightedSegment,
  onHover,
}: Props) {
  if (!colorEnabled) {
    return <p className="segmented-translation">🇰🇷 {analysis.translation_ko}</p>;
  }
  return (
    <p className="segmented-translation">
      {"🇰🇷 "}
      {analysis.segments.map((seg, i) => {
        const colorIdx = i % SEGMENT_COLOR_COUNT;
        return (
          <span
            key={i}
            className={`ko-seg${highlightedSegment === i ? " highlighted" : ""}`}
            style={
              {
                "--seg-color": `var(--seg-color-${colorIdx})`,
                "--seg-bg": `var(--seg-bg-${colorIdx})`,
              } as CSSProperties
            }
            onMouseEnter={() => onHover(i)}
            onMouseLeave={() => onHover(null)}
          >
            {seg.ko_text}
          </span>
        );
      })}
    </p>
  );
}
