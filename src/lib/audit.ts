import { prisma } from "@/lib/db";

export type AuditAction =
  | "mcp_call"
  | "csv_import" | "pdf_import" | "json_restore"
  | "notion_sync"
  | "ai_recategorize"
  | "login"
  | "transaction_delete"
  | "data_export";

interface LogAuditOptions {
  action: AuditAction;
  tool?: string;
  params?: Record<string, unknown>;
  summary?: Record<string, unknown>;
  status?: "success" | "error";
  errorMsg?: string;
}

/** 寫入稽核日誌，失敗只 console.error，不拋出 */
export async function logAudit(opts: LogAuditOptions): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action:   opts.action,
        tool:     opts.tool,
        params:   opts.params    as never,
        summary:  opts.summary   as never,
        status:   opts.status   ?? "success",
        errorMsg: opts.errorMsg,
      },
    });
  } catch (e) {
    console.error("[audit] 寫入失敗:", e);
  }
}
