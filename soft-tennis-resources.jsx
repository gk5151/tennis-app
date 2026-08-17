const { useState, useRef, useCallback, useEffect } = React;

const STORAGE_KEY = "softtennis_resources_v1";
const uid = () => Math.random().toString(36).slice(2, 10);

function ResourceNotebook() {
  const [loaded, setLoaded] = useState(false);
  const [resources, setResources] = useState([]); // {id, title, url, memo}

  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [memo, setMemo] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editMemo, setEditMemo] = useState("");

  const saveTimer = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(STORAGE_KEY, false);
        if (res && res.value) {
          const data = JSON.parse(res.value);
          if (data.resources) setResources(data.resources);
        }
      } catch (e) {
        // 初回起動時はデータが無いので無視
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
    persist({ resources });
  }, [loaded, resources, persist]);

  const addResource = () => {
    if (!title.trim() && !url.trim()) return;
    setResources((prev) => [
      ...prev,
      { id: uid(), title: title.trim() || url.trim(), url: url.trim(), memo: memo.trim() },
    ]);
    setTitle("");
    setUrl("");
    setMemo("");
  };

  const deleteResource = (id) => setResources((prev) => prev.filter((r) => r.id !== id));

  const startEdit = (r) => {
    setEditingId(r.id);
    setEditTitle(r.title);
    setEditUrl(r.url);
    setEditMemo(r.memo);
  };

  const saveEdit = (id) => {
    setResources((prev) =>
      prev.map((r) => (r.id === id ? { ...r, title: editTitle.trim() || editUrl.trim(), url: editUrl.trim(), memo: editMemo.trim() } : r))
    );
    setEditingId(null);
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
        資料・リンク集
      </h1>

      <div style={{ width: "100%", maxWidth: "380px" }}>
        <div style={{ background: "#1f2f47", border: "1px solid #31445e", borderRadius: "12px", padding: "12px", marginBottom: "16px" }}>
          <input type="text" placeholder="タイトル" value={title} onChange={(e) => setTitle(e.target.value)} style={textInputStyle} />
          <input type="text" placeholder="URL（https://...）" value={url} onChange={(e) => setUrl(e.target.value)} style={{ ...textInputStyle, marginTop: "8px" }} />
          <textarea
            placeholder="メモ"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={2}
            style={{ ...textInputStyle, marginTop: "8px", resize: "vertical" }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
            <button onClick={addResource} style={primaryBtn}>追加</button>
          </div>
        </div>

        {resources.length === 0 ? (
          <p style={{ fontSize: "12px", color: "#93a9c2", textAlign: "center" }}>まだ資料がありません。</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {resources.map((r) =>
              editingId === r.id ? (
                <div key={r.id} style={{ background: "#1f2f47", border: "1px solid #a78bfa", borderRadius: "10px", padding: "10px 12px" }}>
                  <input type="text" placeholder="タイトル" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} style={textInputStyle} />
                  <input type="text" placeholder="URL" value={editUrl} onChange={(e) => setEditUrl(e.target.value)} style={{ ...textInputStyle, marginTop: "8px" }} />
                  <textarea value={editMemo} onChange={(e) => setEditMemo(e.target.value)} rows={2} style={{ ...textInputStyle, marginTop: "8px", resize: "vertical" }} />
                  <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "8px" }}>
                    <button onClick={() => saveEdit(r.id)} style={secondaryBtn}>保存</button>
                    <button onClick={() => setEditingId(null)} style={secondaryBtn}>取消</button>
                  </div>
                </div>
              ) : (
                <div key={r.id} style={{ background: "#1f2f47", border: "1px solid #31445e", borderRadius: "10px", padding: "10px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {r.url ? (
                      <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ color: "#a78bfa", fontSize: "13px", fontWeight: 700, textDecoration: "none", flex: 1, wordBreak: "break-word" }}>
                        {r.title}
                      </a>
                    ) : (
                      <div style={{ color: "#eef3f9", fontSize: "13px", fontWeight: 700, flex: 1 }}>{r.title}</div>
                    )}
                    <button onClick={() => startEdit(r)} style={secondaryBtn}>編集</button>
                    <button onClick={() => deleteResource(r.id)} style={secondaryBtn}>削除</button>
                  </div>
                  {r.memo && <div style={{ fontSize: "12px", color: "#93a9c2", marginTop: "6px", lineHeight: 1.5 }}>{r.memo}</div>}
                </div>
              )
            )}
          </div>
        )}
      </div>
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

window.ResourceNotebook = ResourceNotebook;

ReactDOM.createRoot(
  document.getElementById("root")
).render(
  <ResourceNotebook />
);
