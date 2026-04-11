"use client";

import { useState, useEffect, useCallback } from "react";

type MealType = "breakfast" | "lunch" | "dinner";

interface MealBudgetItem {
  id:         string;
  mealType:   MealType;
  amount:     number;
  isActive:   boolean;
  spentToday: number;
}

const MEAL_META: Record<MealType, { icon: string; label: string }> = {
  breakfast: { icon: "🌅", label: "早餐" },
  lunch:     { icon: "☀️", label: "午餐" },
  dinner:    { icon: "🌙", label: "晚餐" },
};

const MEAL_ORDER: MealType[] = ["breakfast", "lunch", "dinner"];

function fmt(n: number): string {
  return Math.abs(n).toLocaleString("zh-TW", { maximumFractionDigits: 0 });
}

function statusOf(spent: number, amount: number): "over" | "near" | "ok" | "none" {
  if (amount <= 0) return "none";
  const r = spent / amount;
  if (r > 1)    return "over";
  if (r >= 0.8) return "near";
  return "ok";
}

const STATUS_COLOR = {
  over: "#EF4444",
  near: "#F59E0B",
  ok:   "#10B981",
  none: "#94A3B8",
};

export default function MealBudgetManager() {
  const [items, setItems] = useState<Record<MealType, MealBudgetItem | null>>({
    breakfast: null, lunch: null, dinner: null,
  });
  const [editing, setEditing] = useState<MealType | null>(null);
  const [draft, setDraft] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/meal-budgets");
      if (!res.ok) return;
      const data = await res.json() as { budgets: MealBudgetItem[] };
      const map: Record<MealType, MealBudgetItem | null> = {
        breakfast: null, lunch: null, dinner: null,
      };
      for (const b of data.budgets) {
        if (MEAL_ORDER.includes(b.mealType)) map[b.mealType] = b;
      }
      setItems(map);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  async function handleSave(mealType: MealType) {
    const amount = Number(draft);
    if (!isFinite(amount) || amount < 0) return;
    setSaving(true);
    try {
      await fetch("/api/meal-budgets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mealType, amount }),
      });
      setEditing(null);
      setDraft("");
      await reload();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(mealType: MealType) {
    if (!confirm(`確定刪除${MEAL_META[mealType].label}預算？`)) return;
    await fetch(`/api/meal-budgets?mealType=${mealType}`, { method: "DELETE" });
    await reload();
  }

  if (loading) return <div className="text-sm text-[var(--text-muted)]">載入中…</div>;

  return (
    <div className="rounded-lg border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-bold">🍽️ 三餐日預算</h3>
        <span className="text-xs text-[var(--text-muted)]">每日歸零重算</span>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {MEAL_ORDER.map(mealType => {
          const item   = items[mealType];
          const meta   = MEAL_META[mealType];
          const amount = item?.amount ?? 0;
          const spent  = item?.spentToday ?? 0;
          const status = statusOf(spent, amount);
          const color  = STATUS_COLOR[status];
          const pct    = amount > 0 ? Math.min(100, Math.round((spent / amount) * 100)) : 0;
          const isEdit = editing === mealType;

          return (
            <div key={mealType} className="rounded-md border p-3" style={{ borderColor: "var(--border-inner)" }}>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-semibold">
                  {meta.icon} {meta.label}
                </div>
                {item && !isEdit && (
                  <button
                    className="text-xs text-[var(--text-muted)] hover:underline"
                    onClick={() => handleDelete(mealType)}
                  >刪除</button>
                )}
              </div>

              {isEdit ? (
                <div className="space-y-2">
                  <input
                    type="number"
                    min="0"
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    className="w-full rounded border px-2 py-1 text-sm"
                    style={{ borderColor: "var(--border-inner)" }}
                    placeholder="日預算金額"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      disabled={saving}
                      onClick={() => handleSave(mealType)}
                      className="flex-1 rounded bg-blue-500 px-2 py-1 text-xs text-white disabled:opacity-50"
                    >{saving ? "儲存中…" : "儲存"}</button>
                    <button
                      onClick={() => { setEditing(null); setDraft(""); }}
                      className="flex-1 rounded border px-2 py-1 text-xs"
                      style={{ borderColor: "var(--border-inner)" }}
                    >取消</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-xl font-bold">
                    {item ? `NT$ ${fmt(amount)}` : "—"}
                  </div>
                  {item && (
                    <>
                      <div className="mt-1 text-xs" style={{ color }}>
                        已花 NT$ {fmt(spent)} / 剩 NT$ {fmt(Math.max(0, amount - spent))}
                      </div>
                      <div className="mt-2 h-1.5 w-full rounded-full" style={{ background: "var(--border-inner)" }}>
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, background: color }}
                        />
                      </div>
                    </>
                  )}
                  <button
                    className="mt-3 w-full rounded border px-2 py-1 text-xs"
                    style={{ borderColor: "var(--border-inner)" }}
                    onClick={() => {
                      setEditing(mealType);
                      setDraft(item ? String(item.amount) : "");
                    }}
                  >{item ? "編輯" : "設定預算"}</button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
