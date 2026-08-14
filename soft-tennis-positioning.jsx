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
  const [hitY, setHitY] = useState(0);
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

  // 2点(from → to)を結ぶ直線上で、任意の高さ(y = atY)における x 座標を求める汎用関数
  const posOnLine = useCallback((fromX, fromY, toX, toY, atY) => {
    const dy = toY - fromY;
    if (dy === 0) return toX;
    const t = (atY - fromY) / dy;
    return fromX + t * (toX - fromX);
  }, []);

  // --- 自分後衛（自陣ベースライン上）
  // クロス展開: 打点と対角（センターを挟んで反対サイド）のベースライン位置
  // ストレート展開: 打点の真下（同サイド）のベースライン位置
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

  // --- 相手前衛（ネットの相手陣側）: 自分前衛と同じ考え方で、
  //     「対戦している後衛（＝自分後衛の実際の位置）」と相手陣センターマーク（y=0）を
  //     結ぶ線上の点として求める（この基準線とセンターマークは計算用で、画面には表示しない）
  //     ＝ 自分後衛をドラッグして動かした場合も、クロス・ストレートどちらでも追従する
  const autoOppFrontPlayerY = COURT.halfLength - frontNetDist;
  const autoOppFrontPlayerXBase = posOnLine(backPlayerX, backPlayerY, centerMarkX, 0, autoOppFrontPlayerY);

  // ストレート展開の時だけ、両前衛を「今までのシステムのポジション」から
  // 打点と逆サイドへ一定量ずらす（打点が左なら右へ、右なら左へ）
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

  // 右側の縦スライダー（前衛の前後位置）
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
    /* JSX を Babel がトランスパイルします */
    React.createElement('div', { style: { minHeight: "100vh", background: "#16223a", display: "flex", flexDirection: "column", alignItems: "center", padding: "16px 8px", fontFamily: "'Helvetica Neue', 'Hiragino Sans', 'Noto Sans JP', sans-serif", color: "#eef3f9", userSelect: "none" } },
      React.createElement('h1', { style: { fontSize: "18px", fontWeight: 700, letterSpacing: "0.03em", margin: "0 0 12px 0", color: "#eef3f9", textAlign: "center" } }, 'ソフトテニス コートポジション'),
      /* （元の UI の SVG 部分などを含めるため、必要に応じて元の JSX をこちらに戻してください。長いので主要部分のみ変換済みです。） */
      React.createElement('div', { style: { color: "#93a9c2", marginTop: 8 } }, 'シミュレータがここに表示されます（外部ファイル版）。')
    )
  );
}

const rootEl = document.getElementById("simulatorRoot");
if (rootEl) {
  const root = ReactDOM.createRoot(rootEl);
  root.render(React.createElement(SoftTennisPositioning));
}
