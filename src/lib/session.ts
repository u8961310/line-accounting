import { getIronSession, IronSession } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  isLoggedIn: boolean;
}

const secret = process.env.SESSION_SECRET ?? "";
if (secret.length < 32) {
  throw new Error("SESSION_SECRET must be at least 32 characters — set a strong random value");
}

export const SESSION_OPTIONS = {
  password: secret,
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
