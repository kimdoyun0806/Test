import { useState } from "react";
import type { Analysis, AnalysisToken } from "../../types/analysis";
import RubyToken from "./RubyToken";
import SegmentedTranslation from "./SegmentedTranslation";

interface Props {
  analysis: Analysis;
  colorEnabled?: boolean;
  showRomaji?: boolean;
  showHangul?: boolean;
  /** 지정 시 토큰 탭 동작 활성화 */
  onTokenClick?: (token: AnalysisToken) => void;
  /** 문법 포인트 섹션 표시 여부 */
  showGrammar?: boolean;
}

/**
 * 분석 결과의 핵심 표시부 (3단 루비 + 색상 매핑 번역 + 문법).
 * 통역 카드·어휘장·공유 페이지에서 공용으로 사용한다.
 */
export default function AnalyzedSentenceView({
  analysis,
  colorEnabled = true,
  showRomaji = true,
  showHangul = true,
  onTokenClick,
  showGrammar = true,
}: Props) {
  const [highlightedSegment, setHighlightedSegment] = useState<number | null>(null);

  return (
    <>
      <div className="token-row">
        {analysis.tokens.map((token, i) => (
          <RubyToken
            key={i}
            token={token}
            colorEnabled={colorEnabled}
            showRomaji={showRomaji}
            showHangul={showHangul}
            highlighted={colorEnabled && highlightedSegment === token.segment_index}
            onHover={(seg) => colorEnabled && setHighlightedSegment(seg)}
            onClick={() => onTokenClick?.(token)}
          />
        ))}
      </div>

      <SegmentedTranslation
        analysis={analysis}
        colorEnabled={colorEnabled}
        highlightedSegment={highlightedSegment}
        onHover={setHighlightedSegment}
      />

      {showGrammar && analysis.grammar_points.length > 0 && (
        <details className="grammar-section">
          <summary>📖 문법 포인트 {analysis.grammar_points.length}개</summary>
          {analysis.grammar_points.map((g, i) => (
            <div key={i} className="grammar-item">
              <span className="pattern">{g.pattern}</span>{" "}
              <span className="muted">({g.jp_example})</span>
              <br />
              {g.explanation_ko}
            </div>
          ))}
        </details>
      )}
    </>
  );
}
