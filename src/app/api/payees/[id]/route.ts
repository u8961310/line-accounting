import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// PATCH /api/payees/[id] — { pattern?, label?, category? }
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json() as { pattern?: string; label?: string; category?: string };
  const data: Record<string, string> = {};
  if (body.pattern  !== undefined) data.pattern  = body.pattern.trim();
  if (body.label    !== undefined) data.label    = body.label.trim();
  if (body.category !== undefined) data.category = body.category.trim();

  const payee = await prisma.payeeMapping.update({ where: { id: params.id }, data });
  return NextResponse.json({ id: payee.id, pattern: payee.pattern, label: payee.label, category: payee.category });
}

// DELETE /api/payees/[id]
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.payeeMapping.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
