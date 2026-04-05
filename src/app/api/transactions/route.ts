import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page   = Math.max(1, parseInt(searchParams.get("page")  ?? "1",  10));
  const limit  = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "30", 10)));
  const skip   = (page - 1) * limit;

  try {
    const user = await prisma.user.findFirst({ where: { lineUserId: "dashboard_user" } });
    if (!user) return NextResponse.json({ items: [], total: 0, page, limit });

    const noteSearch     = searchParams.get("note");
    const categoryFilter = searchParams.get("category");
    const monthFilter    = searchParams.get("month"); // YYYY-MM
    const exportCsv      = searchParams.get("export") === "csv";
    const allResults     = searchParams.get("all") === "1"; // 不分頁，回傳所有結果（JSON）
    const typeFilter     = searchParams.get("type");       // 收入 | 支出
    const sourceFilter   = searchParams.get("source");     // 逗號分隔的 source 清單
    const dateFrom       = searchParams.get("dateFrom");   // YYYY-MM-DD
    const dateTo         = searchParams.get("dateTo");     // YYYY-MM-DD
    const amountMin      = searchParams.get("amountMin");  // number string
    const amountMax      = searchParams.get("amountMax");  // number string

    const dateFilter = monthFilter ? (() => {
      const [y, m] = monthFilter.split("-").map(Number);
      return { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) };
    })() : (dateFrom || dateTo) ? {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo   ? { lte: new Date(dateTo + "T23:59:59") } : {}),
    } : undefined;

    const where = {
      userId: user.id,
      ...(noteSearch     ? { note:     { contains: noteSearch } } : {}),
      ...(categoryFilter ? { category: categoryFilter           } : {}),
      ...(typeFilter     ? { type:     typeFilter               } : {}),
      ...(sourceFilter   ? { source:   { in: sourceFilter.split(",") } } : {}),
      ...(dateFilter     ? { date:     dateFilter               } : {}),
      ...((amountMin || amountMax) ? { amount: {
        ...(amountMin ? { gte: parseFloat(amountMin) } : {}),
        ...(amountMax ? { lte: parseFloat(amountMax) } : {}),
      } } : {}),
    };

    // export=json: 全部交易匯出為 JSON 備份檔
    if (searchParams.get("export") === "json") {
      const rows = await prisma.transaction.findMany({
        where,
        orderBy: { date: "desc" },
        select: { id: true, date: true, type: true, category: true, amount: true, note: true, source: true, mood: true },
      });
      const data = rows.map(r => ({
        id: r.id,
        date: r.date.toISOString().split("T")[0],
        type: r.type,
        category: r.category,
        amount: parseFloat(r.amount.toString()),
        note: r.note,
        source: r.source,
        mood: r.mood ?? null,
      }));
      const filename = `transactions-backup-${new Date().toISOString().split("T")[0]}.json`;
      return new NextResponse(JSON.stringify(data, null, 2), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // export=xlsx: 匯出為 Excel 檔案
    if (searchParams.get("export") === "xlsx") {
      const rows = await prisma.transaction.findMany({
        where,
        orderBy: { date: "desc" },
        select: { date: true, type: true, category: true, amount: true, note: true, source: true, mood: true },
      });
      const sheetData = [
        ["日期", "類型", "分類", "金額", "備註", "來源", "心情"],
        ...rows.map(r => [
          r.date.toISOString().split("T")[0],
          r.type,
          r.category,
          parseFloat(r.amount.toString()),
          r.note,
          r.source,
          r.mood ?? "",
        ]),
      ];
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      // 設定欄寬
      ws["!cols"] = [{ wch: 12 }, { wch: 6 }, { wch: 10 }, { wch: 10 }, { wch: 30 }, { wch: 14 }, { wch: 8 }];
      XLSX.utils.book_append_sheet(wb, ws, "交易記錄");
      const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as number[];
      const filename = `transactions-${new Date().toISOString().split("T")[0]}.xlsx`;
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // all=1: 不分頁，回傳全部結果（JSON 格式，用於儲蓄分析等場景）
    if (allResults) {
      const rows = await prisma.transaction.findMany({
        where,
        orderBy: { date: "desc" },
        select: { date: true, type: true, amount: true, source: true },
      });
      return NextResponse.json({
        items: rows.map(r => ({
          date:   r.date.toISOString().split("T")[0],
          type:   r.type,
          amount: parseFloat(r.amount.toString()),
          source: r.source,
        })),
      });
    }

    // CSV export: return all rows as CSV, no pagination
    if (exportCsv) {
      const rows = await prisma.transaction.findMany({
        where,
        orderBy: { date: "desc" },
        select: { date: true, type: true, category: true, amount: true, note: true, source: true },
      });
      const header = "日期,類型,分類,金額,備註,來源";
      const lines  = rows.map(r =>
        [
          r.date.toISOString().split("T")[0],
          r.type,
          r.category,
          parseFloat(r.amount.toString()),
          `"${r.note.replace(/"/g, '""')}"`,
          r.source,
        ].join(",")
      );
      const csv = [header, ...lines].join("\n");
      return new NextResponse("\uFEFF" + csv, {
        headers: {
          "Content-Type":        "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="transactions-${monthFilter ?? "all"}.csv"`,
        },
      });
    }

    const [total, items] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.findMany({
        where,
        orderBy: { date: "desc" },
        skip,
        take: limit,
        select: { id: true, date: true, amount: true, category: true, type: true, note: true, source: true, mood: true },
      }),
    ]);

    return NextResponse.json({
      items: items.map(tx => ({
        id: tx.id,
        date: tx.date.toISOString().split("T")[0],
        amount: parseFloat(tx.amount.toString()),
        category: tx.category,
        type: tx.type,
        note: tx.note,
        source: tx.source,
        mood: tx.mood ?? null,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      date: string; type: string; amount: number; category: string; note?: string; source?: string;
    };
    const user = await prisma.user.findFirst({ where: { lineUserId: "dashboard_user" } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const tx = await prisma.transaction.create({
      data: {
        userId: user.id,
        date: new Date(body.date),
        type: body.type,
        amount: body.amount,
        category: body.category,
        note: body.note ?? "",
        source: body.source ?? "manual",
      },
    });
    return NextResponse.json({ id: tx.id });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
