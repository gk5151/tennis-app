const FORMATS = {
  5: { majority: 3 },
  7: { majority: 4 },
  9: { majority: 5 },
};

const TEAM_COLORS = { A: "#1c64f2", B: "#2f9e44" };

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function SoftTennisScoreboard() {
  const [format, setFormat] = useState(5);
  const [gamesA, setGamesA] = useState(0);
  const [gamesB, setGamesB] = useState(0);
  const [pA, setPA] = useState(0);
  const [pB, setPB] = useState(0);
  const [advantage, setAdvantage] = useState(null); // null | 'A' | 'B'
  const [winner, setWinner] = useState(null); // null | 'A' | 'B'

  const majority = FORMATS[format].majority;
  const tieCount = majority - 1;
  const isFinalGame = !winner && gamesA === tieCount && gamesB === tieCount;
  const target = isFinalGame ? 7 : 4;
  const deuceAt = target - 1;
  const inDeuceZone = pA === deuceAt && pB === deuceAt;

  const resetMatch = useCallback((newFormat) => {
    setFormat(newFormat);
    setGamesA(0);
    setGamesB(0);
    setPA(0);
    setPB(0);
    setAdvantage(null);
    setWinner(null);
  }, []);

  const resetGamePoints = () => {
    setPA(0);
    setPB(0);
    setAdvantage(null);
  };

  const winGame = useCallback((side, currentGamesA, currentGamesB) => {
    const newGamesA = side === "A" ? currentGamesA + 1 : currentGamesA;
    const newGamesB = side === "B" ? currentGamesB + 1 : currentGamesB;
    setGamesA(newGamesA);
    setGamesB(newGamesB);
    setPA(0);
    setPB(0);
    setAdvantage(null);
    if (newGamesA >= majority) setWinner("A");
    else if (newGamesB >= majority) setWinner("B");
  }, [majority]);

  const incPoint = (side) => {
    if (winner) return;
    if (inDeuceZone) {
      if (advantage === null) {
        setAdvantage(side);
      } else if (advantage === side) {
        winGame(side, gamesA, gamesB);
      } else {
        setAdvantage(null);
      }
      return;
    }
    if (side === "A") {
      const next = pA + 1;
      if (next === target) {
        winGame("A", gamesA, gamesB);
      } else {
        setPA(next);
      }
    } else {
      const next = pB + 1;
      if (next === target) {
        winGame("B", gamesA, gamesB);
      } else {
        setPB(next);
      }
    }
  };

  const decPoint = (side) => {
    if (winner) return;
    if (inDeuceZone) {
      if (advantage === side) {
        setAdvantage(null);
      } else if (advantage === null) {
        if (side === "A") setPA((v) => Math.max(0, v - 1));
        else setPB((v) => Math.max(0, v - 1));
      } else {
        setAdvantage(null);
      }
      return;
    }
    if (side === "A") setPA((v) => Math.max(0, v - 1));
    else setPB((v) => Math.max(0, v - 1));
  };

  const adjustGames = (side, delta) => {
    let newGamesA = gamesA;
    let newGamesB = gamesB;
    if (side === "A") newGamesA = clamp(gamesA + delta, 0, majority);
    else newGamesB = clamp(gamesB + delta, 0, majority);
    setGamesA(newGamesA);
    setGamesB(newGamesB);
    setPA(0);
    setPB(0);
    setAdvantage(null);
    if (newGamesA >= majority) setWinner("A");
    else if (newGamesB >= majority) setWinner("B");
    else setWinner(null);
  };

  const pointDisplay = (side) => {
    if (inDeuceZone) {
      if (advantage === side) return "A";
      return "D";
    }
    return side === "A" ? pA : pB;
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0b0b10",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "16px 8px",
        fontFamily: "'Helvetica Neue', 'Hiragino Sans', 'Noto Sans JP', sans-serif",
        color: "#eef0f4",
        userSelect: "none",
      }}
    >
      <h1
        style={{
          fontSize: "16px",
          fontWeight: 700,
          letterSpacing: "0.03em",
          margin: "0 0 12px 0",
          color: "#eef0f4",
          textAlign: "center",
        }}
      >
        ソフトテニス スコアボード
      </h1>

      {/* マッチ形式選択 */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
        {[5, 7, 9].map((f) => (
          <button
            key={f}
            onClick={() => resetMatch(f)}
            style={{
              padding: "6px 16px",
              borderRadius: "999px",
              border: format === f ? "1.5px solid #a78bfa" : "1.5px solid #2a2a35",
              background: format === f ? "rgba(167,139,250,0.18)" : "#16161d",
              color: format === f ? "#c4b5fd" : "#8a8a99",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {f}ゲームマッチ
          </button>
        ))}
      </div>

      {isFinalGame && !winner && (
        <div
          style={{
            background: "rgba(255,209,102,0.15)",
            border: "1px solid #ffd166",
            color: "#ffd166",
            fontSize: "11px",
            fontWeight: 700,
            padding: "4px 14px",
            borderRadius: "999px",
            marginBottom: "12px",
          }}
        >
          ファイナルゲーム
        </div>
      )}

      {/* 盤面 */}
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "600px",
          background: "#000000",
          borderRadius: "16px",
          border: "1px solid #232330",
          padding: "20px 16px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
        }}
      >
        <div style={{ display: "flex", gap: "18px", alignItems: "flex-start", justifyContent: "center" }}>
          {["A", "B"].map((side, i) => (
            <div key={side} style={{ display: "flex", alignItems: "flex-start", gap: "18px" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#8a8a99" }}>
                  チーム{side === "A" ? "1" : "2"}
                </div>
                <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                  {side === "A" ? (
                    <>
                      <ScoreCard
                        value={pointDisplay(side)}
                        colorMain={TEAM_COLORS[side]}
                        onInc={() => incPoint(side)}
                        onDec={() => decPoint(side)}
                        fontSize="52px"
                        cardWidth="128px"
                        cardHeight="100px"
                        disabled={!!winner}
                      />
                      <ScoreCard
                        value={gamesA}
                        colorMain={TEAM_COLORS[side]}
                        onInc={() => adjustGames(side, 1)}
                        onDec={() => adjustGames(side, -1)}
                        fontSize="26px"
                        cardWidth="76px"
                        cardHeight="60px"
                        disabled={!!winner}
                      />
                    </>
                  ) : (
                    <>
                      <ScoreCard
                        value={gamesB}
                        colorMain={TEAM_COLORS[side]}
                        onInc={() => adjustGames(side, 1)}
                        onDec={() => adjustGames(side, -1)}
                        fontSize="26px"
                        cardWidth="76px"
                        cardHeight="60px"
                        disabled={!!winner}
                      />
                      <ScoreCard
                        value={pointDisplay(side)}
                        colorMain={TEAM_COLORS[side]}
                        onInc={() => incPoint(side)}
                        onDec={() => decPoint(side)}
                        fontSize="52px"
                        cardWidth="128px"
                        cardHeight="100px"
                        disabled={!!winner}
                      />
                    </>
                  )}
                </div>
              </div>
              {i === 0 && (
                <div style={{ width: "1px", alignSelf: "stretch", background: "#232330" }} />
              )}
            </div>
          ))}
        </div>

        {winner && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.82)",
              borderRadius: "16px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "14px",
            }}
          >
            <div style={{ fontSize: "18px", fontWeight: 800, color: "#ffd166" }}>
              チーム{winner === "A" ? "1" : "2"} の勝利
            </div>
            <button
              onClick={() => resetMatch(format)}
              style={{
                padding: "8px 20px",
                borderRadius: "999px",
                border: "1.5px solid #a78bfa",
                background: "rgba(167,139,250,0.18)",
                color: "#c4b5fd",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              次の試合へ
            </button>
          </div>
        )}
      </div>

      <button
        onClick={() => resetMatch(format)}
        style={{
          marginTop: "14px",
          padding: "6px 16px",
          borderRadius: "999px",
          border: "1.5px solid #2a2a35",
          background: "#16161d",
          color: "#8a8a99",
          fontSize: "11px",
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        試合をリセット
      </button>

      <p style={{ fontSize: "10px", color: "#5a5a68", marginTop: "10px", textAlign: "center", maxWidth: "480px", lineHeight: 1.5 }}>
        青がチーム1、緑がチーム2。大きいカードがポイント、小さいカードがゲーム。カードの上半分タップで+1、下半分タップで-1。
      </p>
    </div>
  );
}

function ScoreCard({ value, colorMain, onInc, onDec, fontSize, cardWidth, cardHeight, disabled }) {
  return (
    <div
      style={{
        position: "relative",
        width: cardWidth,
        height: cardHeight,
        background: "#f5f2ea",
        borderRadius: "12px",
        boxShadow: "0 4px 10px rgba(0,0,0,0.35)",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 6,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: "10px",
        }}
      >
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#d8d2c2" }} />
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#d8d2c2" }} />
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize,
          fontWeight: 900,
          color: colorMain,
          pointerEvents: "none",
          fontFamily: "'Arial Black', 'Helvetica Neue', sans-serif",
        }}
      >
        {value}
      </div>
      <button
        onClick={onInc}
        disabled={disabled}
        aria-label="増やす"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "55%",
          border: "none",
          background: "transparent",
          cursor: disabled ? "default" : "pointer",
        }}
      >
        <span style={{ position: "absolute", top: 4, left: "50%", transform: "translateX(-50%)", fontSize: 9, color: "#b8b0a0" }}>▲</span>
      </button>
      <button
        onClick={onDec}
        disabled={disabled}
        aria-label="減らす"
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "45%",
          border: "none",
          background: "transparent",
          cursor: disabled ? "default" : "pointer",
        }}
      >
        <span style={{ position: "absolute", bottom: 4, left: "50%", transform: "translateX(-50%)", fontSize: 9, color: "#b8b0a0" }}>▼</span>
      </button>
    </div>
  );
  window.SoftTennisScoreboard = SoftTennisScoreboard;
}
