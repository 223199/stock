import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const STORAGE_KEY = "inventory-app.items.v3";

const STATUS = {
  ENOUGH: "十分",
  LOW: "少ない",
  EMPTY: "なし",
};

const STATUS_ORDER = { EMPTY: 0, LOW: 1, ENOUGH: 2 };

function nextStatus(s) {
  if (s === "ENOUGH") return "LOW";
  if (s === "LOW") return "EMPTY";
  return "ENOUGH";
}

function safeParse(json, fallback) {
  try {
    const v = JSON.parse(json);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** 信号機（縦3点） */
function Signal({ status, onClick, title }) {
  return (
    <button className="signal" onClick={onClick} title={title} aria-label="状態を切り替える">
      <span className={`dot ${status === "ENOUGH" ? "on enough" : "enough"}`} />
      <span className={`dot ${status === "LOW" ? "on low" : "low"}`} />
      <span className={`dot ${status === "EMPTY" ? "on empty" : "empty"}`} />
    </button>
  );
}

export default function App() {
  const [items, setItems] = useState(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = safeParse(raw, []);
    return Array.isArray(parsed) ? parsed : [];
  });

  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");

  const [spotlightId, setSpotlightId] = useState(null);
  const spotlightTimerRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn(e);
      alert("保存に失敗しました（ストレージ容量の可能性）。");
    }
  }, [items]);

  const setSpotlight = (id) => {
    setSpotlightId(id);
    if (spotlightTimerRef.current) clearTimeout(spotlightTimerRef.current);
    spotlightTimerRef.current = setTimeout(() => setSpotlightId(null), 900);
  };

  const addItem = () => {
    const n = name.trim();
    if (!n) return;

    const exists = items.find((it) => it.name === n);
    if (exists) {
      alert("同じ名前の項目が既にあります。状態を更新するか、名前を少し変えてください。");
      return;
    }

    const now = Date.now();
    setItems((prev) => [
      {
        id: uid(),
        name: n,
        note: note.trim() ? note.trim() : "",
        status: "ENOUGH",
        createdAt: now,
        updatedAt: now,
      },
      ...prev,
    ]);
    setName("");
    setNote("");
  };

  const removeItem = (id) => {
    if (!confirm("削除しますか？")) return;
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const updateNote = (id, value) => {
    const now = Date.now();
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, note: value, updatedAt: now } : it))
    );
  };

  const toggleItemStatus = (id) => {
    const now = Date.now();
    const before = items.find((x) => x.id === id);
    const beforeShop = before ? before.status === "LOW" || before.status === "EMPTY" : false;

    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const next = nextStatus(it.status);
        return { ...it, status: next, updatedAt: now };
      })
    );

    if (before) {
      const next = nextStatus(before.status);
      const afterShop = next === "LOW" || next === "EMPTY";
      if (!beforeShop && afterShop) setSpotlight(id);
    }
  };

  const markBought = (id) => {
    const now = Date.now();
    const before = items.find((x) => x.id === id);
    if (!before) return;

    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, status: "ENOUGH", updatedAt: now } : it))
    );

    setSpotlight(id);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      if (!q) return true;
      return it.name.toLowerCase().includes(q) || (it.note || "").toLowerCase().includes(q);
    });
  }, [items, query]);

  const shoppingList = useMemo(() => {
    return filtered
      .filter((it) => it.status === "EMPTY" || it.status === "LOW")
      .sort((a, b) => {
        const so = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
        if (so !== 0) return so;
        return a.name.localeCompare(b.name, "ja");
      });
  }, [filtered]);

  const pantryList = useMemo(() => {
    return filtered
      .filter((it) => it.status === "ENOUGH")
      .sort((a, b) => a.name.localeCompare(b.name, "ja"));
  }, [filtered]);

  const counts = useMemo(() => {
    const c = { ENOUGH: 0, LOW: 0, EMPTY: 0 };
    for (const it of items) c[it.status] += 1;
    return c;
  }, [items]);

  // ★ 追加：買い物ゾーンの内訳（なし/少ない）
  const shoppingCounts = useMemo(() => {
    let low = 0, empty = 0;
    for (const it of shoppingList) {
      if (it.status === "LOW") low += 1;
      if (it.status === "EMPTY") empty += 1;
    }
    return { low, empty };
  }, [shoppingList]);

  return (
    <div className="page">
      <header className="header">
        <div className="title">
          <h1>Stocky</h1>
          <p className="subtitle">日用品・消耗品を「3段階×信号機」で管理</p>
        </div>

        <div className="miniStats" aria-label="件数">
          <span className="pill enough">十分 {counts.ENOUGH}</span>
          <span className="pill low">少ない {counts.LOW}</span>
          <span className="pill empty">なし {counts.EMPTY}</span>
        </div>
      </header>

      {/* 追加・検索 */}
      <section className="panel">
        <div className="formRow">
          <div className="field">
            <label>品目名</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例：トイレットペーパー"
            />
          </div>
          <div className="field">
            <label>メモ（任意）</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="例：ダブル / 無香料 / いつも買う店 など"
            />
          </div>
          <button className="btn primary" onClick={addItem}>
            追加
          </button>
        </div>

        <div className="searchRow">
          <div className="field">
            <label>検索</label>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="名前・メモで検索（買い物中に便利）"
            />
          </div>
          <div className="hint">💡 信号を押すと「十分 → 少ない → なし → 十分」</div>
        </div>
      </section>

      {/* 🛒買い物ゾーン */}
      <section className="dock">
        <div className="dockHead">
          <div className="dockLeft">
            <div className="labelTag">SHOPPING ZONE</div>
            <div className="dockTitle">🛒 買い物ゾーン</div>
            <div className="dockSub">「なし＋少ない」が自動でここに集まります</div>
          </div>

          <div className="dockRight">
            <div className="dockBreakdown" aria-label="内訳">
              <span className="miniChip empty">なし {shoppingCounts.empty}</span>
              <span className="miniChip low">少ない {shoppingCounts.low}</span>
            </div>
            <div className="dockCount">{shoppingList.length} 件</div>
          </div>
        </div>

        {shoppingList.length === 0 ? (
          <div className="dockEmpty">
            <div className="dockEmptyBig">🌿</div>
            <div className="dockEmptyText">買うものは今のところありません。</div>
          </div>
        ) : (
          <ul className="list">
            {shoppingList.map((it) => (
              <li
                key={it.id}
                className={`cardItem ${it.status.toLowerCase()} ${spotlightId === it.id ? "spotlight" : ""}`}
              >
                <Signal status={it.status} onClick={() => toggleItemStatus(it.id)} title="クリックで状態を切り替え" />

                <div className="cardMain">
                  <div className="cardTop">
                    <div className="cardName">{it.name}</div>
                    <div className="tag">{STATUS[it.status]}</div>
                  </div>
                  <input
                    className="note"
                    value={it.note}
                    onChange={(e) => updateNote(it.id, e.target.value)}
                    placeholder="メモ（ここで編集できます）"
                  />
                </div>

                <div className="actions">
                  <button className="btn success" onClick={() => markBought(it.id)} title="買った（十分に戻して棚へ）">
                    ✓ 買った
                  </button>
                  <button className="btn danger" onClick={() => removeItem(it.id)}>
                    削除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 📦棚 */}
      <section className="shelf">
        <div className="shelfHead">
          <div className="shelfLeft">
            <div className="labelTag">PANTRY</div>
            <div className="shelfTitle">📦 棚（十分）</div>
            <div className="shelfSub">ここは「十分」だけ。買うものは上に移動します。</div>
          </div>
          <div className="shelfCount">{pantryList.length} 件</div>
        </div>

        {pantryList.length === 0 ? (
          <p className="muted">「十分」の項目がありません（検索条件も確認してみてください）。</p>
        ) : (
          <ul className="list">
            {pantryList.map((it) => (
              <li key={it.id} className={`cardItem enough ${spotlightId === it.id ? "spotlight" : ""}`}>
                <Signal status={it.status} onClick={() => toggleItemStatus(it.id)} title="クリックで状態を切り替え" />
                <div className="cardMain">
                  <div className="cardTop">
                    <div className="cardName">{it.name}</div>
                    <div className="tag">{STATUS[it.status]}</div>
                  </div>
                  <input
                    className="note"
                    value={it.note}
                    onChange={(e) => updateNote(it.id, e.target.value)}
                    placeholder="メモ（ここで編集できます）"
                  />
                </div>
                <button className="btn danger" onClick={() => removeItem(it.id)}>
                  削除
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="footer">
        <small>保存先：この端末のブラウザ（localStorage）。同じ端末・同じブラウザなら記録は残ります。</small>
      </footer>
    </div>
  );
}
