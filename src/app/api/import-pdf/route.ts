import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseSinopacCcPdf } from "@/lib/pdf/sinopac_cc";
import { parseKgiBankPdf, isKgiBankPdf } from "@/lib/pdf/kgi_bank";
import { batchCategorize } from "@/lib/csv/categorizer";
import { logAudit } from "@/lib/audit";
import pdfParse from "pdf-parse";

async function getDashboardUser() {
  return prisma.user.upsert({
    where: { lineUserId: "dashboard_user" },
    update: {},
    create: { lineUserId: "dashboard_user", displayName: "Dashboard" },
  });
}

// ── 凱基銀行存款 PDF ──────────────────────────────────────────────────────────
async function handleKgiBank(buffer: Buffer) {
  const user = await getDashboardUser();
  const { transactions: rawTxs, lastBalance } = await parseKgiBankPdf(buffer);

  const categorized = await batchCategorize(rawTxs);

  let imported = 0;
  let skipped  = 0;
  const errors: string[] = [];
  const importedTxs: { date: string; type: string; amount: number; note: string; category: string }[] = [];

  for (const tx of categorized) {
    try {
      const dateOnly = new Date(tx.date);
      dateOnly.setHours(0, 0, 0, 0);

      const existing = await prisma.transaction.findFirst({
        where: { userId: user.id, date: dateOnly, amount: tx.amount, source: tx.source },
      });

      if (existing) {
        skipped++;
      } else {
        await prisma.transaction.create({
          data: {
            userId: user.id,
            date: dateOnly,
            amount: tx.amount,
            category: tx.category,
            type: tx.type,
            note: tx.note,
            source: tx.source,
          },
        });
        imported++;
        importedTxs.push({
          date: dateOnly.toISOString().split("T")[0],
          type: tx.type,
          amount: tx.amount,
          note: tx.note ?? "",
          category: tx.category ?? "",
        });
      }

      await new Promise<void>((r) => setTimeout(r, 100));
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  // 更新帳戶餘額
  if (lastBalance) {
    const existing = await prisma.bankBalance.findUnique({
      where: { userId_source: { userId: user.id, source: "kgi_bank" } },
    });
    if (!existing || lastBalance.date >= existing.asOfDate) {
      await prisma.bankBalance.upsert({
        where: { userId_source: { userId: user.id, source: "kgi_bank" } },
        update: { balance: lastBalance.amount, asOfDate: lastBalance.date },
        create: { userId: user.id, source: "kgi_bank", balance: lastBalance.amount, asOfDate: lastBalance.date },
      });
    }
  }

  void logAudit({
    action:  "pdf_import",
    tool:    "kgi_bank",
    summary: { imported, skipped, errors: errors.length },
  });

  return NextResponse.json({
    success: true,
    imported,
    skipped,
    source: "kgi_bank",
    errors: errors.slice(0, 5),
    transactions: importedTxs,
    message: `成功匯入 ${imported} 筆，跳過 ${skipped} 筆重複資料`,
  });
}

// ── 永豐信用卡 PDF ────────────────────────────────────────────────────────────
async function handleSinopacCc(buffer: Buffer, creditCardId: string | null) {
  const user = await getDashboardUser();
  const result = await parseSinopacCcPdf(buffer);

  let billRecord = null;
  if (creditCardId) {
    const existingBill = await prisma.creditCardBill.findFirst({
      where: { creditCardId, billingMonth: result.summary.billingMonth },
    });
    if (existingBill) {
      billRecord = await prisma.creditCardBill.update({
        where: { id: existingBill.id },
        data: {
          totalAmount: result.summary.totalAmount,
          minimumPayment: result.summary.minimumPayment,
          dueDate: result.summary.dueDate,
        },
      });
    } else {
      billRecord = await prisma.creditCardBill.create({
        data: {
          creditCardId,
          billingMonth: result.summary.billingMonth,
          totalAmount: result.summary.totalAmount,
          minimumPayment: result.summary.minimumPayment,
          dueDate: result.summary.dueDate,
          status: "unpaid",
        },
      });
    }

    // 持久化分期未清償餘額，並更新已使用額度
    const paidSoFar = billRecord ? parseFloat(String(billRecord.paidAmount ?? 0)) : 0;
    const effectiveBalance = result.summary.totalAmount - paidSoFar + result.summary.installmentOutstanding;
    await prisma.creditCard.update({
      where: { id: creditCardId },
      data: {
        currentBalance: effectiveBalance,
        installmentOutstanding: result.summary.installmentOutstanding,
      },
    });
  }

  const categorized = await batchCategorize(result.transactions);

  let imported = 0;
  let skipped  = 0;
  const errors: string[] = [];
  const importedTxs: { date: string; type: string; amount: number; note: string; category: string }[] = [];

  for (const tx of categorized) {
    try {
      const existing = await prisma.transaction.findFirst({
        where: { userId: user.id, date: tx.date, amount: tx.amount, source: tx.source, note: tx.note },
      });

      if (existing) {
        skipped++;
      } else {
        await prisma.transaction.create({
          data: {
            userId: user.id,
            date: tx.date,
            amount: tx.amount,
            category: tx.category,
            type: tx.type,
            note: tx.note,
            source: tx.source,
          },
        });
        imported++;
        importedTxs.push({
          date: tx.date instanceof Date ? tx.date.toISOString().split("T")[0] : String(tx.date),
          type: tx.type,
          amount: tx.amount,
          note: tx.note ?? "",
          category: tx.category ?? "",
        });
      }

      await new Promise<void>((r) => setTimeout(r, 100));
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  void logAudit({
    action:  "pdf_import",
    tool:    "sinopac_cc",
    summary: { imported, skipped, errors: errors.length, billingMonth: result.summary.billingMonth },
  });

  return NextResponse.json({
    success: true,
    imported,
    skipped,
    source: "sinopac_cc",
    errors: errors.slice(0, 5),
    transactions: importedTxs,
    bill: billRecord
      ? {
          billingMonth: result.summary.billingMonth,
          totalAmount: result.summary.totalAmount,
          dueDate: result.summary.dueDate.toISOString(),
          installmentOutstanding: result.summary.installmentOutstanding,
        }
      : null,
    message: `帳單 ${result.summary.billingMonth} 匯入完成，共 ${imported} 筆消費記錄`,
  });
}

// ── 主入口 ────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const formData   = await req.formData();
    const file       = formData.get("file") as File | null;
    const creditCardId = formData.get("creditCardId") as string | null;

    if (!file || !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "請上傳 PDF 檔案" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // 先讀文字，偵測格式
    const pdfData = await pdfParse(buffer);
    const text = pdfData.text;

    if (isKgiBankPdf(text)) {
      return handleKgiBank(buffer);
    }

    return handleSinopacCc(buffer, creditCardId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[import-pdf]", e);
    void logAudit({ action: "pdf_import", status: "error", errorMsg: msg });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
