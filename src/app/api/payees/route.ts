import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/payees
export async function GET() {
  const payees = await prisma.payeeMapping.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(payees.map(p => ({
    id:       p.id,
    pattern:  p.pattern,
    label:    p.label,
    category: p.category,
  })));
}

// POST /api/payees — { pattern, label, category? }
export async function POST(req: NextRequest) {
  const body = await req.json() as { pattern?: string; label?: string; category?: string };
  if (!body.pattern?.trim() || !body.label?.trim()) {
    return NextResponse.json({ error: "pattern 和 label 為必填" }, { status: 400 });
  }
  const payee = await prisma.payeeMapping.create({
    data: {
      pattern:  body.pattern.trim(),
      label:    body.label.trim(),
      category: body.category?.trim() ?? "",
    },
  });
  return NextResponse.json({ id: payee.id, pattern: payee.pattern, label: payee.label, category: payee.category });
}
