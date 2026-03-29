import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { batchCategorize } from "@/lib/csv/categorizer";
import { ParsedTransaction, BankSource } from "@/lib/csv/types";

export async function POST(): Promise<NextResponse> {
  // 檢查 API key 是否存在
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ updated: 0, total: 0, message: "❌ 未設定 ANTHROPIC_API_KEY，請檢查 .env 並重啟伺服器" }, { status: 400 });
  }

  // Fetch all non-LINE transactions
  const txs = await prisma.transaction.findMany({
    where: { source: { not: "line" } },
    select: { id: true, date: true, amount: true, type: true, note: true, source: true, category: true },
  });

  if (txs.length === 0) {
    return NextResponse.json({ updated: 0, total: 0, message: "沒有可重新分類的交易" });
  }

  const parsed: ParsedTransaction[] = txs.map(tx => ({
    date: tx.date,
    amount: parseFloat(tx.amount.toString()),
    type: tx.type as "收入" | "支出",
    category: "其他",
    note: tx.note ?? "",
    source: tx.source as BankSource,
  }));

  let categorized: ParsedTransaction[];
  try {
    categorized = await batchCategorize(parsed);
  } catch (err) {
    console.error("[recategorize] batchCategorize error:", err);
    return NextResponse.json({ updated: 0, total: txs.length, message: "❌ AI 分類呼叫失敗，請查看 server log" }, { status: 500 });
  }

  // Count how many were classified as non-其他 (AI actually did something)
  const nonOther = categorized.filter(c => c.category !== "其他").length;
  console.log(`[recategorize] AI 結果：${nonOther}/${txs.length} 筆非「其他」`);

  // Update all rows (not just changed ones) to force AI categories
  const updates = categorized
    .map((ct, i) => ({ id: txs[i].id, old: txs[i].category, new: ct.category }))
    .filter(row => row.old !== row.new);

  await Promise.all(
    updates.map(row =>
      prisma.transaction.update({ where: { id: row.id }, data: { category: row.new } })
    )
  );

  return NextResponse.json({
    updated: updates.length,
    total: txs.length,
    nonOther,
    message: `已更新 ${updates.length} / ${txs.length} 筆分類（AI 識別出 ${nonOther} 筆非「其他」）`,
  });
}
