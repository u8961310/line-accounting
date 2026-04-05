export interface AppTheme {
  id: "blue" | "slate" | "white";
  name: string;
  mode: "light" | "dark";
  vars: Record<string, string>;
}

export const THEMES: AppTheme[] = [
  {
    id: "slate",
    name: "🌙 深色",
    mode: "dark",
    vars: {
      "--bg-page":       "#0F1117",
      "--bg-card":       "#1C2333",
      "--bg-input":      "#161B27",
      "--border":        "#2A3650",
      "--border-inner":  "#1F2D44",
      "--text-primary":  "#E2E8F0",
      "--text-sub":      "#6B8CAE",
      "--text-muted":    "#3D526B",
      "--accent":        "#4299E1",
      "--accent-dark":   "#2B6CB0",
      "--accent-light":  "#63B3ED",
      "--btn-gradient":  "linear-gradient(135deg,#2B6CB0,#4299E1)",
      "--card-shadow":   "0 4px 20px rgba(0,0,0,0.25)",
      "--hero-bg":       "linear-gradient(135deg,#141926 0%,#1A2540 50%,#141926 100%)",
      "--hero-border":   "#2A3A5C",
      "--tooltip-bg":    "#1C2333",
      "--tooltip-border":"#2A3650",
      "--tooltip-text":  "#E2E8F0",
    },
  },
  {
    id: "blue",
    name: "☀️ 淺藍",
    mode: "light",
    vars: {
      "--bg-page":       "#EFF6FF",
      "--bg-card":       "#FFFFFF",
      "--bg-input":      "#F0F7FF",
      "--border":        "#BFDBFE",
      "--border-inner":  "#DBEAFE",
      "--text-primary":  "#1E3A5F",
      "--text-sub":      "#3B6DA8",
      "--text-muted":    "#6895C8",
      "--accent":        "#2563EB",
      "--accent-dark":   "#1D4ED8",
      "--accent-light":  "#3B82F6",
      "--btn-gradient":  "linear-gradient(135deg,#1D4ED8,#3B82F6)",
      "--card-shadow":   "0 2px 8px rgba(37,99,235,0.07),0 0 0 1px rgba(37,99,235,0.04)",
      "--hero-bg":       "linear-gradient(135deg,#1E3A8A 0%,#2563EB 50%,#1E40AF 100%)",
      "--hero-border":   "#3B82F6",
      "--tooltip-bg":    "#FFFFFF",
      "--tooltip-border":"#BFDBFE",
      "--tooltip-text":  "#1E3A5F",
    },
  },
  {
    id: "white",
    name: "☀️ 白底",
    mode: "light",
    vars: {
      "--bg-page":       "#F8FAFC",
      "--bg-card":       "#FFFFFF",
      "--bg-input":      "#F1F5F9",
      "--border":        "#E2E8F0",
      "--border-inner":  "#EEF2F7",
      "--text-primary":  "#0F172A",
      "--text-sub":      "#475569",
      "--text-muted":    "#94A3B8",
      "--accent":        "#2563EB",
      "--accent-dark":   "#1D4ED8",
      "--accent-light":  "#3B82F6",
      "--btn-gradient":  "linear-gradient(135deg,#1D4ED8,#3B82F6)",
      "--card-shadow":   "0 1px 2px rgba(0,0,0,0.05),0 4px 16px rgba(0,0,0,0.06)",
      "--hero-bg":       "linear-gradient(135deg,#0F172A 0%,#1E3A8A 50%,#0F172A 100%)",
      "--hero-border":   "#334155",
      "--tooltip-bg":    "#FFFFFF",
      "--tooltip-border":"#E2E8F0",
      "--tooltip-text":  "#0F172A",
    },
  },
];

export function themeToCSS(theme: AppTheme): string {
  return `:root { ${Object.entries(theme.vars).map(([k, v]) => `${k}: ${v}`).join("; ")} }`;
}
