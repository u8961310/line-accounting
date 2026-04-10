"use client";

import { useState, useEffect } from "react";

interface CategoryRule {
  id: string;
  keyword: string;
  category: string;
  source: string | null;
  hitCount: number;
  lastUsedAt: string | null;
}

export default function CategoryRulesManager() {
  const [rules, setRules]         = useState<CategoryRule[]>([]);
  const [loading, setLoading]     = useState(true);
  const [form, setForm]           = useState({ keyword: "", category: "" });
  const [saving, setSaving]       = useState(false);

  useEffect(() => {
    fetch("/api/category-rules")
      .then(r => r.json())
      .then(d => { setRules(d.rules ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function addRule() {
    if (!form.keyword.trim() || !form.category.trim()) return;
    setSaving(true);
    const res = await fetch("/api/category-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword: form.keyword.trim(), category: form.category.trim() }),
    });
    const data = await res.json() as { rule?: CategoryRule };
    if (data.rule) {
      setRules(prev => {
        const exists = prev.findIndex(r => r.id === data.rule!.id);
        return exists >= 0 ? prev.map(r => r.id === data.rule!.id ? data.rule! : r) : [data.rule!, ...prev];
      });
      setForm({ keyword: "", category: "" });
    }
    setSaving(false);
  }

  async function deleteRule(id: string) {
    await fetch(`/api/category-rules/${id}`, { method: "DELETE" });
    setRules(prev => prev.filter(r => r.id !== id));
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[13px] mb-3" style={{ color: "var(--text-sub)" }}>
          當交易備註含有關鍵字時，自動套用指定分類。修改任何交易的分類時也會自動學習。
        </p>

        {/* 新增表單 */}
        <div className="flex gap-2 mb-4">
          <input
            placeholder="關鍵字（如：麥當勞）"
            value={form.keyword}
            onChange={e => setForm(f => ({ ...f, keyword: e.target.value }))}
            onKeyDown={e => { if (e.key === "Enter") void addRule(); }}
            className="flex-1 rounded-xl px-3 py-2 text-[14px] outline-none"
            style={{ background: "var(--bg-input)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
          />
          <input
            placeholder="分類（如：飲食）"
            value={form.category}
            onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
            onKeyDown={e => { if (e.key === "Enter") void addRule(); }}
            className="w-32 rounded-xl px-3 py-2 text-[14px] outline-none"
            style={{ background: "var(--bg-input)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
          />
          <button
            onClick={() => void addRule()} disabled={saving}
            className="px-4 py-2 rounded-xl text-[14px] font-bold text-white disabled:opacity-40"
            style={{ background: "var(--btn-gradient)" }}
          >
            {saving ? "…" : "新增"}
          </button>
        </div>

        {/* 規則列表 */}
        {loading ? (
          <p className="text-[13px] text-center py-4" style={{ color: "var(--text-muted)" }}>載入中…</p>
        ) : rules.length === 0 ? (
          <p className="text-[13px] text-center py-4" style={{ color: "var(--text-muted)" }}>尚無規則。修改任何交易分類後會自動學習。</p>
        ) : (
          <div className="space-y-2">
            {rules.map(rule => (
              <div key={rule.id} className="flex items-center justify-between rounded-xl px-4 py-2.5"
                style={{ background: "var(--bg-input)", border: "1px solid var(--border-inner)" }}>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-[13px] font-mono px-2 py-0.5 rounded" style={{ background: "rgba(99,102,241,0.1)", color: "#818CF8" }}>
                    {rule.keyword}
                  </span>
                  <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>→</span>
                  <span className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>{rule.category}</span>
                  {rule.hitCount > 0 && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded-full" style={{ background: "rgba(16,185,129,0.1)", color: "#34D399" }}>
                      命中 {rule.hitCount} 次
                    </span>
                  )}
                </div>
                <button onClick={() => void deleteRule(rule.id)}
                  className="text-[18px] leading-none transition-opacity hover:opacity-60 ml-2"
                  style={{ color: "var(--text-muted)" }}>
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
