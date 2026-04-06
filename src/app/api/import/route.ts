import { NextRequest, NextResponse } from "next/server";
import { parseCsv, parseXlsFile } from "@/lib/csv";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const ALLOWED_EXTENSIONS = [".csv", ".xls", ".xlsx"];
const XLS_EXTENSIONS     = [".xls", ".xlsx"];

// Always use the dashboard user — never trust a client-supplied lineUserId
async function getDashboardUser() {
  return prisma.user.upsert({
    where: { lineUserId: "dashboard_user" },
    update: {},
    create: { lineUserId: "dashboard_user", displayName: "Dashboard" },
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "請上傳 CSV / XLS / XLSX 檔案" }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();

    if (!ALLOWED_EXTENSIONS.some((ext) => fileName.endsWith(ext))) {
      return NextResponse.json({ error: "僅接受 CSV / XLS / XLSX 檔案" }, { status: 400 });
    }

    const isXls = XLS_EXTENSIONS.some((ext) => fileName.endsWith(ext));

    const user = await getDashboardUser();

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
    return NextResponse.json({ error: "匯入失敗，請確認檔案格式" }, { status: 500 });
  }
}
