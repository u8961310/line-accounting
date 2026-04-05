"use client";

import { useState } from "react";
import type { NoteCandidate } from "@/app/api/ai-note-cleanup/route";

function fmt(n: number) { return Math.round(n).toLocaleString("zh-TW"); }

export default function NoteCleanup() {
  const [candidates, setCandidates]   = useState<NoteCandidate[]>([]);
  const [selected,   setSelected]     = useState<Set<string>>(new Set());
  const [edits,      setEdits]        = useState<Record<string, string>>({});
  const [loading,    setLoading]      = useState(false);
  const [applying,   setApplying]     = useState(false);
  const [done,       setDone]         = useState<number | null>(null);
  const [error,      setError]        = useState<string | null>(null);

  async function fetchCandidates() {
    setLoading(true);
    setError(null);
    setDone(null);
    try {
      const res  = await fetch("/api/ai-note-cleanup");
      const data = await res.json() as { candidates: NoteCandidate[] };
      setCandidates(data.candidates);
      // Pre-select all that have a suggestion
      const sel = new Set(data.candidates.filter(c => c.suggested).map(c => c.id));
      setSelected(sel);
      // Pre-fill edits with suggestions
      const ed: Record<string, string> = {};
      for (const c of data.candidates) { if (c.suggested) ed[c.id] = c.suggested; }
      setEdits(ed);
    } catch {
      setError("撈取失敗，請稍後再試");
    } finally {
      setLoading(false);
    }
  }

  async function applySelected() {
    const updates = Array.from(selected)
      .filter(id => edits[id])
      .map(id => ({ id, note: edits[id] }));
    if (updates.length === 0) return;

    setApplying(true);
    try {
      const res  = await fetch("/api/ai-note-cleanup", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ updates }),
      });
      const data = await res.json() as { updated: number };
      setDone(data.updated);
      // Remove applied from list
      const appliedIds = new Set(updates.map(u => u.id));
      setCandidates(prev => prev.filter(c => !appliedIds.has(c.id)));
      setSelected(new Set());
    } catch {
      setError("套用失敗");
    } finally {
      setApplying(false);
    }
  }

  function toggleAll() {
    if (selected.size === candidates.filter(c => c.suggested).length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(candidates.filter(c => c.suggested).map(c => c.id)));
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Header */}
      <div className="rounded-2xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[16px] font-bold" style={{ color: "var(--text-primary)" }}>🤖 備注 AI 整理</p>
            <p className="text-[13px] mt-1" style={{ color: "var(--text-muted)" }}>
              偵測含英文的銀行原始備注，AI 建議中文可讀版本，確認後一鍵套用
            </p>
          </div>
          <button onClick={fetchCandidates} disabled={loading}
            className="px-5 py-2 rounded-xl text-[14px] font-bold transition-opacity hover:opacity-80 disabled:opacity-50 flex-shrink-0"
            style={{ background: "var(--accent)", color: "#fff" }}>
            {loading ? "AI 分析中…" : candidates.length > 0 ? "重新撈取" : "開始分析"}
          </button>
        </div>
        {error && <p className="mt-2 text-[13px]" style={{ color: "#EF4444" }}>{error}</p>}
        {done !== null && (
          <p className="mt-2 text-[13px] font-semibold" style={{ color: "#10B981" }}>
            ✅ 已更新 {done} 筆備注
          </p>
        )}
      </div>

      {/* Candidate list */}
      {candidates.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          {/* Toolbar */}
          <div className="px-5 py-3 flex items-center justify-between"
            style={{ borderBottom: "1px solid var(--border-inner)" }}>
            <div className="flex items-center gap-3">
              <button onClick={toggleAll}
                className="text-[13px] font-semibold transition-opacity hover:opacity-80"
                style={{ color: "var(--accent)" }}>
                {selected.size === candidates.filter(c => c.suggested).length ? "全部取消" : "全選"}
              </button>
              <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>
                已選 {selected.size} / {candidates.length} 筆
              </span>
            </div>
            <button onClick={applySelected} disabled={applying || selected.size === 0}
              className="px-4 py-1.5 rounded-xl text-[13px] font-bold transition-opacity hover:opacity-80 disabled:opacity-40"
              style={{ background: "#10B981", color: "#fff" }}>
              {applying ? "套用中…" : `套用 ${selected.size} 筆`}
            </button>
          </div>

          {/* Rows */}
          <div className="divide-y" style={{ borderColor: "var(--border-inner)" }}>
            {candidates.map(c => {
              const isSel = selected.has(c.id);
              const editVal = edits[c.id] ?? c.suggested ?? "";
              return (
                <div key={c.id} className="px-5 py-3 flex items-start gap-3"
                  style={{ background: isSel ? "rgba(59,130,246,0.04)" : undefined }}>
                  {/* Checkbox */}
                  <button onClick={() => setSelected(prev => {
                    const next = new Set(prev);
                    next.has(c.id) ? next.delete(c.id) : next.add(c.id);
                    return next;
                  })}
                    className="w-5 h-5 rounded flex-shrink-0 mt-0.5 flex items-center justify-center border transition-all"
                    style={{
                      background:   isSel ? "var(--accent)" : "var(--bg-input)",
                      borderColor:  isSel ? "var(--accent)" : "var(--border-inner)",
                      color:        "#fff",
                    }}>
                    {isSel && <span className="text-[10px] font-black">✓</span>}
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-[11px] px-1.5 py-0.5 rounded"
                        style={{ background: "var(--bg-input)", color: "var(--text-muted)" }}>
                        {c.date}
                      </span>
                      <span className="text-[11px] px-1.5 py-0.5 rounded"
                        style={{ background: "var(--bg-input)", color: "var(--text-muted)" }}>
                        {c.category}
                      </span>
                      <span className="text-[12px] font-bold tabular-nums" style={{ color: "#F87171" }}>
                        NT$ {fmt(c.amount)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-mono px-2 py-0.5 rounded flex-shrink-0"
                        style={{ background: "rgba(239,68,68,0.08)", color: "#F87171", border: "1px solid rgba(239,68,68,0.2)" }}>
                        {c.note}
                      </span>
                      <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>→</span>
                      <input
                        value={editVal}
                        onChange={e => setEdits(prev => ({ ...prev, [c.id]: e.target.value }))}
                        placeholder={c.suggested || "輸入中文備注…"}
                        className="flex-1 px-2 py-1 rounded-lg text-[13px] font-semibold outline-none min-w-0"
                        style={{
                          background: "var(--bg-input)",
                          border:     `1px solid ${isSel ? "var(--accent)" : "var(--border-inner)"}`,
                          color:      "var(--text-primary)",
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {candidates.length === 0 && !loading && done === null && (
        <div className="rounded-2xl text-center py-16" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p className="text-3xl mb-3">✨</p>
          <p className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>
            點「開始分析」讓 AI 找出需要整理的備注
          </p>
          <p className="text-[13px] mt-1" style={{ color: "var(--text-muted)" }}>
            偵測含英文的銀行原始備注（如 PAYPAL *ADOBE），建議中文可讀版本
          </p>
        </div>
      )}
    </div>
  );
}
