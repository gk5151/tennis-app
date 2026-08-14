// soft-tennis-positioning.jsx
// ブラウザ上の Babel + UMD React 用：import/export は使わず、React のグローバルを利用します。
const { useState, useRef, useCallback, useEffect } = React;

// ソフトテニスコート寸法 (メートル) ― テニスと同一サイズ
const COURT = {
  width: 10.97,        // ダブルス幅
  halfLength: 11.885,  // ネットからベースラインまで
  serviceLine: 6.40,   // ネットからサービスラインまで
  singlesWidth: 8.23,  // シングルス幅
  sideMargin: (10.97 - 8.23) / 2, // ダブルスアレー幅
  centerServiceX: 10.97 / 2,
};
const FULL_LENGTH = COURT.halfLength * 2; // 23.77

// --- 実際のコート比率で描画エリアを算出 ---
const PADDING = 20;
const TOP_LABEL_SPACE = 14;
const BOTTOM_LABEL_SPACE = 18;
const DRAW_W = 280;
const DRAW_H = DRAW_W * (FULL_LENGTH / COURT.width); // 実寸比率 (10.97:23.77)
const VIEW_WIDTH = DRAW_W + PADDING * 2;
const VIEW_HEIGHT = DRAW_H + PADDING * 2 + TOP_LABEL_SPACE + BOTTOM_LABEL_SPACE;
const DRAW_X = PADDING;
const DRAW_Y = PADDING + TOP_LABEL_SPACE;

const STRAIGHT_SHIFT_AMOUNT = 1.0; // ストレート展開の時、両前衛を打点と逆サイドへずらす量

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function SoftTennisPositioning() {
  const [hitX, setHitX] = useState(COURT.width / 2);
  const [hitY, setHitY] = useState(3.0);
  const [maxAngle, setMaxAngle] = useState(13);
  const [straightMode, setStraightMode] = useState(false); // false: 通常(クロス) / true: ストレート展開
  const [frontNetDist, setFrontNetDist] = useState(4.0); // 自陣・相手陣の前衛に共通のネット距離（上下スライダーで調整）

  // 前衛・後衛はドラッグで個別に上書きできる。打点(相手後衛)を動かす・スライダーを操作すると
  // 上書きは解除され、条件に従った位置に戻ってから再度好きな位置へドラッグできる。
  const [frontOverride, setFrontOverride] = useState(null);     // 自分前衛
  const [oppFrontOverride, setOppFrontOverride] = useState(null); // 相手前衛
  const [backOverride, setBackOverride] = useState(null);       // 自分後衛

  const [dragTarget, setDragTarget] = useState(null); // 'ball' | 'front' | 'opp' | 'back' | null
  const isDragging = dragTarget !== null;
  const svgRef = useRef(null);

  const toSvgX = useCallback((m) => DRAW_X + (m / COURT.width) * DRAW_W, []);
  const toSvgY = useCallback((m) => DRAW_Y + (m / FULL_LENGTH) * DRAW_H, []);

  // ポインタ位置 → コート座標(m)。クランプはせず生の値を返す
  const rawPointerPos = useCallback((e) => {
    const svg = svgRef.current;
    if (!svg) return { x: hitX, y: hitY };
    const rect = svg.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const svgX = ((clientX - rect.left) / rect.width) * VIEW_WIDTH;
    const svgY = ((clientY - rect.top) / rect.height) * VIEW_HEIGHT;
    const mx = ((svgX - DRAW_X) / DRAW_W) * COURT.width;
    const my = ((svgY - DRAW_Y) / DRAW_H) * FULL_LENGTH;
    return { x: mx, y: my };
  }, [hitX, hitY]);

  // それぞれの駒ごとの可動範囲
  const clampBall = useCallback(
    (p) => ({ x: clamp(p.x, 0.3, COURT.width - 0.3), y: clamp(p.y, 0, COURT.halfLength - 0.3) }),
    []
  );
  const clampFront = useCallback(
    (p) => ({ x: clamp(p.x, 0.2, COURT.width - 0.2), y: clamp(p.y, COURT.halfLength + 0.15, FULL_LENGTH - 0.1) }),
    []
  );
  const clampOppFront = useCallback(
    (p) => ({ x: clamp(p.x, 0.2, COURT.width - 0.2), y: clamp(p.y, 0.1, COURT.halfLength - 0.15) }),
    []
  );
  const clampBack = useCallback(
    (p) => ({ x: clamp(p.x, 0.2, COURT.width - 0.2), y: clamp(p.y, COURT.halfLength + 0.15, FULL_LENGTH + 0.3) }),
    []
  );

  const calcTriangle = useCallback(() => {
    const baseY = FULL_LENGTH;
    const baseMidX = COURT.width / 2;
    const dx = baseMidX - hitX;
    const dy = baseY - hitY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxRad = (maxAngle * Math.PI) / 180;
    const halfBase = dist * Math.tan(maxRad);

    let baseLeftX = baseMidX - halfBase;
    let baseRightX = baseMidX + halfBase;

    const points = [];
    points.push({ x: hitX, y: hitY });

    if (baseLeftX < 0) {
      const t = (0 - hitX) / (baseLeftX - hitX);
      const clipY = hitY + t * (baseY - hitY);
      points.push({ x: 0, y: clipY });
      points.push({ x: 0, y: baseY });
      baseLeftX = 0;
    } else {
      points.push({ x: baseLeftX, y: baseY });
    }

    if (baseRightX > COURT.width) {
      points.push({ x: COURT.width, y: baseY });
      const t = (COURT.width - hitX) / (baseRightX - hitX);
      const clipY = hitY + t * (baseY - hitY);
      points.push({ x: COURT.width, y: clipY });
      baseRightX = COURT.width;
    } else {
      points.push({ x: baseRightX, y: baseY });
    }

    return { points, baseMidX, baseLeftX, baseRightX };
  }, [hitX, hitY, maxAngle]);

  const triangle = calcTriangle();

  const centerMarkX = COURT.width / 2;
  const centerMarkY = FULL_LENGTH;

  const posOnLine = useCallback((fromX, fromY, toX, toY, atY) => {
    const dy = toY - fromY;
    if (dy === 0) return toX;
    const t = (atY - fromY) / dy;
    return fromX + t * (toX - fromX);
  }, []);

  // --- 自分後衛（自陣ベースライン上）
  const backSign = straightMode ? 1 : -1;
  const autoBackPlayerY = FULL_LENGTH;
  const autoBackPlayerX = clamp(
    centerMarkX + backSign * (hitX - centerMarkX),
    0.2,
    COURT.width - 0.2
  );
  const backPlayerX = backOverride ? backOverride.x : autoBackPlayerX;
  const backPlayerY = backOverride ? backOverride.y : autoBackPlayerY;

  // --- 自分前衛（ネットの自陣側）: 相手後衛（打点）と自陣センターマークを結ぶ線上の点 ---
  const autoFrontPlayerY = COURT.halfLength + frontNetDist;
  const autoFrontPlayerXBase = posOnLine(hitX, hitY, centerMarkX, centerMarkY, autoFrontPlayerY);

  // --- 相手前衛（ネットの相手陣側） ---
  const autoOppFrontPlayerY = COURT.halfLength - frontNetDist;
  const autoOppFrontPlayerXBase = posOnLine(backPlayerX, backPlayerY, centerMarkX, 0, autoOppFrontPlayerY);

  const straightShift = straightMode
    ? (hitX <= centerMarkX ? STRAIGHT_SHIFT_AMOUNT : -STRAIGHT_SHIFT_AMOUNT)
    : 0;

  const autoFrontPlayerX = clamp(autoFrontPlayerXBase + straightShift, 0.2, COURT.width - 0.2);
  const autoOppFrontPlayerX = clamp(autoOppFrontPlayerXBase + straightShift, 0.2, COURT.width - 0.2);

  const frontPlayerX = frontOverride ? frontOverride.x : autoFrontPlayerX;
  const frontPlayerY = frontOverride ? frontOverride.y : autoFrontPlayerY;
  const oppFrontPlayerX = oppFrontOverride ? oppFrontOverride.x : autoOppFrontPlayerX;
  const oppFrontPlayerY = oppFrontOverride ? oppFrontOverride.y : autoOppFrontPlayerY;

  const handleDragStart = useCallback((target) => (e) => {
    e.preventDefault();
    setDragTarget(target);
  }, []);

  const handlePointerMove = useCallback((e) => {
    if (!dragTarget) return;
    e.preventDefault();
    const raw = rawPointerPos(e);
    if (dragTarget === "ball") {
      const p = clampBall(raw);
      setHitX(p.x);
      setHitY(p.y);
      setFrontOverride(null);
      setOppFrontOverride(null);
      setBackOverride(null);
    } else if (dragTarget === "front") {
      setFrontOverride(clampFront(raw));
    } else if (dragTarget === "opp") {
      setOppFrontOverride(clampOppFront(raw));
    } else if (dragTarget === "back") {
      setBackOverride(clampBack(raw));
    }
  }, [dragTarget, rawPointerPos, clampBall, clampFront, clampOppFront, clampBack]);

  const handlePointerUp = useCallback(() => {
    setDragTarget(null);
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const preventScroll = (e) => {
      if (isDragging) e.preventDefault();
    };
    svg.addEventListener("touchmove", preventScroll, { passive: false });
    return () => svg.removeEventListener("touchmove", preventScroll);
  }, [isDragging]);

  // ドラッグ中はドキュメント全体でポインタ移動とアップを拾う
  useEffect(() => {
    const onMove = (e) => handlePointerMove(e);
    const onUp = () => handlePointerUp();
    if (dragTarget) {
      document.addEventListener('mousemove', onMove);
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('mouseup', onUp);
      document.addEventListener('touchend', onUp);
      return () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.removeEventListener('touchend', onUp);
      };
    }
  }, [dragTarget, handlePointerMove, handlePointerUp]);

  // スライダー処理
  const sliderRef = useRef(null);
  const [sliderDragging, setSliderDragging] = useState(false);

  const handleSliderInteraction = useCallback((e) => {
    const container = sliderRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const ratio = clamp((clientY - rect.top) / rect.height, 0, 1);
    const dist = 0.5 + ratio * 5.5;
    setFrontNetDist(Math.round(dist * 10) / 10);
    setFrontOverride(null);
    setOppFrontOverride(null);
    setBackOverride(null);
  }, []);

  useEffect(() => {
    const el = sliderRef.current;
    if (!el) return;
    const prevent = (e) => { e.preventDefault(); };
    el.addEventListener("touchmove", prevent, { passive: false });
    el.addEventListener("touchstart", prevent, { passive: false });
    return () => {
      el.removeEventListener("touchmove", prevent);
      el.removeEventListener("touchstart", prevent);
    };
  }, []);

  useEffect(() => {
    const onMove = (e) => {
      if (sliderDragging) handleSliderInteraction(e);
    };
    const onUp = () => setSliderDragging(false);
    if (sliderDragging) {
      document.addEventListener('mousemove', onMove);
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('mouseup', onUp);
      document.addEventListener('touchend', onUp);
      return () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.removeEventListener('touchend', onUp);
      };
    }
  }, [sliderDragging, handleSliderInteraction]);

  const courtLine = (x1, y1, x2, y2) => (
    React.createElement('line', {
      x1: toSvgX(x1), y1: toSvgY(y1),
      x2: toSvgX(x2), y2: toSvgY(y2),
      stroke: "rgba(255,255,255,0.85)",
      strokeWidth: 1.5
    })
  );

  const triPoints = triangle.points.map(p => `${toSvgX(p.x)},${toSvgY(p.y)}`).join(" ");

  const netPct = ((DRAW_Y + (COURT.halfLength / FULL_LENGTH) * DRAW_H) / VIEW_HEIGHT) * 100;
  const basePct = ((DRAW_Y + DRAW_H) / VIEW_HEIGHT) * 100;
  const sliderHeightPct = basePct - netPct;
  const thumbRatio = (frontNetDist - 0.5) / 5.5;

  return (
    <div style={{ minHeight: "100%", display: 'flex', gap: 16, alignItems: 'flex-start', color: '#eef3f9' }}>
      <div style={{ width: VIEW_WIDTH, background: '#1f2f47', border: '1px solid #31445e', borderRadius: 8, padding: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>前衛ポジショニング</h2>
          <div style={{ fontSize: 12, color: '#93a9c2' }}>打点: {hitX.toFixed(2)}m, {hitY.toFixed(2)}m</div>
        </div>

        <svg ref={svgRef} width={VIEW_WIDTH} height={VIEW_HEIGHT} style={{ touchAction: 'none', display: 'block', background: '#16223a', borderRadius: 6 }}>
          <rect x={DRAW_X} y={DRAW_Y} width={DRAW_W} height={DRAW_H} fill="#0f1b2a" rx={8} />

          {/* コートライン */}
          {courtLine(0, 0, COURT.width, 0)}
          {courtLine(0, FULL_LENGTH, COURT.width, FULL_LENGTH)}
          {/* ネット */}
          {courtLine(0, COURT.halfLength, COURT.width, COURT.halfLength)}

          {/* サービスライン */}
          {courtLine(0, COURT.serviceLine, COURT.width, COURT.serviceLine)}
          {courtLine(0, FULL_LENGTH - COURT.serviceLine, COURT.width, FULL_LENGTH - COURT.serviceLine)}

          {/* センターマーク */}
          <line x1={toSvgX(centerMarkX - 0.1)} y1={toSvgY(FULL_LENGTH)} x2={toSvgX(centerMarkX + 0.1)} y2={toSvgY(FULL_LENGTH)} stroke="#fff" strokeWidth={1.2} />

          {/* 到達エリアの三角形 */}
          <polygon points={triPoints} fill="rgba(255,209,102,0.10)" stroke="rgba(255,209,102,0.28)" strokeWidth={1.2} />

          {/* ボール（打点） */}
          <circle cx={toSvgX(hitX)} cy={toSvgY(hitY)} r={8} fill="#ffd166" stroke="#b87b00" strokeWidth={1} onMouseDown={handleDragStart('ball')} onTouchStart={handleDragStart('ball')} style={{ cursor: 'grab' }} />

          {/* 自分後衛 */}
          <circle cx={toSvgX(backPlayerX)} cy={toSvgY(backPlayerY)} r={7} fill="#93a9c2" stroke="#3b4f61" strokeWidth={1} onMouseDown={handleDragStart('back')} onTouchStart={handleDragStart('back')} style={{ cursor: 'grab' }} />

          {/* 自分前衛 */}
          <circle cx={toSvgX(frontPlayerX)} cy={toSvgY(frontPlayerY)} r={7} fill="#eef3f9" stroke="#31445e" strokeWidth={1} onMouseDown={handleDragStart('front')} onTouchStart={handleDragStart('front')} style={{ cursor: 'grab' }} />

          {/* 相手前衛 */}
          <circle cx={toSvgX(oppFrontPlayerX)} cy={toSvgY(oppFrontPlayerY)} r={7} fill="#ff8787" stroke="#7a3030" strokeWidth={1} onMouseDown={handleDragStart('opp')} onTouchStart={handleDragStart('opp')} style={{ cursor: 'grab' }} />

        </svg>

        <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
          <label style={{ fontSize: 12, color: '#93a9c2' }}>角度: </label>
          <input type="range" min={5} max={30} value={maxAngle} onChange={(e) => setMaxAngle(Number(e.target.value))} />
          <div style={{ fontSize: 12, width: 36, textAlign: 'right' }}>{maxAngle}°</div>

          <label style={{ marginLeft: 12, fontSize: 12 }}>
            <input type="checkbox" checked={straightMode} onChange={(e) => setStraightMode(e.target.checked)} /> ストレート
          </label>
        </div>
      </div>

      <div style={{ width: 120, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ background: '#1f2f47', border: '1px solid #31445e', borderRadius: 8, padding: 8 }}>
          <div style={{ fontSize: 12, color: '#93a9c2', marginBottom: 8 }}>前衛のネット距離</div>
          <div ref={sliderRef} onMouseDown={(e) => { setSliderDragging(true); handleSliderInteraction(e); }} onTouchStart={(e) => { setSliderDragging(true); handleSliderInteraction(e); }} style={{ height: VIEW_HEIGHT * ((sliderHeightPct) / 100), background: '#0f1b2a', borderRadius: 6, position: 'relative', touchAction: 'none' }}>
            <div style={{ position: 'absolute', left: 8, right: 8, top: 4, bottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#93a9c2', fontSize: 12 }}>{frontNetDist.toFixed(1)} m</div>
            <div style={{ position: 'absolute', left: 6, right: 6, top: 4 + (VIEW_HEIGHT * ((sliderHeightPct) / 100) - 8) * thumbRatio, height: 14, background: '#ffd166', borderRadius: 7 }} />
          </div>
        </div>

        <div style={{ background: '#1f2f47', border: '1px solid #31445e', borderRadius: 8, padding: 8, fontSize: 12 }}>
          <div style={{ color: '#93a9c2', marginBottom: 6 }}>説明</div>
          <div style={{ color: '#c9d6e3' }}>ボール・選手をドラッグして動かせます。角度やストレート切替で配置が変わります。</div>
        </div>
      </div>
    </div>
  );
}

const rootEl = document.getElementById("simulatorRoot");
if (rootEl) {
  const root = ReactDOM.createRoot(rootEl);
  root.render(React.createElement(SoftTennisPositioning));
}
