import { useState, useEffect, useCallback, useRef } from "react";

const STORAGE_KEY = "softtennis_tournament_v1";

const nextPow2 = (n) => {
  let p = 1;
  while (p < n) p *= 2;
  return p;
};

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const roundLabel = (roundIndex, totalRounds) => {
  const fromEnd = totalRounds - 1 - roundIndex;
  if (fromEnd === 0) return "決勝";
  if (fromEnd === 1) return "準決勝";
  if (fromEnd === 2) return "準々決勝";
  return `${roundIndex + 1}回戦`;
};

export default function TournamentBuilder() {
  const [loaded, setLoaded] = useState(false);
  const [stage, setStage] = useState("setup"); // 'setup' | 'result'
  const [numTeams, setNumTeams] = useState(4);
  const [names, setNames] = useState(["", "", "", ""]);
  const [format, setFormat] = useState("tournament"); // 'tournament' | 'roundrobin'
  const [teams, setTeams] = useState([]);
  const [results, setResults] = useState({}); // key -> { scoreA, scoreB, winner }
  const [rrOrder, setRrOrder] = useState([]); // 総当りの試合順（[[i,j], ...]）

  const saveTimer = useRef(null);

  // 起動時に保存データを読み込む
  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(STORAGE_KEY, false);
        if (res && res.value) {
          const data = JSON.parse(res.value);
          if (data.stage) setStage(data.stage);
          if (data.numTeams) setNumTeams(data.numTeams);
          if (data.names) setNames(data.names);
          if (data.format) setFormat(data.format);
          if (data.teams) setTeams(data.teams);
          if (data.results) setResults(data.results);
          if (data.rrOrder) setRrOrder(data.rrOrder);
        }
      } catch (e) {
        // 初回起動時はデータが無いのでそのまま
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const persist = useCallback((next) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await window.storage.set(STORAGE_KEY, JSON.stringify(next), false);
      } catch (e) {
        // 保存に失敗しても操作は継続できるようにする
      }
    }, 300);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    persist({ stage, numTeams, names, format, teams, results, rrOrder });
  }, [loaded, stage, numTeams, names, format, teams, results, rrOrder, persist]);

  const handleNumTeamsChange = (val) => {
    const n = Math.max(2, Math.min(32, val));
    setNumTeams(n);
    setNames((prev) => {
      const next = prev.slice(0, n);
      while (next.length < n) next.push("");
      return next;
    });
  };

  const handleNameChange = (i, val) => {
    setNames((prev) => {
      const next = [...prev];
      next[i] = val;
      return next;
    });
  };

  const createBracket = () => {
    const finalNames = names.map((n, i) => n.trim() || `チーム${i + 1}`);
    setResults({});
    if (format === "roundrobin") {
      setTeams(finalNames);
      const pairs = [];
      for (let i = 0; i < finalNames.length; i++) {
        for (let j = i + 1; j < finalNames.length; j++) {
          pairs.push([i, j]);
        }
      }
      setRrOrder(shuffle(pairs));
    } else {
      setTeams(shuffle(finalNames));
    }
    setStage("result");
  };

  const backToSetup = () => {
    setStage("setup");
  };

  const resetResultsOnly = () => {
    setResults({});
  };

  const setScore = (key, side, value) => {
    setResults((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || {}), [side === "A" ? "scoreA" : "scoreB"]: value },
    }));
  };

  const setWinner = (key, side) => {
    setResults((prev) => {
      const cur = prev[key] || {};
      return {
        ...prev,
        [key]: { ...cur, winner: cur.winner === side ? null : side },
      };
    });
  };

  if (!loaded) {
    return (
      <div style={{ minHeight: "100vh", background: "#16223a", display: "flex", alignItems: "center", justifyContent: "center", color: "#93a9c2", fontFamily: "'Helvetica Neue','Hiragino Sans','Noto Sans JP',sans-serif" }}>
        読み込み中…
      </div>
    );
  }

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
      }}
    >
      <h1 style={{ fontSize: "16px", fontWeight: 700, letterSpacing: "0.03em", margin: "0 0 14px 0", textAlign: "center" }}>
        部内戦 対戦表
      </h1>

      {stage === "setup" ? (
        <SetupView
          numTeams={numTeams}
          names={names}
          format={format}
          onNumTeamsChange={handleNumTeamsChange}
          onNameChange={handleNameChange}
          onFormatChange={setFormat}
          onCreate={createBracket}
        />
      ) : (
        <ResultView
          teams={teams}
          format={format}
          results={results}
          rrOrder={rrOrder}
          onSetScore={setScore}
          onSetWinner={setWinner}
          onBack={backToSetup}
          onResetResults={resetResultsOnly}
        />
      )}
    </div>
  );
}

function SetupView({ numTeams, names, format, onNumTeamsChange, onNameChange, onFormatChange, onCreate }) {
  return (
    <div style={{ width: "100%", maxWidth: "360px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px", justifyContent: "center" }}>
        <span style={{ fontSize: "13px", color: "#93a9c2" }}>ペア数</span>
        <button onClick={() => onNumTeamsChange(numTeams - 1)} style={smallBtn}>−</button>
        <span style={{ fontSize: "16px", fontWeight: 800, width: "28px", textAlign: "center" }}>{numTeams}</span>
        <button onClick={() => onNumTeamsChange(numTeams + 1)} style={smallBtn}>＋</button>
      </div>

      <div style={{ display: "flex", gap: "8px", justifyContent: "center", marginBottom: "16px" }}>
        {[
          { key: "tournament", label: "トーナメント" },
          { key: "roundrobin", label: "総当り" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => onFormatChange(f.key)}
            style={{
              padding: "7px 16px",
              borderRadius: "999px",
              border: format === f.key ? "1.5px solid #a78bfa" : "1.5px solid #31445e",
              background: format === f.key ? "rgba(167,139,250,0.18)" : "#1f2f47",
              color: format === f.key ? "#c4b5fd" : "#93a9c2",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div style={{ background: "#1f2f47", border: "1px solid #31445e", borderRadius: "12px", padding: "12px", marginBottom: "16px" }}>
        {names.map((n, i) => (
          <input
            key={i}
            type="text"
            placeholder={`チーム${i + 1}`}
            value={n}
            onChange={(e) => onNameChange(i, e.target.value)}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "8px 10px",
              borderRadius: "8px",
              border: "1px solid #31445e",
              background: "#16223a",
              color: "#eef3f9",
              fontSize: "13px",
              marginBottom: i === names.length - 1 ? 0 : "8px",
            }}
          />
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "center" }}>
        <button onClick={onCreate} style={primaryBtn}>
          {format === "tournament" ? "トーナメント表を作成" : "総当り表を作成"}
        </button>
      </div>
    </div>
  );
}

function ResultView({ teams, format, results, rrOrder, onSetScore, onSetWinner, onBack, onResetResults }) {
  return (
    <div style={{ width: "100%", maxWidth: "380px" }}>
      <div style={{ display: "flex", gap: "8px", justifyContent: "center", marginBottom: "16px" }}>
        <button onClick={onBack} style={secondaryBtn}>設定に戻る</button>
        <button onClick={onResetResults} style={secondaryBtn}>結果をリセット</button>
      </div>

      {format === "tournament" ? (
        <TournamentView teams={teams} results={results} onSetScore={onSetScore} onSetWinner={onSetWinner} />
      ) : (
        <RoundRobinView teams={teams} results={results} rrOrder={rrOrder} onSetScore={onSetScore} onSetWinner={onSetWinner} />
      )}
    </div>
  );
}

function buildBracket(teams, results) {
  const size = nextPow2(teams.length);
  let current = Array.from({ length: size }, (_, i) => (i < teams.length ? teams[i] : null));
  const rounds = [];
  let roundIndex = 0;
  while (current.length > 1) {
    const matches = [];
    const nextRound = [];
    for (let i = 0; i < current.length; i += 2) {
      const a = current[i];
      const b = current[i + 1];
      const key = `t-${roundIndex}-${i / 2}`;
      let winner = null;
      let scoreA = "";
      let scoreB = "";
      if (a && !b) winner = "A";
      else if (!a && b) winner = "B";
      else if (a && b) {
        const r = results[key];
        if (r) {
          winner = r.winner || null;
          scoreA = r.scoreA || "";
          scoreB = r.scoreB || "";
        }
      }
      matches.push({ key, a, b, winner, scoreA, scoreB, isBye: (a && !b) || (!a && b) });
      nextRound.push(winner === "A" ? a : winner === "B" ? b : null);
    }
    rounds.push(matches);
    current = nextRound;
    roundIndex++;
  }
  return rounds;
}

function TournamentView({ teams, results, onSetScore, onSetWinner }) {
  const rounds = buildBracket(teams, results);
  return (
    <div>
      {rounds.map((matches, ri) => (
        <div key={ri} style={{ marginBottom: "18px" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: "#a78bfa", marginBottom: "8px", textAlign: "center" }}>
            {roundLabel(ri, rounds.length)}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {matches.map((m) =>
              m.isBye ? (
                <div key={m.key} style={byeCardStyle}>
                  {m.a || m.b}（不戦勝）
                </div>
              ) : m.a && m.b ? (
                <MatchCard
                  key={m.key}
                  nameA={m.a}
                  nameB={m.b}
                  scoreA={m.scoreA}
                  scoreB={m.scoreB}
                  winner={m.winner}
                  onScoreChange={(side, v) => onSetScore(m.key, side, v)}
                  onWinnerToggle={(side) => onSetWinner(m.key, side)}
                />
              ) : (
                <div key={m.key} style={tbdCardStyle}>
                  未定
                </div>
              )
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function RoundRobinView({ teams, results, rrOrder, onSetScore, onSetWinner }) {
  const order = rrOrder && rrOrder.length ? rrOrder : (() => {
    const fallback = [];
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) fallback.push([i, j]);
    }
    return fallback;
  })();
  const pairs = order
    .filter(([i, j]) => teams[i] !== undefined && teams[j] !== undefined)
    .map(([i, j]) => ({ key: `r-${i}-${j}`, a: teams[i], b: teams[j] }));

  const wins = {};
  teams.forEach((t) => (wins[t] = 0));
  pairs.forEach((p) => {
    const r = results[p.key];
    if (r && r.winner === "A") wins[p.a] += 1;
    if (r && r.winner === "B") wins[p.b] += 1;
  });
  const standings = [...teams].sort((a, b) => wins[b] - wins[a]);

  return (
    <div>
      <div style={{ fontSize: "12px", fontWeight: 700, color: "#a78bfa", marginBottom: "8px", textAlign: "center" }}>
        対戦結果
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "18px" }}>
        {pairs.map((p) => {
          const r = results[p.key] || {};
          return (
            <MatchCard
              key={p.key}
              nameA={p.a}
              nameB={p.b}
              scoreA={r.scoreA || ""}
              scoreB={r.scoreB || ""}
              winner={r.winner || null}
              onScoreChange={(side, v) => onSetScore(p.key, side, v)}
              onWinnerToggle={(side) => onSetWinner(p.key, side)}
            />
          );
        })}
      </div>

      <div style={{ fontSize: "12px", fontWeight: 700, color: "#a78bfa", marginBottom: "8px", textAlign: "center" }}>
        順位（勝ち数順）
      </div>
      <div style={{ background: "#1f2f47", border: "1px solid #31445e", borderRadius: "12px", padding: "10px 14px" }}>
        {standings.map((t, i) => (
          <div key={t} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: i === standings.length - 1 ? "none" : "1px solid #31445e", fontSize: "13px" }}>
            <span>{i + 1}位　{t}</span>
            <span style={{ color: "#93a9c2" }}>{wins[t]}勝</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MatchCard({ nameA, nameB, scoreA, scoreB, winner, onScoreChange, onWinnerToggle }) {
  return (
    <div style={{ background: "#1f2f47", border: "1px solid #31445e", borderRadius: "12px", padding: "10px 12px", display: "flex", alignItems: "center", gap: "8px" }}>
      <NameButton name={nameA} isWinner={winner === "A"} onClick={() => onWinnerToggle("A")} />
      <input
        type="text"
        inputMode="numeric"
        value={scoreA}
        onChange={(e) => onScoreChange("A", e.target.value)}
        style={scoreInputStyle}
      />
      <span style={{ color: "#93a9c2", fontSize: "13px" }}>-</span>
      <input
        type="text"
        inputMode="numeric"
        value={scoreB}
        onChange={(e) => onScoreChange("B", e.target.value)}
        style={scoreInputStyle}
      />
      <NameButton name={nameB} isWinner={winner === "B"} onClick={() => onWinnerToggle("B")} />
    </div>
  );
}

function NameButton({ name, isWinner, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        minWidth: 0,
        padding: "6px 8px",
        borderRadius: "999px",
        border: isWinner ? "2px solid #ffd166" : "1.5px solid #31445e",
        background: isWinner ? "rgba(255,209,102,0.15)" : "transparent",
        color: isWinner ? "#ffd166" : "#eef3f9",
        fontSize: "12px",
        fontWeight: isWinner ? 800 : 500,
        cursor: "pointer",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {name}
    </button>
  );
}

const smallBtn = {
  width: "28px",
  height: "28px",
  borderRadius: "50%",
  border: "1.5px solid #31445e",
  background: "#1f2f47",
  color: "#eef3f9",
  fontSize: "14px",
  fontWeight: 700,
  cursor: "pointer",
};

const primaryBtn = {
  padding: "10px 22px",
  borderRadius: "999px",
  border: "1.5px solid #a78bfa",
  background: "rgba(167,139,250,0.18)",
  color: "#c4b5fd",
  fontSize: "14px",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryBtn = {
  padding: "7px 14px",
  borderRadius: "999px",
  border: "1.5px solid #31445e",
  background: "#1f2f47",
  color: "#93a9c2",
  fontSize: "12px",
  fontWeight: 700,
  cursor: "pointer",
};

const scoreInputStyle = {
  width: "34px",
  padding: "6px 0",
  borderRadius: "8px",
  border: "1px solid #31445e",
  background: "#16223a",
  color: "#eef3f9",
  fontSize: "13px",
  textAlign: "center",
};

const byeCardStyle = {
  background: "#1f2f47",
  border: "1px dashed #31445e",
  borderRadius: "12px",
  padding: "10px 12px",
  fontSize: "12px",
  color: "#93a9c2",
  textAlign: "center",
};

const tbdCardStyle = {
  background: "transparent",
  border: "1px dashed #31445e",
  borderRadius: "12px",
  padding: "10px 12px",
  fontSize: "12px",
  color: "#5a6b80",
  textAlign: "center",
};
