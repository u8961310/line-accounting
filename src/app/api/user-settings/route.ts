import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const USER_ID = "dashboard_user";

async function getUser() {
  return prisma.user.findFirst({ where: { lineUserId: USER_ID } });
}

export async function GET(): Promise<NextResponse> {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const settings = await prisma.userSettings.findUnique({ where: { userId: user.id } });

    return NextResponse.json({
      expenseAlertThreshold: settings?.expenseAlertThreshold ?? 3000,
      incomeAlertThreshold:  settings?.incomeAlertThreshold  ?? 10000,
      balanceAlertThreshold: settings?.balanceAlertThreshold ?? 5000,
      hourlyRate:            settings?.hourlyRate            ?? null,
    });
  } catch (e) {
    console.error("[user-settings]", e);
    return NextResponse.json({ error: "操作失敗" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const body = await request.json() as {
      expenseAlertThreshold?: number;
      incomeAlertThreshold?:  number;
      balanceAlertThreshold?: number;
      hourlyRate?:            number | null;
    };

    const data: Record<string, number | null> = {};
    if (body.expenseAlertThreshold !== undefined) data.expenseAlertThreshold = body.expenseAlertThreshold;
    if (body.incomeAlertThreshold  !== undefined) data.incomeAlertThreshold  = body.incomeAlertThreshold;
    if (body.balanceAlertThreshold !== undefined) data.balanceAlertThreshold = body.balanceAlertThreshold;
    if (body.hourlyRate            !== undefined) data.hourlyRate            = body.hourlyRate;

    const settings = await prisma.userSettings.upsert({
      where:  { userId: user.id },
      update: data,
      create: { userId: user.id, ...data },
    });

    return NextResponse.json({
      expenseAlertThreshold: settings.expenseAlertThreshold,
      incomeAlertThreshold:  settings.incomeAlertThreshold,
      balanceAlertThreshold: settings.balanceAlertThreshold,
      hourlyRate:            settings.hourlyRate ?? null,
    });
  } catch (e) {
    console.error("[user-settings]", e);
    return NextResponse.json({ error: "操作失敗" }, { status: 500 });
  }
}
