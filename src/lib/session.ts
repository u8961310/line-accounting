import { getIronSession, IronSession } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  isLoggedIn: boolean;
}

const secret = process.env.SESSION_SECRET ?? "";
if (secret.length < 32) {
  // Log loudly but don't throw at module level — a module-level throw crashes Next.js middleware
  // and returns empty responses. The actual session operations will fail with a clear error instead.
  console.error("[session] FATAL: SESSION_SECRET must be at least 32 characters");
}

export const SESSION_OPTIONS = {
  password: secret || "placeholder-replace-me-with-a-real-secret",
  cookieName: "line-accounting-session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 7,
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(await cookies(), SESSION_OPTIONS);
}
