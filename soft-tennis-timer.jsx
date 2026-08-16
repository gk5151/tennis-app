import { useState, useRef, useEffect, useCallback } from "react";

const PRESETS = [
  { label: "1分", sec: 60 },
  { label: "1分30秒", sec: 90 },
  { label: "2分", sec: 120 },
  { label: "3分", sec: 180 },
  { label: "5分", sec: 300 },
];

const fmt = (totalSec) => {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

export default function SoftTennisTimer() {
  const [duration, setDuration] = useState(60);
  const [remaining, setRemaining] = useState(60);
  const [isRunning, setIsRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [customMin, setCustomMin] = useState("");
  const [customSec, setCustomSec] = useState("");

  const audioCtxRef = useRef(null);
  const intervalRef = useRef(null);

  const unlockAudio = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        audioCtxRef.current = new Ctx();
      }
      if (audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume();
      }
    } catch (e) {
      // Web Audio 非対応環境は無視
    }
  }, []);

  const playAlert = useCallback(() => {
    try {
      const ctx = audioCtxRef.current;
      if (ctx) {
        const now = ctx.currentTime;
        for (let i = 0; i < 3; i++) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.value = 880;
          gain.gain.setValueAtTime(0.0001, now + i * 0.4);
          gain.gain.exponentialRampToValueAtTime(0.35, now + i * 0.4 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.4 + 0.3);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.4);
          osc.stop(now + i * 0.4 + 0.35);
        }
      }
    } catch (e) {
      // 再生に失敗しても無視（バイブは別途動く）
    }
    if (navigator.vibrate) {
      navigator.vibrate([300, 150, 300, 150, 300]);
    }
  }, []);

  useEffect(() => {
    if (!isRunning) return;
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(intervalRef.current);
          setIsRunning(false);
          setFinished(true);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [isRunning]);

  // 時間になったら、止めるかリセットするまで音とバイブを繰り返す
  useEffect(() => {
    if (!finished) return;
    playAlert();
    const alarmInterval = setInterval(playAlert, 2000);
    return () => clearInterval(alarmInterval);
  }, [finished, playAlert]);

  const start = () => {
    unlockAudio();
    if (remaining <= 0) return;
    setFinished(false);
    setIsRunning(true);
  };

  const pause = () => setIsRunning(false);

  const resetToDuration = () => {
    setIsRunning(false);
    setFinished(false);
    setRemaining(duration);
  };

  const applyPreset = (sec) => {
    setIsRunning(false);
    setFinished(false);
    setDuration(sec);
    setRemaining(sec);
  };

  const applyCustom = () => {
    const m = parseInt(customMin, 10) || 0;
    const s = parseInt(customSec, 10) || 0;
    const total = clampInt(m * 60 + s, 1, 3599);
    setIsRunning(false);
    setFinished(false);
    setDuration(total);
    setRemaining(total);
  };

  const progress = duration > 0 ? (duration - remaining) / duration : 0;

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
          margin: "0 0 14px 0",
          color: "#eef3f9",
          textAlign: "center",
        }}
      >
        ソフトテニス タイマー
      </h1>

      {/* プリセット */}
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "center", marginBottom: "10px", maxWidth: "340px" }}>
        {PRESETS.map((p) => (
          <button
            key={p.sec}
            onClick={() => applyPreset(p.sec)}
            style={{
              padding: "6px 12px",
              borderRadius: "999px",
              border: duration === p.sec ? "1.5px solid #a78bfa" : "1.5px solid #31445e",
              background: duration === p.sec ? "rgba(167,139,250,0.18)" : "#1f2f47",
              color: duration === p.sec ? "#c4b5fd" : "#93a9c2",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* カスタム時間 */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "18px" }}>
        <input
          type="number"
          min="0"
          placeholder="分"
          value={customMin}
          onChange={(e) => setCustomMin(e.target.value)}
          style={{ width: "52px", padding: "6px 8px", borderRadius: "8px", border: "1px solid #31445e", background: "#1f2f47", color: "#eef3f9", fontSize: "13px", textAlign: "center" }}
        />
        <span style={{ color: "#93a9c2", fontSize: "13px" }}>分</span>
        <input
          type="number"
          min="0"
          max="59"
          placeholder="秒"
          value={customSec}
          onChange={(e) => setCustomSec(e.target.value)}
          style={{ width: "52px", padding: "6px 8px", borderRadius: "8px", border: "1px solid #31445e", background: "#1f2f47", color: "#eef3f9", fontSize: "13px", textAlign: "center" }}
        />
        <span style={{ color: "#93a9c2", fontSize: "13px" }}>秒</span>
        <button
          onClick={applyCustom}
          style={{
            padding: "6px 12px",
            borderRadius: "999px",
            border: "1.5px solid #31445e",
            background: "#1f2f47",
            color: "#93a9c2",
            fontSize: "12px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          設定
        </button>
      </div>

      {/* カウントダウン表示 */}
      <div
        style={{
          position: "relative",
          width: "260px",
          height: "260px",
          borderRadius: "50%",
          background: "#1f2f47",
          border: finished ? "4px solid #ffd166" : "4px solid #31445e",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "20px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
        }}
      >
        <svg width="260" height="260" style={{ position: "absolute", top: 0, left: 0, transform: "rotate(-90deg)" }}>
          <circle cx="130" cy="130" r="120" fill="none" stroke="#16223a" strokeWidth="10" />
          <circle
            cx="130"
            cy="130"
            r="120"
            fill="none"
            stroke={finished ? "#ffd166" : "#a78bfa"}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 120}
            strokeDashoffset={2 * Math.PI * 120 * (1 - progress)}
            style={{ transition: "stroke-dashoffset 1s linear" }}
          />
        </svg>
        <div style={{ fontSize: "48px", fontWeight: 800, color: finished ? "#ffd166" : "#eef3f9", fontFamily: "'Arial Black', sans-serif" }}>
          {fmt(remaining)}
        </div>
      </div>

      {finished && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            background: "rgba(255,209,102,0.15)",
            border: "1px solid #ffd166",
            color: "#ffd166",
            fontSize: "13px",
            fontWeight: 700,
            padding: "6px 10px 6px 18px",
            borderRadius: "999px",
            marginBottom: "16px",
          }}
        >
          時間です
          <button
            onClick={() => setFinished(false)}
            style={{
              padding: "4px 12px",
              borderRadius: "999px",
              border: "1px solid #ffd166",
              background: "transparent",
              color: "#ffd166",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            止める
          </button>
        </div>
      )}

      {/* 操作ボタン */}
      <div style={{ display: "flex", gap: "10px" }}>
        {!isRunning ? (
          <button onClick={start} style={primaryBtn}>スタート</button>
        ) : (
          <button onClick={pause} style={primaryBtn}>一時停止</button>
        )}
        <button onClick={resetToDuration} style={secondaryBtn}>リセット</button>
      </div>

      <p style={{ fontSize: "10px", color: "#93a9c2", marginTop: "16px", textAlign: "center", maxWidth: "320px", lineHeight: 1.5 }}>
        時間になると音とバイブでお知らせします。iPhoneのSafariはバイブ非対応、マナーモード中は音も鳴らない場合があります。その場合は画面の表示でご確認ください。
      </p>
    </div>
  );
}

function clampInt(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

const primaryBtn = {
  padding: "10px 26px",
  borderRadius: "999px",
  border: "1.5px solid #a78bfa",
  background: "rgba(167,139,250,0.18)",
  color: "#c4b5fd",
  fontSize: "14px",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryBtn = {
  padding: "10px 22px",
  borderRadius: "999px",
  border: "1.5px solid #31445e",
  background: "#1f2f47",
  color: "#93a9c2",
  fontSize: "14px",
  fontWeight: 700,
  cursor: "pointer",
};

ReactDOM.createRoot(document.getElementById("root")).render(<SoftTennisPositioning />);
