"use client";

import { useEffect, useState, useCallback } from "react";

interface Settings {
  expenseAlertThreshold: number;
  incomeAlertThreshold:  number;
  balanceAlertThreshold: number;
  hourlyRate:            number | null;
}

const inputClass =
  "w-full rounded-xl px-3 py-2.5 text-sm outline-none tabular-nums" +
  " bg-[var(--bg-input)] border border-[var(--border)] focus:border-[var(--accent)]" +
  " text-[var(--text-primary)] placeholder-[var(--text-muted)]";

const ALERT_FIELDS: { key: "expenseAlertThreshold" | "incomeAlertThreshold" | "balanceAlertThreshold"; label: string; icon: string; desc: string }[] = [
  { key: "expenseAlertThreshold", label: "大額支出警報", icon: "💸", desc: "單筆支出超過此金額時，LINE 推播提醒" },
  { key: "incomeAlertThreshold",  label: "大額收入確認", icon: "💰", desc: "單筆收入超過此金額時，LINE 推播確認" },
  { key: "balanceAlertThreshold", label: "餘額偏低警戒", icon: "⚠️", desc: "帳戶餘額低於此金額時，LINE 推播警告" },
];

function fmt(n: number) {
  return n.toLocaleString("zh-TW");
}

export default function AlertSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [draft, setDraft]       = useState<Record<string, string>>({});
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [loading, setLoading]   = useState(true);

  // 時薪設定（獨立欄位，單獨儲存）
  const [hourlyDraft,  setHourlyDraft]  = useState<string>("");
  const [hourlySaving, setHourlySaving] = useState(false);
  const [hourlySaved,  setHourlySaved]  = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/user-settings");
      const data = await res.json() as Settings;
      setSettings(data);
      setDraft({
        expenseAlertThreshold: String(data.expenseAlertThreshold),
        incomeAlertThreshold:  String(data.incomeAlertThreshold),
        balanceAlertThreshold: String(data.balanceAlertThreshold),
      });
      setHourlyDraft(data.hourlyRate != null ? String(data.hourlyRate) : "");
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const body: Partial<Record<string, number>> = {};
      for (const f of ALERT_FIELDS) {
        const val = parseInt(draft[f.key] ?? "0");
        if (!isNaN(val) && val >= 0) body[f.key] = val;
      }
      await fetch("/api/user-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      await fetchSettings();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  async function handleHourlySave() {
    setHourlySaving(true);
    setHourlySaved(false);
    try {
      const val = hourlyDraft === "" ? null : parseInt(hourlyDraft);
      await fetch("/api/user-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hourlyRate: isNaN(val as number) ? null : val }),
      });
      await fetchSettings();
      setHourlySaved(true);
      setTimeout(() => setHourlySaved(false), 2000);
    } catch (e) { console.error(e); }
    finally { setHourlySaving(false); }
  }

  const hasChanges = settings && ALERT_FIELDS.some(f =>
    String(settings[f.key]) !== draft[f.key]
  );
  const hourlyChanged = settings && hourlyDraft !== (settings.hourlyRate != null ? String(settings.hourlyRate) : "");

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl p-5 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#1e1b4b 100%)", border: "1px solid #4338ca40" }}>
        <p className="text-[14px] font-semibold tracking-widest uppercase mb-2" style={{ color: "#a5b4fc" }}>
          LINE 警報門檻設定
        </p>
        <p className="text-[13px]" style={{ color: "#818cf8" }}>
          設定 LINE Bot 推播警報的金額門檻，修改後即時生效
        </p>
      </div>

      {/* Alert thresholds */}
      <div className="rounded-2xl border overflow-hidden"
        style={{ background: "var(--bg-card)", borderColor: "var(--border)", boxShadow: "var(--card-shadow)" }}>
        {ALERT_FIELDS.map(f => (
          <div key={f.key} className="px-5 py-5 border-b last:border-0"
            style={{ borderColor: "var(--border-inner)" }}>
            <div className="flex items-start gap-3">
              <span className="text-xl flex-shrink-0 mt-0.5">{f.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[14px] mb-0.5" style={{ color: "var(--text-primary)" }}>{f.label}</p>
                <p className="text-[12px] mb-3" style={{ color: "var(--text-muted)" }}>{f.desc}</p>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium" style={{ color: "var(--text-sub)" }}>NT$</span>
                  <input
                    className={inputClass}
                    style={{ maxWidth: "160px" }}
                    type="number"
                    min={0}
                    step={100}
                    value={draft[f.key] ?? ""}
                    onWheel={e => e.currentTarget.blur()}
                    onChange={e => setDraft(d => ({ ...d, [f.key]: e.target.value }))}
                  />
                  {settings && (
                    <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                      目前：NT$ {fmt(settings[f.key])}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Save button */}
        <div className="px-5 py-4 flex items-center justify-between"
          style={{ background: "var(--bg-input)", borderTop: "1px solid var(--border-inner)" }}>
          {saved ? (
            <span className="text-[13px] font-semibold" style={{ color: "#10b981" }}>✓ 已儲存</span>
          ) : (
            <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>
              {hasChanges ? "有未儲存的變更" : "所有設定已同步"}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="px-5 py-2 rounded-xl text-[13px] font-bold transition-opacity"
            style={{
              background: hasChanges ? "var(--accent)" : "var(--border)",
              color: hasChanges ? "#fff" : "var(--text-muted)",
              opacity: saving ? 0.6 : 1,
            }}>
            {saving ? "儲存中…" : "儲存"}
          </button>
        </div>
      </div>

      {/* 時薪 / 購買力設定 */}
      <div className="rounded-2xl border overflow-hidden"
        style={{ background: "var(--bg-card)", borderColor: "var(--border)", boxShadow: "var(--card-shadow)" }}>
        <div className="px-5 py-5">
          <div className="flex items-start gap-3">
            <span className="text-xl flex-shrink-0 mt-0.5">⏱️</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[14px] mb-0.5" style={{ color: "var(--text-primary)" }}>我的時薪</p>
              <p className="text-[12px] mb-3" style={{ color: "var(--text-muted)" }}>
                設定後，交易記錄列表的金額上將顯示「≈ 工作 X 分鐘」提示
              </p>
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium" style={{ color: "var(--text-sub)" }}>NT$/hr</span>
                <input
                  className={inputClass}
                  style={{ maxWidth: "160px" }}
                  type="number"
                  min={0}
                  step={10}
                  placeholder="例：200"
                  value={hourlyDraft}
                  onWheel={e => e.currentTarget.blur()}
                  onChange={e => setHourlyDraft(e.target.value)}
                />
                {settings?.hourlyRate != null && (
                  <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                    目前：NT$ {fmt(settings.hourlyRate)}/hr
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="px-5 py-4 flex items-center justify-between"
          style={{ background: "var(--bg-input)", borderTop: "1px solid var(--border-inner)" }}>
          {hourlySaved ? (
            <span className="text-[13px] font-semibold" style={{ color: "#10b981" }}>✓ 已儲存</span>
          ) : (
            <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>
              {hourlyChanged ? "有未儲存的變更" : "設定已同步"}
            </span>
          )}
          <button
            onClick={handleHourlySave}
            disabled={hourlySaving || !hourlyChanged}
            className="px-5 py-2 rounded-xl text-[13px] font-bold transition-opacity"
            style={{
              background: hourlyChanged ? "var(--accent)" : "var(--border)",
              color: hourlyChanged ? "#fff" : "var(--text-muted)",
              opacity: hourlySaving ? 0.6 : 1,
            }}>
            {hourlySaving ? "儲存中…" : "儲存"}
          </button>
        </div>
      </div>
    </div>
  );
}
