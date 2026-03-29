export interface AppTheme {
  id: "blue" | "slate" | "white";
  name: string;
  vars: Record<string, string>;
}

export const THEMES: AppTheme[] = [
  {
    id: "blue",
    name: "A 淺藍",
    vars: {
      "--bg-page":       "#EFF6FF",
      "--bg-card":       "#FFFFFF",
      "--bg-input":      "#EFF6FF",
      "--border":        "#BFDBFE",
      "--border-inner":  "#DBEAFE",
      "--text-primary":  "#1E3A5F",
      "--text-sub":      "#3B6DA8",
      "--text-muted":    "#6895C8",
      "--accent":        "#2563EB",
      "--accent-dark":   "#1D4ED8",
      "--accent-light":  "#3B82F6",
      "--btn-gradient":  "linear-gradient(135deg,#1D4ED8,#3B82F6)",
      "--card-shadow":   "0 2px 12px rgba(37,99,235,0.08)",
      "--hero-bg":       "linear-gradient(135deg,#1E3A8A 0%,#2563EB 50%,#1E3A8A 100%)",
      "--hero-border":   "#3B82F6",
      "--tooltip-bg":    "#FFFFFF",
      "--tooltip-border":"#BFDBFE",
      "--tooltip-text":  "#1E3A5F",
    },
  },
  {
    id: "slate",
    name: "B 石板灰",
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
    id: "white",
    name: "C 白底",
    vars: {
      "--bg-page":       "#F9FAFB",
      "--bg-card":       "#FFFFFF",
      "--bg-input":      "#F3F4F6",
      "--border":        "#E5E7EB",
      "--border-inner":  "#F0F1F3",
      "--text-primary":  "#111827",
      "--text-sub":      "#4B5563",
      "--text-muted":    "#6B7280",
      "--accent":        "#2563EB",
      "--accent-dark":   "#1D4ED8",
      "--accent-light":  "#3B82F6",
      "--btn-gradient":  "linear-gradient(135deg,#1D4ED8,#3B82F6)",
      "--card-shadow":   "0 1px 3px rgba(0,0,0,0.07),0 4px 12px rgba(0,0,0,0.04)",
      "--hero-bg":       "linear-gradient(135deg,#1E3A8A 0%,#2563EB 50%,#1E3A8A 100%)",
      "--hero-border":   "#3B82F6",
      "--tooltip-bg":    "#FFFFFF",
      "--tooltip-border":"#E5E7EB",
      "--tooltip-text":  "#111827",
    },
  },
];

export function themeToCSS(theme: AppTheme): string {
  return `:root { ${Object.entries(theme.vars).map(([k, v]) => `${k}: ${v}`).join("; ")} }`;
}
