"use client";

import { useEffect, useState, useCallback } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

interface CustomCat { name: string; type: "expense" | "income" | "both" }

interface CatData {
  expense: string[];
  income:  string[];
  custom:  CustomCat[];
  builtinExpense: string[];
  builtinIncome:  string[];
}

const TYPE_OPTS: { value: CustomCat["type"]; label: string; desc: string }[] = [
  { value: "expense", label: "支出", desc: "僅出現在支出選項" },
  { value: "income",  label: "收入", desc: "僅出現在收入選項" },
  { value: "both",    label: "通用", desc: "支出與收入都出現" },
];

const TYPE_COLOR: Record<CustomCat["type"], { bg: string; color: string }> = {
  expense: { bg: "rgba(239,68,68,0.12)",    color: "#F87171" },
  income:  { bg: "rgba(16,185,129,0.12)",   color: "#34D399" },
  both:    { bg: "rgba(139,92,246,0.12)",   color: "#A78BFA" },
};

// ── Sub-components (defined outside parent to avoid re-mount) ──────────────

function BuiltinSection({ title, cats }: { title: string; cats: string[] }) {
  return (
    <div>
      <p className="text-[14px] font-semibold mb-2" style={{ color: "var(--text-muted)" }}>{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {cats.map(c => (
          <span key={c} className="text-[14px] px-2.5 py-1 rounded-lg"
            style={{ background: "var(--bg-input)", color: "var(--text-muted)", border: "1px solid var(--border-inner)" }}>
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}

interface CustomRowProps {
  cat:      CustomCat;
  onDelete: (name: string) => void;
  onRename: (oldName: string, newName: string) => void;
  onRetypeF: (name: string, type: CustomCat["type"]) => void;
}
function CustomRow({ cat, onDelete, onRename, onRetypeF }: CustomRowProps) {
  const [editing, setEditing] = useState(false);
  const [val,     setVal]     = useState(cat.name);
  const cfg = TYPE_COLOR[cat.type];

  function commit() {
    if (val.trim() && val.trim() !== cat.name) onRename(cat.name, val.trim());
    setEditing(false);
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
      style={{ background: "var(--bg-input)", border: "1px solid var(--border-inner)" }}>
      {editing ? (
        <input autoFocus value={val} onChange={e => setVal(e.target.value)}
          onBlur={commit} onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setVal(cat.name); setEditing(false); } }}
          className="flex-1 text-[14px] outline-none rounded px-1"
          style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--accent)" }} />
      ) : (
        <span className="flex-1 text-[14px] font-medium" style={{ color: "var(--text-primary)" }}>{cat.name}</span>
      )}

      {/* Type badge — click to cycle */}
      <button onClick={() => {
        const idx = TYPE_OPTS.findIndex(t => t.value === cat.type);
        onRetypeF(cat.name, TYPE_OPTS[(idx + 1) % 3].value);
      }} className="text-[14px] font-semibold px-2 py-0.5 rounded-full transition-opacity hover:opacity-80"
        style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}40` }}>
        {TYPE_OPTS.find(t => t.value === cat.type)?.label}
      </button>

      <button onClick={() => setEditing(true)}
        className="text-[14px] px-1.5 py-0.5 rounded hover:opacity-80 transition-opacity"
        style={{ color: "var(--text-muted)" }} title="重新命名">✏️</button>
      <button onClick={() => onDelete(cat.name)}
        className="text-[14px] px-1.5 py-0.5 rounded hover:opacity-80 transition-opacity"
        style={{ color: "#EF4444" }} title="刪除">🗑</button>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export default function CategoryManager() {
  const [data,    setData]    = useState<CatData | null>(null);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<CustomCat["type"]>("expense");
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState("");

  const load = useCallback(() => {
    fetch("/api/categories").then(r => r.json()).then((d: CatData) => setData(d)).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addCategory() {
    if (!newName.trim()) return;
    setErr(""); setSaving(true);
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), type: newType }),
    });
    setSaving(false);
    if (!res.ok) {
      const j = await res.json() as { error?: string };
      setErr(j.error ?? "新增失敗");
      return;
    }
    setNewName("");
    load();
  }

  async function deleteCategory(name: string) {
    if (!confirm(`確定刪除分類「${name}」？`)) return;
    await fetch(`/api/categories?name=${encodeURIComponent(name)}`, { method: "DELETE" });
    load();
  }

  async function renameCategory(oldName: string, newName: string) {
    setErr("");
    const res = await fetch("/api/categories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oldName, newName }),
    });
    if (!res.ok) {
      const j = await res.json() as { error?: string };
      setErr(j.error ?? "重新命名失敗");
      return;
    }
    load();
  }

  async function retypeCategory(name: string, type: CustomCat["type"]) {
    await fetch("/api/categories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oldName: name, type }),
    });
    load();
  }

  if (loading) return (
    <div className="rounded-2xl border flex justify-center py-12"
      style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
      <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
    </div>
  );

  const custom = data?.custom ?? [];

  return (
    <div className="space-y-4">

      {/* ── Add new ── */}
      <div className="rounded-2xl border overflow-hidden"
        style={{ background: "var(--bg-card)", borderColor: "var(--border)", boxShadow: "var(--card-shadow)" }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border-inner)" }}>
          <p className="font-bold text-[15px]" style={{ color: "var(--text-primary)" }}>✏️ 新增自訂分類</p>
          <p className="text-[14px] mt-0.5" style={{ color: "var(--text-muted)" }}>新分類將出現在記帳與預算的分類選項中</p>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-xl px-3 py-2 text-[14px] outline-none"
              style={{ background: "var(--bg-input)", border: "1px solid var(--border-inner)", color: "var(--text-primary)" }}
              placeholder="輸入分類名稱…"
              value={newName}
              onChange={e => { setNewName(e.target.value); setErr(""); }}
              onKeyDown={e => { if (e.key === "Enter") addCategory(); }}
            />
            <button onClick={addCategory} disabled={saving || !newName.trim()}
              className="px-4 py-2 rounded-xl text-[14px] font-semibold text-white transition-opacity hover:opacity-80 disabled:opacity-40"
              style={{ background: "var(--btn-gradient)" }}>
              {saving ? "…" : "新增"}
            </button>
          </div>

          {/* Type selector */}
          <div className="flex gap-2">
            {TYPE_OPTS.map(t => (
              <button key={t.value} onClick={() => setNewType(t.value)}
                className="flex-1 text-[14px] font-semibold py-1.5 rounded-lg transition-all"
                style={{
                  background: newType === t.value ? TYPE_COLOR[t.value].bg : "var(--bg-input)",
                  border:     `1px solid ${newType === t.value ? TYPE_COLOR[t.value].color + "60" : "var(--border-inner)"}`,
                  color:      newType === t.value ? TYPE_COLOR[t.value].color : "var(--text-muted)",
                }}>
                {t.label}
                <span className="block text-[9px] font-normal opacity-70">{t.desc}</span>
              </button>
            ))}
          </div>

          {err && <p className="text-[14px]" style={{ color: "#EF4444" }}>{err}</p>}
        </div>
      </div>

      {/* ── Custom categories ── */}
      <div className="rounded-2xl border overflow-hidden"
        style={{ background: "var(--bg-card)", borderColor: "var(--border)", boxShadow: "var(--card-shadow)" }}>
        <div className="px-5 py-4 border-b flex items-center justify-between"
          style={{ borderColor: "var(--border-inner)" }}>
          <div>
            <p className="font-bold text-[15px]" style={{ color: "var(--text-primary)" }}>自訂分類</p>
            <p className="text-[14px] mt-0.5" style={{ color: "var(--text-muted)" }}>
              點擊類型徽章可切換，✏️ 重新命名，🗑 刪除
            </p>
          </div>
          <span className="text-[14px] font-semibold px-2.5 py-1 rounded-full"
            style={{ background: "var(--bg-input)", color: "var(--text-sub)" }}>
            {custom.length} 個
          </span>
        </div>
        <div className="px-5 py-4 space-y-2">
          {custom.length === 0 ? (
            <p className="text-[14px] text-center py-4" style={{ color: "var(--text-muted)" }}>尚未新增任何自訂分類</p>
          ) : custom.map(cat => (
            <CustomRow key={cat.name} cat={cat}
              onDelete={deleteCategory} onRename={renameCategory} onRetypeF={retypeCategory} />
          ))}
        </div>
      </div>

      {/* ── Built-in categories (read-only reference) ── */}
      <div className="rounded-2xl border overflow-hidden"
        style={{ background: "var(--bg-card)", borderColor: "var(--border)", boxShadow: "var(--card-shadow)" }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border-inner)" }}>
          <p className="font-bold text-[15px]" style={{ color: "var(--text-primary)" }}>內建分類（唯讀）</p>
        </div>
        <div className="px-5 py-4 space-y-4">
          <BuiltinSection title="支出" cats={data?.builtinExpense ?? []} />
          <BuiltinSection title="收入" cats={data?.builtinIncome ?? []} />
        </div>
      </div>
    </div>
  );
}
