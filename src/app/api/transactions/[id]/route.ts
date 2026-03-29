import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json() as { category?: string; type?: string };
    const data: { category?: string; type?: string } = {};
    if (body.category !== undefined) data.category = body.category;
    if (body.type     !== undefined) data.type     = body.type;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const tx = await prisma.transaction.update({
      where: { id: params.id },
      data,
      select: { id: true, category: true, type: true },
    });

    return NextResponse.json(tx);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
