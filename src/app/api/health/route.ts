import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface HealthResponse {
  status: "ok" | "error";
  timestamp: string;
  services: {
    database: "ok" | "error";
  };
  version: string;
}

export async function GET(): Promise<NextResponse> {
  const timestamp = new Date().toISOString();

  let dbStatus: "ok" | "error" = "error";

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = "ok";
  } catch (error) {
    console.error("Health check DB error:", error);
  }

  const response: HealthResponse = {
    status: dbStatus === "ok" ? "ok" : "error",
    timestamp,
    services: {
      database: dbStatus,
    },
    version: "1.0.0",
  };

  const httpStatus = response.status === "ok" ? 200 : 503;
  return NextResponse.json(response, { status: httpStatus });
}
