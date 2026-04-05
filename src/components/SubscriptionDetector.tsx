"use client";

import { useEffect, useState, useCallback } from "react";
import type { SubCandidate, SubscriptionsResponse } from "@/app/api/subscriptions/route";
import { DEMO_SUBSCRIPTIONS } from "@/lib/demo-data";

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number) { return Math.round(n).toLocaleString("zh-TW"); }

const SOURCE_LABELS: Record<string, string> = {
  line: "LINE", manual: "手動", cash: "現金",
  esun_bank: "玉山銀行", ctbc_bank: "中國信託", mega_bank: "兆豐銀行",
  yuanta_bank: "元大銀行", sinopac_bank: "永豐銀行", kgi_bank: "凱基銀行",
  cathay_cc: "國泰信用卡", esun_cc: "玉山信用卡", ctbc_cc: "中信信用卡",
  taishin_cc: "台新信用卡", sinopac_cc: "永豐信用卡", unknown: "其他",
};

type FilterTab = "all" | "confirmed" | "pending" | "dismissed";

// ── Sub-components ─────────────────────────────────────────────────────────

interface FilterBarProps {
  active:   FilterTab;
  counts:   Record<FilterTab, number>;
  onChange: (f: FilterTab) => void;
}

function FilterBar({ active, counts, onChange }: FilterBarProps) {
  const tabs: { id: FilterTab; label: string }[] = [
    { id: "all",       label: `全部 (${counts.all})`       },
    { id: "confirmed", label: `已確認 (${counts.confirmed})` },
    { id: "pending",   label: `未確認 (${counts.pending})`   },
    { id: "dismissed", label: `已排除 (${counts.dismissed})` },
  ];
  return (
    <div className="flex gap-1 flex-wrap">
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className="px-3 py-1.5 rounded-lg text-[14px] font-semibold transition-colors"
          style={{
            background: active === t.id ? "var(--accent)" : "var(--bg-input)",
            color:      active === t.id ? "#fff"           : "var(--text-sub)",
            border:     `1px solid ${active === t.id ? "var(--accent)" : "var(--border-inner)"}`,
          }}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

interface SubRowProps {
  item:      SubCandidate;
  onConfirm: (item: SubCandidate) => void;
  onDismiss: (item: SubCandidate) => void;
  onEdit:    (item: SubCandidate) => void;
  saving:    boolean;
}

function SubRow({ item, onConfirm, onDismiss, onEdit, saving }: SubRowProps) {
  const displayName = item.label || item.detectedName;
  const statusColor = item.dismissed ? "#64748B" : item.confirmed ? "#10B981" : "#F59E0B";
  const statusLabel = item.dismissed ? "已排除" : item.confirmed ? "已確認" : "未確認";

  return (
    <div className="px-5 py-4 flex items-center gap-3 flex-wrap"
      style={{ opacity: item.dismissed ? 0.55 : 1 }}>

      {/* Status dot */}
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: statusColor }} title={statusLabel} />

      {/* Name + remark */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[14px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>
            {displayName}
          </span>
          {item.label && item.label !== item.detectedName && (
            <span className="text-[14px]" style={{ color: "var(--text-muted)" }}>({item.detectedName})</span>
          )}
          <span className="text-[14px] px-1.5 py-0.5 rounded" style={{ background: "var(--bg-input)", color: "var(--text-sub)" }}>
            {item.category}
          </span>
          <span className="text-[14px] px-1.5 py-0.5 rounded" style={{ background: "var(--bg-input)", color: "var(--text-sub)" }}>
            {SOURCE_LABELS[item.source] ?? item.source}
          </span>
        </div>
        {item.remark && (
          <p className="text-[14px] mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{item.remark}</p>
        )}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-right flex-shrink-0">
        <div>
          <p className="text-[15px] font-bold" style={{ color: "var(--text-primary)" }}>NT$ {fmt(item.amount)}</p>
          <p className="text-[14px]" style={{ color: "var(--text-muted)" }}>/ 月</p>
        </div>
        <div>
          <p className="text-[14px] font-semibold" style={{ color: "var(--text-sub)" }}>{item.monthCount} 個月</p>
          <p className="text-[14px]" style={{ color: "var(--text-muted)" }}>上次 {item.lastDate}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {!item.dismissed && (
          <button onClick={() => onConfirm(item)} disabled={saving}
            className="px-2.5 py-1.5 rounded-lg text-[14px] font-semibold transition-opacity hover:opacity-70 disabled:opacity-40"
            style={item.confirmed
              ? { background: "rgba(16,185,129,0.1)", color: "#10B981", border: "1px solid rgba(16,185,129,0.25)" }
              : { background: "var(--bg-input)", color: "var(--text-sub)", border: "1px solid var(--border-inner)" }
            }>
            {item.confirmed ? "取消確認" : "確認訂閱"}
          </button>
        )}
        <button onClick={() => onEdit(item)} disabled={saving}
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-opacity hover:opacity-70 disabled:opacity-40"
          style={{ background: "var(--bg-input)", border: "1px solid var(--border-inner)" }}
          title="編輯備註">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: "var(--text-sub)" }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
        <button onClick={() => onDismiss(item)} disabled={saving}
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-opacity hover:opacity-70 disabled:opacity-40"
          style={{ background: "var(--bg-input)", border: "1px solid var(--border-inner)" }}
          title={item.dismissed ? "取消排除" : "標記為非訂閱"}>
          {item.dismissed
            ? <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: "#10B981" }}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4l16 16M4 20L20 4" /></svg>
            : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: "var(--text-muted)" }}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
          }
        </button>
      </div>
    </div>
  );
}

interface EditModalProps {
  item:     SubCandidate;
  onSave:   (label: string, remark: string) => void;
  onClose:  () => void;
  saving:   boolean;
}

function EditModal({ item, onSave, onClose, saving }: EditModalProps) {
  const [label,  setLabel]  = useState(item.label);
  const [remark, setRemark] = useState(item.remark);

  const inputClass = "w-full rounded-xl px-3 py-2.5 text-[14px] outline-none transition-colors";
  const inputStyle = { background: "var(--bg-input)", border: "1px solid var(--border-inner)", color: "var(--text-primary)" };
  const labelStyle = { color: "var(--text-sub)", fontSize: "11px", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.05em" };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="rounded-2xl p-6 w-full max-w-sm pointer-events-auto space-y-4"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
          <p className="text-[15px] font-bold" style={{ color: "var(--text-primary)" }}>編輯訂閱資訊</p>
          <p className="text-[14px] -mt-2" style={{ color: "var(--text-muted)" }}>偵測到：{item.detectedName}</p>

          <div className="space-y-1">
            <p style={labelStyle}>自訂名稱</p>
            <input className={inputClass} style={inputStyle}
              value={label} onChange={e => setLabel(e.target.value)}
              placeholder={item.detectedName} />
          </div>
          <div className="space-y-1">
            <p style={labelStyle}>備註</p>
            <input className={inputClass} style={inputStyle}
              value={remark} onChange={e => setRemark(e.target.value)}
              placeholder="例：家庭共享方案" />
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={() => onSave(label, remark)} disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-[14px] font-bold transition-opacity hover:opacity-80 disabled:opacity-40"
              style={{ background: "var(--btn-gradient)", color: "#fff" }}>
              {saving ? "儲存中…" : "儲存"}
            </button>
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-[14px] font-semibold transition-opacity hover:opacity-70"
              style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}>
              取消
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function SubscriptionDetector({ isDemo }: { isDemo: boolean }) {
  const [data,      setData]      = useState<SubscriptionsResponse | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [filter,    setFilter]    = useState<FilterTab>("all");
  const [search,    setSearch]    = useState("");
  const [editItem,  setEditItem]  = useState<SubCandidate | null>(null);

  const load = useCallback(() => {
    if (isDemo) {
      setData(DEMO_SUBSCRIPTIONS as SubscriptionsResponse);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch("/api/subscriptions")
      .then(r => r.json())
      .then((d: SubscriptionsResponse) => setData(d))
      .finally(() => setLoading(false));
  }, [isDemo]);

  useEffect(() => { load(); }, [load]);

  async function saveMark(patternKey: string, patch: Partial<{ label: string; note: string; confirmed: boolean; dismissed: boolean }>) {
    if (isDemo) {
      // optimistic update in demo
      setData(prev => prev ? {
        ...prev,
        candidates: prev.candidates.map(c => c.patternKey === patternKey ? { ...c, ...patch, remark: patch.note ?? c.remark } : c),
      } : prev);
      return;
    }
    setSaving(true);
    try {
      await fetch("/api/subscriptions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patternKey, ...patch }),
      });
      load();
    } finally { setSaving(false); }
  }

  function handleConfirm(item: SubCandidate) {
    saveMark(item.patternKey, { confirmed: !item.confirmed, dismissed: false });
  }

  function handleDismiss(item: SubCandidate) {
    saveMark(item.patternKey, { dismissed: !item.dismissed, confirmed: false });
  }

  function handleSaveEdit(label: string, remark: string) {
    if (!editItem) return;
    saveMark(editItem.patternKey, { label, note: remark });
    setEditItem(null);
  }

  const candidates = data?.candidates ?? [];

  const counts: Record<FilterTab, number> = {
    all:       candidates.length,
    confirmed: candidates.filter(c => c.confirmed && !c.dismissed).length,
    pending:   candidates.filter(c => !c.confirmed && !c.dismissed).length,
    dismissed: candidates.filter(c => c.dismissed).length,
  };

  const visible = candidates.filter(c => {
    const matchFilter =
      filter === "all"       ? true :
      filter === "confirmed" ? (c.confirmed && !c.dismissed) :
      filter === "pending"   ? (!c.confirmed && !c.dismissed) :
      c.dismissed;
    if (!matchFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (c.label || c.detectedName).toLowerCase().includes(q) || c.category.toLowerCase().includes(q);
    }
    return true;
  });

  const confirmedTotal = candidates.filter(c => c.confirmed && !c.dismissed)
    .reduce((s, c) => s + c.amount, 0);
  const activeTotal    = candidates.filter(c => !c.dismissed)
    .reduce((s, c) => s + c.amount, 0);

  if (loading) return (
    <div className="rounded-2xl animate-pulse" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", height: 240 }} />
  );

  return (
    <div className="space-y-4">
      {editItem && (
        <EditModal item={editItem} onSave={handleSaveEdit} onClose={() => setEditItem(null)} saving={saving} />
      )}

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "偵測到訂閱",   value: `${counts.all} 項`,            sub: "近 6 個月重複出現" },
          { label: "已確認月費",   value: `NT$ ${fmt(confirmedTotal)}`,   sub: `共 ${counts.confirmed} 項已確認` },
          { label: "潛在月費合計", value: `NT$ ${fmt(activeTotal)}`,      sub: "含未確認訂閱" },
        ].map(s => (
          <div key={s.label} className="rounded-2xl px-5 py-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <p className="text-[14px] font-medium mb-1" style={{ color: "var(--text-sub)" }}>{s.label}</p>
            <p className="text-[18px] font-black" style={{ color: "var(--text-primary)" }}>{s.value}</p>
            <p className="text-[14px] mt-0.5" style={{ color: "var(--text-muted)" }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* List card */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        {/* Toolbar */}
        <div className="px-5 py-4 flex items-center gap-3 flex-wrap" style={{ borderBottom: "1px solid var(--border-inner)" }}>
          <FilterBar active={filter} counts={counts} onChange={setFilter} />
          <div className="relative ml-auto">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: "var(--text-muted)" }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
            </svg>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="搜尋訂閱名稱…"
              className="pl-8 pr-3 py-1.5 rounded-lg text-[14px] outline-none w-44"
              style={{ background: "var(--bg-input)", border: "1px solid var(--border-inner)", color: "var(--text-primary)" }} />
          </div>
        </div>

        {/* Rows */}
        {visible.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-2xl mb-2">🔍</p>
            <p className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>
              {candidates.length === 0 ? "尚未偵測到重複交易" : "沒有符合篩選條件的項目"}
            </p>
            <p className="text-[14px] mt-1" style={{ color: "var(--text-muted)" }}>
              {candidates.length === 0 ? "匯入 2 個月以上的對帳單後，系統會自動分析訂閱模式" : "請調整篩選條件或搜尋關鍵字"}
            </p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--border-inner)" }}>
            {visible.map(item => (
              <SubRow
                key={item.patternKey}
                item={item}
                onConfirm={handleConfirm}
                onDismiss={handleDismiss}
                onEdit={setEditItem}
                saving={saving}
              />
            ))}
          </div>
        )}

        {visible.length > 0 && (
          <div className="px-5 py-3 flex justify-end" style={{ borderTop: "1px solid var(--border-inner)" }}>
            <p className="text-[14px]" style={{ color: "var(--text-muted)" }}>
              顯示 {visible.length} / {candidates.length} 項
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
