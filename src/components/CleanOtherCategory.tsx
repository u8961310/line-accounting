"use client";
import { useState, useCallback } from "react";
import type { CleanSuggestion } from "@/app/api/clean-other-category/route";

const CAT_EMOJI: Record<string, string> = {
  飲食: "🍜", 交通: "🚌", 娛樂: "🎮", 購物: "🛍️",
  醫療: "💊", 居住: "🏠", 教育: "📚", 通訊: "📱",
  保險: "🛡️", 水電: "💡", 美容: "💄", 運動: "🏃",
  旅遊: "✈️", 訂閱: "🔁", 寵物: "🐾",
};

// ── Row component (defined outside to avoid re-render focus loss) ─────────────
function SuggestionRow({
  item,
  checked,
  onToggle,
  onCategoryChange,
}: {
  item: CleanSuggestion;
  checked: boolean;
  onToggle: (id: string) => void;
  onCategoryChange: (id: string, cat: string) => void;
}) {
  const VALID_CATEGORIES = [
    "飲食", "交通", "娛樂", "購物", "醫療", "居住",
    "教育", "通訊", "保險", "水電", "美容", "運動",
    "旅遊", "訂閱", "寵物",
  ];

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-colors"
      style={{
        background: checked ? "var(--bg-input)" : "transparent",
        border: `1px solid ${checked ? "var(--accent)" : "var(--border-inner)"}`,
        opacity: checked ? 1 : 0.7,
      }}
      onClick={() => onToggle(item.id)}
    >
      {/* Checkbox */}
      <div
        className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
        style={{
          background: checked ? "var(--accent)" : "var(--bg-input)",
          border: `1.5px solid ${checked ? "var(--accent)" : "var(--border)"}`,
        }}
      >
        {checked && <span className="text-white text-[11px] font-bold">✓</span>}
      </div>

      {/* Note + meta */}
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium truncate" style={{ color: "var(--text-primary)" }}>
          {item.note || <span style={{ color: "var(--text-muted)" }}>(無備註)</span>}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{item.date}</span>
          <span className="text-[11px] px-1.5 py-0.5 rounded font-medium"
            style={{ background: item.type === "支出" ? "#EF444420" : "#10B98120", color: item.type === "支出" ? "#EF4444" : "#10B981" }}>
            {item.type}
          </span>
          <span className="text-[12px] font-semibold" style={{ color: "var(--text-primary)" }}>
            NT${item.amount.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Suggested category selector */}
      <div
        className="flex items-center gap-1.5 flex-shrink-0"
        onClick={e => e.stopPropagation()}
      >
        <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>其他 →</span>
        <select
          value={item.suggested}
          onChange={e => onCategoryChange(item.id, e.target.value)}
          className="text-[13px] font-semibold rounded-lg px-2 py-1 outline-none cursor-pointer"
          style={{
            background: "var(--bg-card)",
            color: "var(--accent)",
            border: "1px solid var(--accent)",
          }}
        >
          {VALID_CATEGORIES.map(c => (
            <option key={c} value={c} style={{ background: "var(--bg-card)", color: "var(--text-primary)" }}>
              {CAT_EMOJI[c] ?? ""} {c}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function CleanOtherCategory() {
  const [loading,   setLoading]   = useState(false);
  const [applying,  setApplying]  = useState(false);
  const [items,     setItems]     = useState<CleanSuggestion[]>([]);
  const [checked,   setChecked]   = useState<Set<string>>(new Set());
  const [total,     setTotal]     = useState<number | null>(null);
  const [analyzed,  setAnalyzed]  = useState<number | null>(null);
  const [appliedN,  setAppliedN]  = useState<number | null>(null);
  const [error,     setError]     = useState<string | null>(null);

  const analyze = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAppliedN(null);
    setItems([]);
    setChecked(new Set());
    try {
      const res  = await fetch("/api/clean-other-category");
      const data = await res.json() as { suggestions?: CleanSuggestion[]; total?: number; analyzed?: number; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "分析失敗");
      setItems(data.suggestions ?? []);
      setTotal(data.total ?? 0);
      setAnalyzed(data.analyzed ?? 0);
      // Select all by default
      setChecked(new Set((data.suggestions ?? []).map(s => s.id)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "未知錯誤");
    } finally {
      setLoading(false);
    }
  }, []);

  function toggleItem(id: string) {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (checked.size === items.length) setChecked(new Set());
    else setChecked(new Set(items.map(i => i.id)));
  }

  function updateCategory(id: string, cat: string) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, suggested: cat } : i));
  }

  async function applySelected() {
    const updates = items
      .filter(i => checked.has(i.id))
      .map(i => ({ id: i.id, category: i.suggested }));
    if (updates.length === 0) return;

    setApplying(true);
    try {
      const res  = await fetch("/api/clean-other-category", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ updates }),
      });
      const data = await res.json() as { applied?: number; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "套用失敗");
      setAppliedN(data.applied ?? 0);
      // Remove applied items from list
      const appliedIds = new Set(updates.map(u => u.id));
      setItems(prev => prev.filter(i => !appliedIds.has(i.id)));
      setChecked(new Set());
      if (total !== null) setTotal(t => (t ?? 0) - (data.applied ?? 0));
    } catch (e) {
      setError(e instanceof Error ? e.message : "套用失敗");
    } finally {
      setApplying(false);
    }
  }

  const checkedCount = checked.size;

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {/* Header card */}
      <div className="rounded-2xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">🤖</span>
          <div>
            <h2 className="text-[15px] font-bold" style={{ color: "var(--text-primary)" }}>Claude 批次分類清理</h2>
            <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
              找出所有「其他」分類的交易，讓 Claude 根據備註內容推測正確分類，確認後一鍵套用
            </p>
          </div>
        </div>

        {/* Stats */}
        {total !== null && (
          <div className="flex gap-3 mb-4">
            <div className="flex-1 rounded-xl px-4 py-2.5" style={{ background: "var(--bg-input)" }}>
              <div className="text-[11px] mb-0.5" style={{ color: "var(--text-muted)" }}>資料庫「其他」總數</div>
              <div className="text-[18px] font-bold" style={{ color: "var(--text-primary)" }}>{total} 筆</div>
            </div>
            {analyzed !== null && (
              <div className="flex-1 rounded-xl px-4 py-2.5" style={{ background: "var(--bg-input)" }}>
                <div className="text-[11px] mb-0.5" style={{ color: "var(--text-muted)" }}>本次分析</div>
                <div className="text-[18px] font-bold" style={{ color: "var(--text-primary)" }}>{analyzed} 筆</div>
              </div>
            )}
            <div className="flex-1 rounded-xl px-4 py-2.5" style={{ background: "var(--bg-input)" }}>
              <div className="text-[11px] mb-0.5" style={{ color: "var(--text-muted)" }}>有建議可套用</div>
              <div className="text-[18px] font-bold" style={{ color: "#8B5CF6" }}>{items.length} 筆</div>
            </div>
          </div>
        )}

        {/* Success message */}
        {appliedN !== null && appliedN > 0 && (
          <div className="mb-4 px-4 py-2.5 rounded-xl text-[13px] font-medium"
            style={{ background: "#10B98115", color: "#10B981", border: "1px solid #10B98130" }}>
            ✅ 已套用 {appliedN} 筆分類更新！
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 px-4 py-2.5 rounded-xl text-[13px]"
            style={{ background: "#EF444415", color: "#EF4444", border: "1px solid #EF444430" }}>
            ❌ {error}
          </div>
        )}

        {/* Analyze button */}
        <button
          onClick={analyze}
          disabled={loading}
          className="w-full py-3 rounded-xl text-[14px] font-bold transition-opacity"
          style={{
            background: loading ? "var(--bg-input)" : "var(--btn-gradient)",
            color: loading ? "var(--text-muted)" : "#fff",
            opacity: loading ? 1 : undefined,
          }}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin">⚙️</span> Claude 分析中，請稍候…
            </span>
          ) : items.length > 0 ? "🔄 重新分析" : "🔍 開始分析「其他」分類"}
        </button>

        <p className="text-[11px] text-center mt-2" style={{ color: "var(--text-muted)" }}>
          每次最多分析 50 筆，使用 claude-haiku 約需 3–8 秒
        </p>
      </div>

      {/* Suggestion list */}
      {items.length > 0 && (
        <div className="rounded-2xl p-5 space-y-3" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          {/* List header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={toggleAll}
                className="text-[12px] px-3 py-1.5 rounded-lg font-medium"
                style={{ background: "var(--bg-input)", color: "var(--text-sub)", border: "1px solid var(--border)" }}
              >
                {checked.size === items.length ? "取消全選" : "全選"}
              </button>
              <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                已選 {checkedCount}/{items.length} 筆
              </span>
            </div>

            <button
              onClick={applySelected}
              disabled={checkedCount === 0 || applying}
              className="px-4 py-2 rounded-xl text-[13px] font-bold transition-opacity"
              style={{
                background: checkedCount === 0 ? "var(--bg-input)" : "var(--btn-gradient)",
                color: checkedCount === 0 ? "var(--text-muted)" : "#fff",
                opacity: applying ? 0.7 : 1,
              }}
            >
              {applying ? "套用中…" : `✅ 套用選取 (${checkedCount})`}
            </button>
          </div>

          {/* Rows */}
          <div className="space-y-2">
            {items.map(item => (
              <SuggestionRow
                key={item.id}
                item={item}
                checked={checked.has(item.id)}
                onToggle={toggleItem}
                onCategoryChange={updateCategory}
              />
            ))}
          </div>

          {/* Bottom apply */}
          {items.length > 5 && (
            <button
              onClick={applySelected}
              disabled={checkedCount === 0 || applying}
              className="w-full py-2.5 rounded-xl text-[13px] font-bold"
              style={{
                background: checkedCount === 0 ? "var(--bg-input)" : "var(--btn-gradient)",
                color: checkedCount === 0 ? "var(--text-muted)" : "#fff",
              }}
            >
              {applying ? "套用中…" : `✅ 套用選取 (${checkedCount})`}
            </button>
          )}
        </div>
      )}

      {/* Empty state after analysis */}
      {!loading && analyzed !== null && items.length === 0 && appliedN === null && (
        <div className="rounded-2xl p-8 text-center" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="text-3xl mb-2">🎉</div>
          <p className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>
            所有「其他」交易都已正確分類！
          </p>
          <p className="text-[12px] mt-1" style={{ color: "var(--text-muted)" }}>
            {total === 0 ? "資料庫中沒有「其他」分類的交易。" : "Claude 認為現有分類無法再進一步細分。"}
          </p>
        </div>
      )}
    </div>
  );
}
