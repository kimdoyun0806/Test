import { useEffect, useRef, useState } from "react";
import { recognizeWithGoogle, type Stroke } from "../../services/handwriting";
import { recognizeHandwritingImage } from "../../api/claude";
import type { AppSettings } from "../../services/storage/settings";

interface Props {
  settings: AppSettings;
  /** 인식된 글자를 입력창에 추가 */
  onInsert: (text: string) => void;
  onClose: () => void;
  onToast: (message: string) => void;
}

const PAD_HEIGHT = 220;

/** 터치펜·손가락으로 일본어를 써서 입력하는 손글씨 패드 */
export default function HandwritingPad({ settings, onInsert, onClose, onToast }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const currentRef = useRef<Stroke | null>(null);
  const startTimeRef = useRef(0);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [recognizing, setRecognizing] = useState(false);
  const [hasInk, setHasInk] = useState(false);

  // 캔버스 초기화 (devicePixelRatio 대응)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const cssWidth = canvas.clientWidth;
    canvas.width = cssWidth * dpr;
    canvas.height = PAD_HEIGHT * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = getComputedStyle(canvas).color;
  }, []);

  const redraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.clientWidth, PAD_HEIGHT);
    for (const s of strokesRef.current) {
      ctx.beginPath();
      s.x.forEach((x, i) => (i === 0 ? ctx.moveTo(x, s.y[i]) : ctx.lineTo(x, s.y[i])));
      ctx.stroke();
    }
  };

  const pointFromEvent = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleDown = (e: React.PointerEvent) => {
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    if (strokesRef.current.length === 0) startTimeRef.current = Date.now();
    const { x, y } = pointFromEvent(e);
    currentRef.current = { x: [x], y: [y], t: [Date.now() - startTimeRef.current] };
  };

  const handleMove = (e: React.PointerEvent) => {
    const stroke = currentRef.current;
    if (!stroke) return;
    const { x, y } = pointFromEvent(e);
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.beginPath();
    ctx.moveTo(stroke.x[stroke.x.length - 1], stroke.y[stroke.y.length - 1]);
    ctx.lineTo(x, y);
    ctx.stroke();
    stroke.x.push(x);
    stroke.y.push(y);
    stroke.t.push(Date.now() - startTimeRef.current);
  };

  const handleUp = () => {
    if (currentRef.current && currentRef.current.x.length > 0) {
      strokesRef.current.push(currentRef.current);
      setHasInk(true);
    }
    currentRef.current = null;
  };

  const clearPad = () => {
    strokesRef.current = [];
    currentRef.current = null;
    setCandidates([]);
    setHasInk(false);
    redraw();
  };

  const undoStroke = () => {
    strokesRef.current.pop();
    setHasInk(strokesRef.current.length > 0);
    redraw();
  };

  const recognize = async () => {
    const canvas = canvasRef.current;
    if (!canvas || strokesRef.current.length === 0) return;
    setRecognizing(true);
    setCandidates([]);
    try {
      const results = await recognizeWithGoogle(
        strokesRef.current,
        canvas.clientWidth,
        PAD_HEIGHT,
      );
      if (results.length === 0) throw new Error("후보 없음");
      setCandidates(results.slice(0, 6));
    } catch {
      // 구글 인식 실패 → Claude Vision 폴백 (API 키 필요)
      if (settings.apiKey && !settings.mockMode) {
        try {
          const text = await recognizeHandwritingImage(canvas.toDataURL("image/png"), {
            apiKey: settings.apiKey,
            model: settings.model,
          });
          onInsert(text);
          clearPad();
          onToast(`"${text}" 입력됨 (AI 인식)`);
        } catch {
          onToast("손글씨 인식에 실패했습니다. 다시 또박또박 써 주세요.");
        }
      } else {
        onToast("인식 서버에 연결하지 못했습니다. 네트워크를 확인해 주세요.");
      }
    } finally {
      setRecognizing(false);
    }
  };

  const pickCandidate = (c: string) => {
    onInsert(c);
    clearPad();
  };

  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <strong style={{ fontSize: 14 }}>✍️ 손글씨 입력</strong>
        <span className="muted" style={{ fontSize: 12 }}>
          한두 글자씩 쓰고 인식을 누르세요
        </span>
      </div>

      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: PAD_HEIGHT,
          touchAction: "none",
          background: "var(--color-card-2)",
          borderRadius: 14,
          color: "var(--color-text)",
          display: "block",
        }}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleUp}
      />

      {candidates.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          {candidates.map((c) => (
            <button
              key={c}
              className="btn btn-sm"
              style={{ fontSize: 18, fontFamily: "var(--font-jp)" }}
              onClick={() => pickCandidate(c)}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button
          className="btn btn-sm btn-primary"
          disabled={!hasInk || recognizing}
          onClick={recognize}
        >
          {recognizing ? "인식 중…" : "🔍 인식"}
        </button>
        <button className="btn btn-sm" disabled={!hasInk} onClick={undoStroke}>
          ↩ 획 취소
        </button>
        <button className="btn btn-sm" disabled={!hasInk} onClick={clearPad}>
          지우기
        </button>
        <button className="btn btn-sm" style={{ marginLeft: "auto" }} onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  );
}
