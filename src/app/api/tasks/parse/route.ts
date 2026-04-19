import { NextRequest, NextResponse } from "next/server";
import { parseTaskText } from "@/lib/claude-task-parse";

export const dynamic = "force-dynamic";

/**
 * POST /api/tasks/parse
 * 自然語言 → 結構化任務。
 * 驗證：middleware x-api-key: INTERNAL_API_KEY
 * Body: { text: string }
 * Response: ParsedTask | { error }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { text } = body as { text?: string };
  if (!text || typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const parsed = await parseTaskText(text);
  if (!parsed) {
    return NextResponse.json(
      { error: "無法解析，請重新輸入" },
      { status: 422 }
    );
  }

  return NextResponse.json(parsed);
}
