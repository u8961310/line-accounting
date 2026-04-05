import { NextRequest, NextResponse } from "next/server";
import { parseCsv, parseXlsFile } from "@/lib/csv";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

const XLS_EXTENSIONS = [".xls", ".xlsx"];

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const lineUserId = formData.get("lineUserId");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "請上傳 CSV / XLS / XLSX 檔案" }, { status: 400 });
    }

    if (!lineUserId || typeof lineUserId !== "string") {
      return NextResponse.json({ error: "請提供使用者 ID" }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();
    const isXls = XLS_EXTENSIONS.some((ext) => fileName.endsWith(ext));

    // Ensure user exists
    const user = await prisma.user.upsert({
      where: { lineUserId },
      update: {},
      create: {
        lineUserId,
        displayName: lineUserId,
      },
    });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = isXls
      ? await parseXlsFile(buffer, user.id)
      : await parseCsv(buffer, user.id);

    void logAudit({
      action:  "csv_import",
      tool:    result.source,
      params:  { fileName: file.name, isXls },
      summary: { imported: result.imported, skipped: result.skipped, errors: result.errors.length },
    });

    return NextResponse.json({
      success: true,
      imported: result.imported,
      skipped: result.skipped,
      source: result.source,
      errors: result.errors,
      transactions: result.transactions,
      message: `成功匯入 ${result.imported} 筆，跳過 ${result.skipped} 筆重複資料`,
    });
  } catch (error) {
    console.error("Import error:", error);
    const message = error instanceof Error ? error.message : "匯入失敗";
    void logAudit({ action: "csv_import", status: "error", errorMsg: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
