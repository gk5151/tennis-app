const { useState, useRef, useCallback, useEffect } = React;

const STORAGE_KEY = "softtennis_practice_planner_v2";

const NOTE_COLORS = [
  { key: "yellow", hex: "#fef08a" },
  { key: "pink", hex: "#ffb3d1" },
  { key: "blue", hex: "#a8d8ff" },
  { key: "green", hex: "#b8f2c9" },
];

const DAY_START_HOUR = 8;
const DAY_END_HOUR = 20;
const PX_PER_MIN = 1;
const TIMELINE_HEIGHT = (DAY_END_HOUR - DAY_START_HOUR) * 60 * PX_PER_MIN;

const uid = () => Math.random().toString(36).slice(2, 10);

const rotationFor = (id) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 1000;
  return (h % 7) - 3; // -3〜3度
};

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const minutesToClock = (startMinutes) => {
  const total = DAY_START_HOUR * 60 + startMinutes;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const clockToMinutes = (clock) => {
  const [h, m] = clock.split(":").map((v) => parseInt(v, 10) || 0);
  return Math.max(0, h * 60 + m - DAY_START_HOUR * 60);
};

function PracticePlanner() {
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("library"); // 'library' | 'schedule'

  const [notes, setNotes] = useState([]); // {id, text, minutes, color}
  const [schedule, setSchedule] = useState([]); // {id, text, minutes, color, startMinutes}
  const [savedSchedules, setSavedSchedules] = useState([]); // {id, name, items}

  const [newText, setNewText] = useState("");
  const [newMinutes, setNewMinutes] = useState("");
  const [newColor, setNewColor] = useState(NOTE_COLORS[0].hex);
  const [colorFilter, setColorFilter] = useState(null);

  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [editMinutes, setEditMinutes] = useState("");
  const [editColor, setEditColor] = useState("");

  const [targetMinutes, setTargetMinutes] = useState("90");
  const [savingName, setSavingName] = useState(false);
  const [nameInput, setNameInput] = useState("");

  const saveTimer = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(STORAGE_KEY, false);
        if (res && res.value) {
          const data = JSON.parse(res.value);
          if (data.notes) setNotes(data.notes);
          if (data.schedule) setSchedule(data.schedule);
          if (data.savedSchedules) setSavedSchedules(data.savedSchedules);
        }
      } catch (e) {
        // 初回は保存データが無いので無視
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
        // 保存失敗時も操作は継続
      }
    }, 300);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    persist({ notes, schedule, savedSchedules });
  }, [loaded, notes, schedule, savedSchedules, persist]);

  // --- 付箋（練習メニュー） ---
  const addNote = () => {
    if (!newText.trim()) return;
    setNotes((prev) => [
      ...prev,
      { id: uid(), text: newText.trim(), minutes: newMinutes ? parseInt(newMinutes, 10) : null, color: newColor },
    ]);
    setNewText("");
    setNewMinutes("");
  };

  const deleteNote = (id) => setNotes((prev) => prev.filter((n) => n.id !== id));

  const startEditNote = (n) => {
    setEditingId(n.id);
    setEditText(n.text);
    setEditMinutes(n.minutes ? String(n.minutes) : "");
    setEditColor(n.color);
  };

  const saveEditNote = (id) => {
    setNotes((prev) =>
      prev.map((n) =>
        n.id === id
          ? { ...n, text: editText.trim() || n.text, minutes: editMinutes ? parseInt(editMinutes, 10) : null, color: editColor }
          : n
      )
    );
    setEditingId(null);
  };

  const filteredNotes = colorFilter ? notes.filter((n) => n.color === colorFilter) : notes;

  // --- スケジュール（タイムライン） ---
  const nextStartMinutes = () => {
    if (schedule.length === 0) return 0;
    const last = schedule.reduce((a, b) => (a.startMinutes > b.startMinutes ? a : b));
    return Math.min(TIMELINE_HEIGHT, last.startMinutes + (last.minutes || 30));
  };

  const addToSchedule = (note) => {
    setSchedule((prev) => [
      ...prev,
      { id: uid(), text: note.text, minutes: note.minutes || 30, color: note.color, startMinutes: nextStartMinutes() },
    ]);
  };

  const removeFromSchedule = (id) => setSchedule((prev) => prev.filter((s) => s.id !== id));

  const updateScheduleItem = (id, patch) => {
    setSchedule((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const clearSchedule = () => setSchedule([]);

  const suggestSchedule = () => {
    if (notes.length === 0) return;
    const target = parseInt(targetMinutes, 10) || 0;
    const pool = shuffle(notes);
    const hasMinutes = pool.some((n) => n.minutes);
    let picked = [];
    if (hasMinutes && target > 0) {
      let total = 0;
      for (const n of pool) {
        const m = n.minutes || 10;
        if (total + m > target + 10 && picked.length > 0) continue;
        picked.push(n);
        total += m;
        if (total >= target) break;
      }
    } else {
      picked = pool.slice(0, Math.min(5, pool.length));
    }
    let cursor = 0;
    const items = picked.map((n) => {
      const m = n.minutes || 30;
      const item = { id: uid(), text: n.text, minutes: m, color: n.color, startMinutes: cursor };
      cursor += m;
      return item;
    });
    setSchedule(items);
  };

  const totalMinutes = schedule.reduce((sum, s) => sum + (s.minutes || 0), 0);

  const startSaveSchedule = () => {
    setNameInput(`練習メニュー ${new Date().toLocaleDateString("ja-JP")}`);
    setSavingName(true);
  };

  const confirmSaveSchedule = () => {
    if (!nameInput.trim() || schedule.length === 0) {
      setSavingName(false);
      return;
    }
    setSavedSchedules((prev) => [...prev, { id: uid(), name: nameInput.trim(), items: schedule }]);
    setSavingName(false);
  };

  const loadSchedule = (s) => setSchedule(s.items.map((it) => ({ ...it, id: uid() })));
  const deleteSavedSchedule = (id) => setSavedSchedules((prev) => prev.filter((s) => s.id !== id));

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
        練習メニュー プランナー
      </h1>

      <div style={{ display: "flex", gap: "6px", marginBottom: "16px" }}>
        {[
          { key: "library", label: "付箋一覧" },
          { key: "schedule", label: "スケジュール" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "6px 14px",
              borderRadius: "999px",
              border: tab === t.key ? "1.5px solid #a78bfa" : "1.5px solid #31445e",
              background: tab === t.key ? "rgba(167,139,250,0.18)" : "#1f2f47",
              color: tab === t.key ? "#c4b5fd" : "#93a9c2",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ width: "100%", maxWidth: "380px" }}>
        {tab === "library" && (
          <LibraryTab
            notes={filteredNotes}
            allNotes={notes}
            colorFilter={colorFilter}
            setColorFilter={setColorFilter}
            newText={newText}
            newMinutes={newMinutes}
            newColor={newColor}
            setNewText={setNewText}
            setNewMinutes={setNewMinutes}
            setNewColor={setNewColor}
            addNote={addNote}
            deleteNote={deleteNote}
            addToSchedule={addToSchedule}
            editingId={editingId}
            editText={editText}
            editMinutes={editMinutes}
            editColor={editColor}
            setEditText={setEditText}
            setEditMinutes={setEditMinutes}
            setEditColor={setEditColor}
            startEditNote={startEditNote}
            saveEditNote={saveEditNote}
            cancelEditNote={() => setEditingId(null)}
          />
        )}

        {tab === "schedule" && (
          <ScheduleTab
            notes={filteredNotes}
            colorFilter={colorFilter}
            setColorFilter={setColorFilter}
            schedule={schedule}
            totalMinutes={totalMinutes}
            targetMinutes={targetMinutes}
            setTargetMinutes={setTargetMinutes}
            addToSchedule={addToSchedule}
            removeFromSchedule={removeFromSchedule}
            updateScheduleItem={updateScheduleItem}
            clearSchedule={clearSchedule}
            suggestSchedule={suggestSchedule}
            savingName={savingName}
            nameInput={nameInput}
            setNameInput={setNameInput}
            startSaveSchedule={startSaveSchedule}
            confirmSaveSchedule={confirmSaveSchedule}
            cancelSave={() => setSavingName(false)}
            savedSchedules={savedSchedules}
            loadSchedule={loadSchedule}
            deleteSavedSchedule={deleteSavedSchedule}
          />
        )}
      </div>
    </div>
  );
}

function ColorFilterRow({ colorFilter, setColorFilter }) {
  return (
    <div style={{ display: "flex", gap: "6px", alignItems: "center", marginBottom: "12px", justifyContent: "center" }}>
      <span style={{ fontSize: "11px", color: "#93a9c2" }}>色で絞り込み:</span>
      <button
        onClick={() => setColorFilter(null)}
        style={{
          padding: "4px 10px",
          borderRadius: "999px",
          border: colorFilter === null ? "1.5px solid #a78bfa" : "1.5px solid #31445e",
          background: colorFilter === null ? "rgba(167,139,250,0.18)" : "#1f2f47",
          color: colorFilter === null ? "#c4b5fd" : "#93a9c2",
          fontSize: "11px",
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        すべて
      </button>
      {NOTE_COLORS.map((c) => (
        <button
          key={c.key}
          onClick={() => setColorFilter(c.hex)}
          style={{
            width: "20px",
            height: "20px",
            borderRadius: "50%",
            background: c.hex,
            border: colorFilter === c.hex ? "2.5px solid #eef3f9" : "2px solid #31445e",
            cursor: "pointer",
          }}
        />
      ))}
    </div>
  );
}

function StickyNote({ note, onDelete, onEdit, actionLabel, onAction }) {
  const rot = rotationFor(note.id);
  return (
    <div
      style={{
        position: "relative",
        background: note.color || "#fef08a",
        color: "#16223a",
        borderRadius: "6px",
        padding: "10px 12px 26px 12px",
        transform: `rotate(${rot}deg)`,
        boxShadow: "0 6px 14px rgba(0,0,0,0.3)",
        minHeight: "70px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <div style={{ fontSize: "13px", fontWeight: 700, lineHeight: 1.4, wordBreak: "break-word" }}>{note.text}</div>
      {note.minutes ? (
        <div style={{ fontSize: "11px", fontWeight: 700, opacity: 0.7, marginTop: "4px" }}>{note.minutes}分</div>
      ) : null}
      <div style={{ position: "absolute", bottom: "6px", right: "8px", display: "flex", gap: "6px" }}>
        {onAction && (
          <button onClick={onAction} style={noteBtnStyle} aria-label={actionLabel}>
            {actionLabel}
          </button>
        )}
        {onEdit && (
          <button onClick={onEdit} style={noteBtnStyle} aria-label="編集">
            ✎
          </button>
        )}
        {onDelete && (
          <button onClick={onDelete} style={noteBtnStyle} aria-label="削除">
            ×
          </button>
        )}
      </div>
    </div>
  );
}

function NoteEditor({ text, minutes, color, setText, setMinutes, setColor, onSave, onCancel }) {
  return (
    <div style={{ background: "#1f2f47", border: "1.5px solid #a78bfa", borderRadius: "8px", padding: "10px" }}>
      <input type="text" value={text} onChange={(e) => setText(e.target.value)} style={textInputStyle} />
      <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "8px" }}>
        <input type="number" min="0" placeholder="分" value={minutes} onChange={(e) => setMinutes(e.target.value)} style={{ ...textInputStyle, width: "60px" }} />
        <div style={{ display: "flex", gap: "6px" }}>
          {NOTE_COLORS.map((c) => (
            <button
              key={c.key}
              onClick={() => setColor(c.hex)}
              style={{
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                background: c.hex,
                border: color === c.hex ? "2.5px solid #eef3f9" : "2px solid #31445e",
                cursor: "pointer",
              }}
            />
          ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", marginTop: "8px" }}>
        <button onClick={onSave} style={secondaryBtn}>保存</button>
        <button onClick={onCancel} style={secondaryBtn}>取消</button>
      </div>
    </div>
  );
}

function LibraryTab({
  notes, colorFilter, setColorFilter, newText, newMinutes, newColor, setNewText, setNewMinutes, setNewColor,
  addNote, deleteNote, addToSchedule, editingId, editText, editMinutes, editColor,
  setEditText, setEditMinutes, setEditColor, startEditNote, saveEditNote, cancelEditNote,
}) {
  return (
    <div>
      <div style={{ background: "#1f2f47", border: "1px solid #31445e", borderRadius: "12px", padding: "12px", marginBottom: "14px" }}>
        <input
          type="text"
          placeholder="練習メニュー（例: サービス練習）"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          style={textInputStyle}
        />
        <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "8px" }}>
          <input
            type="number"
            min="0"
            placeholder="分"
            value={newMinutes}
            onChange={(e) => setNewMinutes(e.target.value)}
            style={{ ...textInputStyle, width: "70px" }}
          />
          <div style={{ display: "flex", gap: "6px" }}>
            {NOTE_COLORS.map((c) => (
              <button
                key={c.key}
                onClick={() => setNewColor(c.hex)}
                style={{
                  width: "22px",
                  height: "22px",
                  borderRadius: "50%",
                  background: c.hex,
                  border: newColor === c.hex ? "2.5px solid #eef3f9" : "2px solid #31445e",
                  cursor: "pointer",
                }}
              />
            ))}
          </div>
          <button onClick={addNote} style={{ ...primaryBtn, marginLeft: "auto", padding: "6px 14px" }}>
            追加
          </button>
        </div>
      </div>

      <ColorFilterRow colorFilter={colorFilter} setColorFilter={setColorFilter} />

      {notes.length === 0 ? (
        <p style={{ fontSize: "12px", color: "#93a9c2", textAlign: "center" }}>付箋がありません。</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          {notes.map((n) =>
            editingId === n.id ? (
              <NoteEditor
                key={n.id}
                text={editText}
                minutes={editMinutes}
                color={editColor}
                setText={setEditText}
                setMinutes={setEditMinutes}
                setColor={setEditColor}
                onSave={() => saveEditNote(n.id)}
                onCancel={cancelEditNote}
              />
            ) : (
              <StickyNote
                key={n.id}
                note={n}
                onDelete={() => deleteNote(n.id)}
                onEdit={() => startEditNote(n)}
                actionLabel="＋"
                onAction={() => addToSchedule(n)}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}

function Timeline({ schedule, updateScheduleItem, removeFromSchedule }) {
  const hours = [];
  for (let h = DAY_START_HOUR; h <= DAY_END_HOUR; h++) hours.push(h);

  return (
    <div style={{ background: "#1f2f47", border: "1px solid #31445e", borderRadius: "12px", padding: "10px", marginBottom: "16px" }}>
      <div style={{ position: "relative", height: `${TIMELINE_HEIGHT}px`, maxHeight: "480px", overflowY: "auto" }}>
        <div style={{ position: "relative", height: `${TIMELINE_HEIGHT}px` }}>
          {/* 目盛り */}
          {hours.map((h) => (
            <div key={h} style={{ position: "absolute", top: `${(h - DAY_START_HOUR) * 60 * PX_PER_MIN}px`, left: 0, right: 0, borderTop: "1px solid #31445e" }}>
              <span style={{ position: "absolute", top: "-8px", left: 0, fontSize: "10px", color: "#93a9c2", background: "#1f2f47", paddingRight: "4px" }}>
                {h}時
              </span>
            </div>
          ))}

          {/* 付箋ブロック */}
          {schedule.map((s) => (
            <div
              key={s.id}
              style={{
                position: "absolute",
                top: `${s.startMinutes * PX_PER_MIN}px`,
                left: "42px",
                right: "4px",
                minHeight: `${Math.max(24, (s.minutes || 30) * PX_PER_MIN)}px`,
                background: s.color,
                color: "#16223a",
                borderRadius: "6px",
                padding: "4px 8px",
                boxShadow: "0 3px 8px rgba(0,0,0,0.3)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                gap: "2px",
                boxSizing: "border-box",
              }}
            >
              <div style={{ fontSize: "12px", fontWeight: 700, wordBreak: "break-word" }}>{s.text}</div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <input
                  type="time"
                  value={minutesToClock(s.startMinutes)}
                  onChange={(e) => updateScheduleItem(s.id, { startMinutes: clockToMinutes(e.target.value) })}
                  style={miniInputStyle}
                />
                <input
                  type="number"
                  min="5"
                  value={s.minutes || ""}
                  onChange={(e) => updateScheduleItem(s.id, { minutes: parseInt(e.target.value, 10) || 0 })}
                  style={{ ...miniInputStyle, width: "44px" }}
                />
                <span style={{ fontSize: "10px" }}>分</span>
                <button onClick={() => removeFromSchedule(s.id)} style={{ ...noteBtnStyle, marginLeft: "auto" }}>×</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScheduleTab({
  notes, colorFilter, setColorFilter, schedule, totalMinutes, targetMinutes, setTargetMinutes,
  addToSchedule, removeFromSchedule, updateScheduleItem, clearSchedule, suggestSchedule,
  savingName, nameInput, setNameInput, startSaveSchedule, confirmSaveSchedule, cancelSave,
  savedSchedules, loadSchedule, deleteSavedSchedule,
}) {
  return (
    <div>
      <div style={{ background: "#1f2f47", border: "1px solid #31445e", borderRadius: "12px", padding: "12px", marginBottom: "14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
          <span style={{ fontSize: "12px", color: "#93a9c2" }}>目標時間</span>
          <input
            type="number"
            min="0"
            value={targetMinutes}
            onChange={(e) => setTargetMinutes(e.target.value)}
            style={{ ...textInputStyle, width: "60px" }}
          />
          <span style={{ fontSize: "12px", color: "#93a9c2" }}>分</span>
          <button onClick={suggestSchedule} style={{ ...primaryBtn, marginLeft: "auto", padding: "6px 12px", fontSize: "12px" }}>
            提案する
          </button>
        </div>
        <div style={{ fontSize: "12px", color: "#93a9c2" }}>
          合計 <span style={{ color: "#eef3f9", fontWeight: 700 }}>{totalMinutes}</span> 分（{schedule.length}項目）
        </div>
      </div>

      <Timeline schedule={schedule} updateScheduleItem={updateScheduleItem} removeFromSchedule={removeFromSchedule} />

      <div style={{ display: "flex", gap: "8px", justifyContent: "center", marginBottom: "18px", flexWrap: "wrap" }}>
        <button onClick={clearSchedule} style={secondaryBtn}>スケジュールを空にする</button>
        {!savingName ? (
          <button onClick={startSaveSchedule} style={secondaryBtn}>名前を付けて保存</button>
        ) : (
          <div style={{ display: "flex", gap: "6px", alignItems: "center", width: "100%" }}>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              style={{ ...textInputStyle, flex: 1 }}
            />
            <button onClick={confirmSaveSchedule} style={secondaryBtn}>保存</button>
            <button onClick={cancelSave} style={secondaryBtn}>取消</button>
          </div>
        )}
      </div>

      <ColorFilterRow colorFilter={colorFilter} setColorFilter={setColorFilter} />

      {notes.length > 0 && (
        <>
          <div style={{ fontSize: "12px", fontWeight: 700, color: "#a78bfa", marginBottom: "8px", textAlign: "center" }}>付箋から追加</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "18px" }}>
            {notes.map((n) => (
              <StickyNote key={n.id} note={n} actionLabel="＋" onAction={() => addToSchedule(n)} />
            ))}
          </div>
        </>
      )}

      {savedSchedules.length > 0 && (
        <>
          <div style={{ fontSize: "12px", fontWeight: 700, color: "#a78bfa", marginBottom: "8px", textAlign: "center" }}>保存済みスケジュール</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {savedSchedules.map((s) => (
              <div key={s.id} style={{ background: "#1f2f47", border: "1px solid #31445e", borderRadius: "10px", padding: "8px 12px", display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ flex: 1, fontSize: "12px" }}>
                  <div style={{ fontWeight: 700 }}>{s.name}</div>
                  <div style={{ color: "#93a9c2" }}>{s.items.length}項目</div>
                </div>
                <button onClick={() => loadSchedule(s)} style={secondaryBtn}>読み込む</button>
                <button onClick={() => deleteSavedSchedule(s.id)} style={secondaryBtn}>削除</button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const primaryBtn = {
  padding: "8px 18px",
  borderRadius: "999px",
  border: "1.5px solid #a78bfa",
  background: "rgba(167,139,250,0.18)",
  color: "#c4b5fd",
  fontSize: "13px",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryBtn = {
  padding: "6px 12px",
  borderRadius: "999px",
  border: "1.5px solid #31445e",
  background: "#16223a",
  color: "#93a9c2",
  fontSize: "11px",
  fontWeight: 700,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const noteBtnStyle = {
  border: "none",
  background: "rgba(22,34,58,0.15)",
  color: "#16223a",
  fontSize: "11px",
  fontWeight: 700,
  borderRadius: "999px",
  width: "20px",
  height: "20px",
  cursor: "pointer",
  lineHeight: 1,
};

const textInputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "8px 10px",
  borderRadius: "8px",
  border: "1px solid #31445e",
  background: "#16223a",
  color: "#eef3f9",
  fontSize: "13px",
  fontFamily: "inherit",
};

const miniInputStyle = {
  boxSizing: "border-box",
  padding: "2px 4px",
  borderRadius: "6px",
  border: "1px solid rgba(22,34,58,0.3)",
  background: "rgba(255,255,255,0.5)",
  color: "#16223a",
  fontSize: "10px",
  fontFamily: "inherit",
};

window.PracticePlanner = PracticePlanner;

ReactDOM.createRoot(
  document.getElementById("root")
).render(
  <PracticePlanner />
);

