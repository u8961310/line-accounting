import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseSinopacCcPdf } from "@/lib/pdf/sinopac_cc";
import { batchCategorize } from "@/lib/csv/categorizer";

async function getDashboardUser() {
  return prisma.user.upsert({
    where: { lineUserId: "dashboard_user" },
    update: {},
    create: { lineUserId: "dashboard_user", displayName: "Dashboard" },
  });
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const creditCardId = formData.get("creditCardId") as string | null;

    if (!file || !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "請上傳 PDF 檔案" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await parseSinopacCcPdf(buffer);

    const user = await getDashboardUser();

    // --- Upsert CreditCardBill using findFirst + create/update pattern ---
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
    }

    // --- AI categorize transactions ---
    const categorized = await batchCategorize(result.transactions);

    // --- Save transactions with sinopac_cc-aware dedup ---
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const tx of categorized) {
      try {
        const existing = await prisma.transaction.findFirst({
          where: {
            userId: user.id,
            date: tx.date,
            amount: tx.amount,
            source: tx.source,
            note: tx.note,
          },
        });

        if (existing) {
          skipped++;
        } else {
          const created = await prisma.transaction.create({
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
        }

        await new Promise<void>((r) => setTimeout(r, 100));
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
      }
    }

    return NextResponse.json({
      imported,
      skipped,
      errors: errors.slice(0, 5),
      bill: billRecord
        ? {
            billingMonth: result.summary.billingMonth,
            totalAmount: result.summary.totalAmount,
            dueDate: result.summary.dueDate.toISOString(),
          }
        : null,
      message: `帳單 ${result.summary.billingMonth} 匯入完成，共 ${imported} 筆消費記錄`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[import-pdf]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
