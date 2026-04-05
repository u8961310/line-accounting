"use client";

import { useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        const from = searchParams.get("from") ?? "/dashboard";
        router.push(from);
        router.refresh();
      } else {
        const data = await res.json() as { error?: string };
        setError(data.error ?? "登入失敗");
      }
    } catch {
      setError("網路錯誤，請稍後再試");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0D1117" }}>
      <div className="w-full max-w-sm">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">💰</div>
          <h1 className="text-2xl font-bold" style={{ color: "#E6EDF3" }}>記帳系統</h1>
          <p className="text-sm mt-1" style={{ color: "#8B949E" }}>LINE Accounting Dashboard</p>
        </div>

        {/* Card */}
        <form
          onSubmit={handleSubmit}
          className="rounded-xl p-8"
          style={{ backgroundColor: "#161B22", border: "1px solid #21262D" }}
        >
          <div className="mb-6">
            <label
              htmlFor="password"
              className="block text-sm font-medium mb-2"
              style={{ color: "#8B949E" }}
            >
              密碼
            </label>
            <input
              id="password"
              type="password"
              name="password"
              autoComplete="current-password"
              autoFocus
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="輸入管理密碼"
              className="w-full px-4 py-3 rounded-lg text-sm outline-none transition-colors"
              style={{
                backgroundColor: "#0D1117",
                border: "1px solid #21262D",
                color: "#E6EDF3",
              }}
              onFocus={e => { e.currentTarget.style.borderColor = "#58A6FF"; }}
              onBlur={e => { e.currentTarget.style.borderColor = "#21262D"; }}
            />
          </div>

          {error && (
            <p className="text-sm mb-4 text-center" style={{ color: "#F85149" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg text-sm font-semibold transition-opacity"
            style={{
              backgroundColor: "#238636",
              color: "#fff",
              opacity: loading ? 0.6 : 1,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "登入中..." : "登入"}
          </button>
        </form>

        <p className="text-center text-xs mt-6" style={{ color: "#30363D" }}>
          支援 1Password · Bitwarden · 瀏覽器內建密碼管理
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
