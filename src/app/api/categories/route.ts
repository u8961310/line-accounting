import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const BUILTIN_EXPENSE = ["飲食","交通","娛樂","購物","醫療","居住","教育","通訊","保險","水電","美容","運動","旅遊","訂閱","寵物","現金","轉帳","其他"];
const BUILTIN_INCOME  = ["薪資","獎金","兼職","投資","租金","退款","現金","轉帳","其他"];

async function getUser() {
  return prisma.user.findFirst({ where: { lineUserId: "dashboard_user" } });
}

export async function GET() {
  try {
    const user = await getUser();
    const customs = user
      ? await prisma.userCategory.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } })
      : [];
  
    const customExpense = customs.filter(c => c.type === "expense" || c.type === "both").map(c => c.name);
    const customIncome  = customs.filter(c => c.type === "income"  || c.type === "both").map(c => c.name);
  
    return NextResponse.json({
      expense:       [...BUILTIN_EXPENSE, ...customExpense.filter(n => !BUILTIN_EXPENSE.includes(n))],
      income:        [...BUILTIN_INCOME,  ...customIncome.filter(n => !BUILTIN_INCOME.includes(n))],
      custom:        customs.map(c => ({ name: c.name, type: c.type })),
      builtinExpense: BUILTIN_EXPENSE,
      builtinIncome:  BUILTIN_INCOME,
    });
    } catch (e) {
    console.error("[categories]", e);
    return NextResponse.json({ error: "操作失敗" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  
    const body = await request.json() as { name: string; type?: string };
    if (!body.name?.trim()) return NextResponse.json({ error: "名稱不可空白" }, { status: 400 });
  
    const name = body.name.trim();
    const all  = [...BUILTIN_EXPENSE, ...BUILTIN_INCOME];
    if (all.includes(name)) return NextResponse.json({ error: "與內建分類重複" }, { status: 409 });
  
    const cat = await prisma.userCategory.upsert({
      where:  { userId_name: { userId: user.id, name } },
      update: { type: body.type ?? "both" },
      create: { userId: user.id, name, type: body.type ?? "both" },
    });
    return NextResponse.json({ name: cat.name, type: cat.type });
    } catch (e) {
    console.error("[categories]", e);
    return NextResponse.json({ error: "操作失敗" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  
    const body = await request.json() as { oldName: string; newName?: string; type?: string };
    if (!body.oldName) return NextResponse.json({ error: "oldName required" }, { status: 400 });
  
    const existing = await prisma.userCategory.findUnique({
      where: { userId_name: { userId: user.id, name: body.oldName } },
    });
    if (!existing) return NextResponse.json({ error: "找不到分類" }, { status: 404 });
  
    const newName = body.newName?.trim() ?? existing.name;
    if (newName !== existing.name) {
      const allBuiltin = [...BUILTIN_EXPENSE, ...BUILTIN_INCOME];
      if (allBuiltin.includes(newName)) return NextResponse.json({ error: "與內建分類重複" }, { status: 409 });
    }
  
    await prisma.userCategory.update({
      where: { userId_name: { userId: user.id, name: body.oldName } },
      data:  { name: newName, ...(body.type ? { type: body.type } : {}) },
    });
    return NextResponse.json({ ok: true });
    } catch (e) {
    console.error("[categories]", e);
    return NextResponse.json({ error: "操作失敗" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  
    const name = new URL(request.url).searchParams.get("name");
    if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  
    await prisma.userCategory.deleteMany({ where: { userId: user.id, name } });
    return NextResponse.json({ ok: true });
    } catch (e) {
    console.error("[categories]", e);
    return NextResponse.json({ error: "操作失敗" }, { status: 500 });
  }
}
