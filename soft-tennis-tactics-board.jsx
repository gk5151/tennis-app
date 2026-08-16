const { useState, useRef, useCallback, useEffect } = React;

// ソフトテニスコート寸法 (メートル) ― テニスと同一サイズ
const COURT = {
  width: 10.97,
  halfLength: 11.885,
  serviceLine: 6.40,
  singlesWidth: 8.23,
  sideMargin: (10.97 - 8.23) / 2,
  centerServiceX: 10.97 / 2,
};
const FULL_LENGTH = COURT.halfLength * 2;

const PADDING = 20;
const TOP_LABEL_SPACE = 14;
const BOTTOM_LABEL_SPACE = 18;
const DRAW_W = 280;
const DRAW_H = DRAW_W * (FULL_LENGTH / COURT.width);
const VIEW_WIDTH = DRAW_W + PADDING * 2;
const VIEW_HEIGHT = DRAW_H + PADDING * 2 + TOP_LABEL_SPACE + BOTTOM_LABEL_SPACE;
const DRAW_X = PADDING;
const DRAW_Y = PADDING + TOP_LABEL_SPACE;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const PIECE_INFO = {
  oppBack: { label: "相手後衛", color: "#ff6b6b" },
  oppFront: { label: "相手前衛", color: "#f783ac" },
  myFront: { label: "自分前衛", color: "#ffd166" },
  myBack: { label: "自分後衛", color: "#4dd0e1" },
};

const DEFAULT_PIECES = {
  oppBack: { x: COURT.width / 2, y: 2.0 },
  oppFront: { x: COURT.width / 2, y: COURT.halfLength - 3.0 },
  myFront: { x: COURT.width / 2, y: COURT.halfLength + 3.0 },
  myBack: { x: COURT.width / 2, y: FULL_LENGTH - 2.0 },
};

const PEN_COLORS = [
  { key: "red", hex: "#e03131" },
  { key: "black", hex: "#1a1a1a" },
  { key: "blue", hex: "#1c64f2" },
];

const ERASE_RADIUS = 0.5; // メートル

function TacticsBoard() {
  const [pieces, setPieces] = useState(DEFAULT_PIECES);
  const [mode, setMode] = useState("move"); // 'move' | 'pen' | 'eraser'
  const [penColor, setPenColor] = useState("#e03131");
  const [strokes, setStrokes] = useState([]); // [{ color, points: [{x,y}] }]
  const [liveStroke, setLiveStroke] = useState(null);

  const dragPieceRef = useRef(null);
  const isDrawingRef = useRef(false);
  const svgRef = useRef(null);

  const toSvgX = useCallback((m) => DRAW_X + (m / COURT.width) * DRAW_W, []);
  const toSvgY = useCallback((m) => DRAW_Y + (m / FULL_LENGTH) * DRAW_H, []);

  const pointerToCourt = useCallback((e) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const svgX = ((clientX - rect.left) / rect.width) * VIEW_WIDTH;
    const svgY = ((clientY - rect.top) / rect.height) * VIEW_HEIGHT;
    const mx = ((svgX - DRAW_X) / DRAW_W) * COURT.width;
    const my = ((svgY - DRAW_Y) / DRAW_H) * FULL_LENGTH;
    return {
      x: clamp(mx, -0.5, COURT.width + 0.5),
      y: clamp(my, -0.8, FULL_LENGTH + 0.8),
    };
  }, []);

  const eraseNear = useCallback((pos) => {
    setStrokes((prev) =>
      prev.filter((s) => !s.points.some((p) => Math.hypot(p.x - pos.x, p.y - pos.y) < ERASE_RADIUS))
    );
  }, []);

  // --- コマのドラッグ ---
  const handlePieceDown = (key) => (e) => {
    if (mode !== "move") return;
    e.preventDefault();
    dragPieceRef.current = key;
  };

  // --- ペン／消しゴムの描画開始 ---
  const handleSvgDown = (e) => {
    if (mode === "pen") {
      e.preventDefault();
      isDrawingRef.current = true;
      const pos = pointerToCourt(e);
      setLiveStroke({ color: penColor, points: [pos] });
    } else if (mode === "eraser") {
      e.preventDefault();
      isDrawingRef.current = true;
      eraseNear(pointerToCourt(e));
    }
  };

  const handleSvgMove = (e) => {
    if (dragPieceRef.current) {
      e.preventDefault();
      const pos = pointerToCourt(e);
      const key = dragPieceRef.current;
      setPieces((prev) => ({ ...prev, [key]: pos }));
      return;
    }
    if (mode === "pen" && isDrawingRef.current) {
      e.preventDefault();
      const pos = pointerToCourt(e);
      setLiveStroke((prev) => (prev ? { ...prev, points: [...prev.points, pos] } : prev));
    } else if (mode === "eraser" && isDrawingRef.current) {
      e.preventDefault();
      eraseNear(pointerToCourt(e));
    }
  };

  const handleSvgUp = () => {
    dragPieceRef.current = null;
    if (isDrawingRef.current) {
      isDrawingRef.current = false;
      if (mode === "pen") {
        setLiveStroke((prev) => {
          if (prev && prev.points.length > 1) {
            setStrokes((s) => [...s, prev]);
          }
          return null;
        });
      }
    }
  };

  const undoLastStroke = () => setStrokes((s) => s.slice(0, -1));
  const clearStrokes = () => setStrokes([]);
  const resetPieces = () => setPieces(DEFAULT_PIECES);

  const courtLine = (x1, y1, x2, y2) => (
    <line
      x1={toSvgX(x1)} y1={toSvgY(y1)}
      x2={toSvgX(x2)} y2={toSvgY(y2)}
      stroke="rgba(255,255,255,0.85)"
      strokeWidth={1.5}
    />
  );

  const strokeToPath = (points) =>
    points.map((p, i) => `${i === 0 ? "M" : "L"} ${toSvgX(p.x)} ${toSvgY(p.y)}`).join(" ");

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#16223a",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "16px 8px",
        fontFamily: "'Helvetica Neue', 'Hiragino Sans', 'Noto Sans JP', sans-serif",
        color: "#eef3f9",
        userSelect: "none",
      }}
    >
      <h1
        style={{
          fontSize: "16px",
          fontWeight: 700,
          letterSpacing: "0.03em",
          margin: "0 0 12px 0",
          color: "#eef3f9",
          textAlign: "center",
        }}
      >
        ソフトテニス 作戦ボード
      </h1>

      {/* モード切替 */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "10px" }}>
        {[
          { key: "move", label: "コマ移動" },
          { key: "pen", label: "ペン" },
          { key: "eraser", label: "消しゴム" },
        ].map((m) => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            style={{
              padding: "6px 14px",
              borderRadius: "999px",
              border: mode === m.key ? "1.5px solid #a78bfa" : "1.5px solid #31445e",
              background: mode === m.key ? "rgba(167,139,250,0.18)" : "#1f2f47",
              color: mode === m.key ? "#c4b5fd" : "#93a9c2",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* ペンの色 */}
      {mode === "pen" && (
        <div style={{ display: "flex", gap: "8px", marginBottom: "12px", alignItems: "center" }}>
          {PEN_COLORS.map((c) => (
            <button
              key={c.key}
              onClick={() => setPenColor(c.hex)}
              style={{
                width: "26px",
                height: "26px",
                borderRadius: "50%",
                background: c.hex,
                border: penColor === c.hex ? "2.5px solid #eef3f9" : "2px solid #31445e",
                cursor: "pointer",
              }}
              aria-label={c.key}
            />
          ))}
        </div>
      )}

      {/* コート */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        style={{
          width: "100%", maxWidth: "320px",
          touchAction: "none",
          filter: "drop-shadow(0 4px 20px rgba(0,0,0,0.4))",
          cursor: mode === "move" ? "default" : "crosshair",
        }}
        onMouseDown={handleSvgDown}
        onMouseMove={handleSvgMove}
        onMouseUp={handleSvgUp}
        onMouseLeave={handleSvgUp}
        onTouchStart={handleSvgDown}
        onTouchMove={handleSvgMove}
        onTouchEnd={handleSvgUp}
      >
        <defs>
          <linearGradient id="courtGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3a7d5c" />
            <stop offset="50%" stopColor="#2d6a4f" />
            <stop offset="100%" stopColor="#245a42" />
          </linearGradient>
        </defs>
        <rect x={DRAW_X} y={DRAW_Y} width={DRAW_W} height={DRAW_H} rx={4} fill="url(#courtGrad)" />

        {courtLine(0, 0, COURT.width, 0)}
        {courtLine(0, FULL_LENGTH, COURT.width, FULL_LENGTH)}
        <line x1={toSvgX(-0.3)} y1={toSvgY(COURT.halfLength)} x2={toSvgX(COURT.width + 0.3)} y2={toSvgY(COURT.halfLength)} stroke="#fff" strokeWidth={3} strokeOpacity={0.9} />
        <text x={toSvgX(COURT.width + 0.3) + 4} y={toSvgY(COURT.halfLength) + 4} fill="#c9d6e3" fontSize="10">ネット</text>
        {courtLine(COURT.sideMargin, COURT.halfLength - COURT.serviceLine, COURT.width - COURT.sideMargin, COURT.halfLength - COURT.serviceLine)}
        {courtLine(COURT.sideMargin, COURT.halfLength + COURT.serviceLine, COURT.width - COURT.sideMargin, COURT.halfLength + COURT.serviceLine)}
        {courtLine(0, 0, 0, FULL_LENGTH)}
        {courtLine(COURT.width, 0, COURT.width, FULL_LENGTH)}
        {courtLine(COURT.sideMargin, 0, COURT.sideMargin, FULL_LENGTH)}
        {courtLine(COURT.width - COURT.sideMargin, 0, COURT.width - COURT.sideMargin, FULL_LENGTH)}
        {courtLine(COURT.centerServiceX, COURT.halfLength - COURT.serviceLine, COURT.centerServiceX, COURT.halfLength)}
        {courtLine(COURT.centerServiceX, COURT.halfLength, COURT.centerServiceX, COURT.halfLength + COURT.serviceLine)}

        <text x={toSvgX(COURT.centerServiceX)} y={DRAW_Y - 6} textAnchor="middle" fill="#c9d6e3" fontSize="11">相手コート（奥）</text>
        <text x={toSvgX(COURT.centerServiceX)} y={DRAW_Y + DRAW_H + 16} textAnchor="middle" fill="#c9d6e3" fontSize="11">自分コート（手前）</text>

        {/* 確定済みの描画 */}
        {strokes.map((s, i) => (
          <path key={i} d={strokeToPath(s.points)} stroke={s.color} strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {/* 描画中のストローク */}
        {liveStroke && (
          <path d={strokeToPath(liveStroke.points)} stroke={liveStroke.color} strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        )}

        {/* コマ */}
        {Object.entries(pieces).map(([key, pos]) => {
          const info = PIECE_INFO[key];
          return (
            <g
              key={key}
              style={{ pointerEvents: mode === "move" ? "auto" : "none", cursor: mode === "move" ? (dragPieceRef.current === key ? "grabbing" : "grab") : "default" }}
              onMouseDown={handlePieceDown(key)}
              onTouchStart={handlePieceDown(key)}
            >
              <circle cx={toSvgX(pos.x)} cy={toSvgY(pos.y)} r={16} fill="transparent" />
              <circle cx={toSvgX(pos.x)} cy={toSvgY(pos.y)} r={10} fill={info.color} fillOpacity={0.9} stroke="#fff" strokeWidth={1.8} />
              <text x={toSvgX(pos.x)} y={toSvgY(pos.y) + 22} textAnchor="middle" fill={info.color} fontSize="10" fontWeight="bold">{info.label}</text>
            </g>
          );
        })}
      </svg>

      {/* 下部コントロール */}
      <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap", justifyContent: "center" }}>
        <button onClick={undoLastStroke} style={btnStyle}>1つ戻す</button>
        <button onClick={clearStrokes} style={btnStyle}>描画を消す</button>
        <button onClick={resetPieces} style={btnStyle}>コマをリセット</button>
      </div>

      <p style={{ fontSize: "10px", color: "#93a9c2", marginTop: "10px", textAlign: "center", maxWidth: "320px", lineHeight: 1.5 }}>
        「コマ移動」で4つの磁石を自由に配置。「ペン」で自由に書き込み、「消しゴム」で書いた線を消せます。
      </p>
    </div>
  );
}

const btnStyle = {
  padding: "6px 14px",
  borderRadius: "999px",
  border: "1.5px solid #31445e",
  background: "#1f2f47",
  color: "#93a9c2",
  fontSize: "11px",
  fontWeight: 700,
  cursor: "pointer",
};

window.TacticsBoard = TacticsBoard;

ReactDOM.createRoot(
  document.getElementById("root")
).render(
  <TacticsBoard />
);
