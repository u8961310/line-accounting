import { NextRequest, NextResponse } from "next/server";
import { parseTransaction } from "@/lib/claude-parse";

export const dynamic = "force-dynamic";

/**
 * POST /api/transactions/parse
 * 解析自然語言記帳輸入為結構化欄位。
 * 驗證：middleware x-api-key: INTERNAL_API_KEY
 * Body: { text: string }
 * Response: ParsedTransaction | { error: string }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { text } = body as { text?: string };
  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const parsed = await parseTransaction(text);
  if (!parsed) {
    return NextResponse.json(
      { error: "無法解析，請重新輸入或手動記帳" },
      { status: 422 }
    );
  }

  return NextResponse.json(parsed);
}
