"use client";

import { useEffect, useState, useCallback } from "react";
import { DEMO_NOTIFICATIONS } from "@/lib/demo-data";
import type { AppNotification, NotificationsResponse } from "@/app/api/notifications/route";

const LS_KEY = "notif_read_ids";

function loadReadIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(LS_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch { return new Set(); }
}

function saveReadIds(ids: Set<string>) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(Array.from(ids))); } catch { /* noop */ }
}

// ── Helpers ────────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<AppNotification["type"], string> = {
  budget: "預算",
  bill:   "帳單",
  goal:   "目標",
};

const SEVERITY_COLOR: Record<AppNotification["severity"], string> = {
  danger: "#ef4444",
  warn:   "#f59e0b",
  info:   "#6366f1",
};

const SEVERITY_BG: Record<AppNotification["severity"], string> = {
  danger: "rgba(239,68,68,0.08)",
  warn:   "rgba(245,158,11,0.08)",
  info:   "rgba(99,102,241,0.08)",
};

const SEVERITY_BORDER: Record<AppNotification["severity"], string> = {
  danger: "rgba(239,68,68,0.25)",
  warn:   "rgba(245,158,11,0.25)",
  info:   "rgba(99,102,241,0.25)",
};

const SEVERITY_ICON: Record<AppNotification["severity"], string> = {
  danger: "🚨",
  warn:   "⚠️",
  info:   "ℹ️",
};

// ── Sub-components (defined outside parent) ────────────────────────────────

interface BellButtonProps {
  unreadCount: number;
  dangerUnread: number;
  open:        boolean;
  onClick:     () => void;
}

function BellButton({ unreadCount, dangerUnread, open, onClick }: BellButtonProps) {
  const badgeColor = dangerUnread > 0 ? "#ef4444" : "#f59e0b";
  return (
    <button
      onClick={onClick}
      className="relative flex items-center justify-center w-9 h-9 rounded-xl transition-colors"
      style={{
        background: open ? "var(--bg-input)" : "transparent",
        border:     `1px solid ${open ? "var(--border)" : "transparent"}`,
        color:      unreadCount > 0 ? (dangerUnread > 0 ? "#ef4444" : "#f59e0b") : "var(--text-sub)",
      }}
      title="通知中心">
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
      {unreadCount > 0 && (
        <span
          className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full flex items-center justify-center text-[14px] font-black text-white px-1"
          style={{ background: badgeColor }}>
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </button>
  );
}

interface NotifItemProps {
  notif:     AppNotification;
  isRead:    boolean;
  onDismiss: (id: string) => void;
  onRestore: (id: string) => void;
}

function NotifItem({ notif, isRead, onDismiss, onRestore }: NotifItemProps) {
  return (
    <div className="rounded-xl px-4 py-3 transition-opacity"
      style={{
        background: isRead ? "var(--bg-input)" : SEVERITY_BG[notif.severity],
        border:     `1px solid ${isRead ? "var(--border-inner)" : SEVERITY_BORDER[notif.severity]}`,
        opacity:    isRead ? 0.5 : 1,
      }}>
      <div className="flex items-start gap-2">
        <span className="text-[14px] flex-shrink-0 mt-0.5">
          {isRead ? "✓" : SEVERITY_ICON[notif.severity]}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[14px] font-bold px-1.5 py-0.5 rounded"
              style={{
                background: isRead ? "var(--bg-card)" : `${SEVERITY_COLOR[notif.severity]}22`,
                color:      isRead ? "var(--text-muted)" : SEVERITY_COLOR[notif.severity],
              }}>
              {TYPE_LABEL[notif.type]}
            </span>
            <p className="text-[14px] font-semibold truncate flex-1"
              style={{ color: isRead ? "var(--text-muted)" : "var(--text-primary)" }}>
              {notif.title}
            </p>
          </div>
          <p className="text-[14px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
            {notif.body}
          </p>
        </div>
        <button
          onClick={() => isRead ? onRestore(notif.id) : onDismiss(notif.id)}
          className="flex-shrink-0 text-[14px] px-1.5 py-0.5 rounded hover:opacity-80 transition-opacity"
          style={{ color: "var(--text-muted)" }}
          title={isRead ? "標為未讀" : "標為已讀"}>
          {isRead ? "↩" : "✕"}
        </button>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function NotificationPanel({ isDemo }: { isDemo: boolean }) {
  const [data,    setData]    = useState<NotificationsResponse | null>(null);
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [showRead, setShowRead] = useState(false);

  useEffect(() => { setReadIds(loadReadIds()); }, []);

  const fetch_ = useCallback(() => {
    if (isDemo) { setData(DEMO_NOTIFICATIONS as NotificationsResponse); return; }
    setLoading(true);
    fetch("/api/notifications")
      .then(r => r.json())
      .then((d: NotificationsResponse) => setData(d))
      .finally(() => setLoading(false));
  }, [isDemo]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const dismiss = useCallback((id: string) => {
    setReadIds(prev => {
      const next = new Set(prev);
      next.add(id);
      saveReadIds(next);
      return next;
    });
  }, []);

  const restore = useCallback((id: string) => {
    setReadIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      saveReadIds(next);
      return next;
    });
  }, []);

  const markAllRead = useCallback((ids: string[]) => {
    setReadIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.add(id));
      saveReadIds(next);
      return next;
    });
  }, []);

  const notifs = data?.notifications ?? [];
  const unread = notifs.filter(n => !readIds.has(n.id));
  const read   = notifs.filter(n => readIds.has(n.id));

  const unreadDanger = unread.filter(n => n.severity === "danger").length;
  const unreadWarn   = unread.filter(n => n.severity === "warn").length;

  const grouped = {
    budget: unread.filter(n => n.type === "budget"),
    bill:   unread.filter(n => n.type === "bill"),
    goal:   unread.filter(n => n.type === "goal"),
  };

  return (
    <div className="relative">
      <BellButton
        unreadCount={unread.length}
        dangerUnread={unreadDanger}
        open={open}
        onClick={() => setOpen(o => !o)}
      />

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />

          <div
            className="absolute right-0 top-full mt-2 z-40 rounded-2xl overflow-hidden"
            style={{
              width:     "360px",
              maxHeight: "560px",
              background:  "var(--bg-card)",
              border:      "1px solid var(--border)",
              boxShadow:   "0 16px 48px rgba(0,0,0,0.5)",
            }}>

            {/* Header */}
            <div className="px-5 py-3.5 flex items-center justify-between border-b"
              style={{ borderColor: "var(--border-inner)" }}>
              <div className="flex items-center gap-2">
                <p className="font-bold text-[14px]" style={{ color: "var(--text-primary)" }}>通知中心</p>
                {unreadDanger > 0 && (
                  <span className="text-[14px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: "#ef444422", color: "#ef4444" }}>
                    {unreadDanger} 緊急
                  </span>
                )}
                {unreadWarn > 0 && (
                  <span className="text-[14px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: "#f59e0b22", color: "#f59e0b" }}>
                    {unreadWarn} 警告
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unread.length > 0 && (
                  <button onClick={() => markAllRead(unread.map(n => n.id))}
                    className="text-[14px] font-medium hover:opacity-80 transition-opacity"
                    style={{ color: "var(--accent)" }}>
                    全部已讀
                  </button>
                )}
                <button onClick={fetch_}
                  className="text-[14px] font-medium"
                  style={{ color: "var(--text-muted)" }}>
                  {loading ? "更新中…" : "重新整理"}
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="overflow-y-auto" style={{ maxHeight: "480px" }}>
              {unread.length === 0 && read.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-2xl mb-2">✅</p>
                  <p className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>一切正常</p>
                  <p className="text-[14px] mt-1" style={{ color: "var(--text-muted)" }}>目前沒有任何預算超標或帳單到期通知</p>
                </div>
              ) : (
                <div className="px-4 py-3 space-y-4">

                  {/* 未讀通知 */}
                  {unread.length === 0 ? (
                    <div className="text-center py-6">
                      <p className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>✅ 所有通知已讀</p>
                    </div>
                  ) : (
                    (["budget", "bill", "goal"] as const).map(type => {
                      const items = grouped[type];
                      if (items.length === 0) return null;
                      const labels: Record<string, string> = { budget: "預算警示", bill: "帳單到期", goal: "儲蓄目標" };
                      return (
                        <div key={type}>
                          <p className="text-[14px] font-semibold mb-2 tracking-wide uppercase"
                            style={{ color: "var(--text-muted)" }}>
                            {labels[type]}
                          </p>
                          <div className="space-y-2">
                            {items.map(n => (
                              <NotifItem key={n.id} notif={n} isRead={false}
                                onDismiss={dismiss} onRestore={restore} />
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}

                  {/* 已讀通知（可折疊） */}
                  {read.length > 0 && (
                    <div>
                      <button
                        onClick={() => setShowRead(s => !s)}
                        className="w-full text-left text-[14px] font-semibold py-1 tracking-wide flex items-center gap-1 hover:opacity-80 transition-opacity"
                        style={{ color: "var(--text-muted)" }}>
                        {showRead ? "▾" : "▸"} 已讀通知（{read.length}）
                      </button>
                      {showRead && (
                        <div className="space-y-2 mt-2">
                          {read.map(n => (
                            <NotifItem key={n.id} notif={n} isRead={true}
                              onDismiss={dismiss} onRestore={restore} />
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
