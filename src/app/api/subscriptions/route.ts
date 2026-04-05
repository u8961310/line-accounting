import { NextResponse } from "next/server";
import { getSubscriptionsFromNotion } from "@/lib/notion";
import type { SubItem } from "@/lib/notion";

export const dynamic = "force-dynamic";

export type { SubItem };

export interface SubscriptionsResponse {
  items:        SubItem[];
  monthlyTotal: number;
  yearlyTotal:  number;
}

export async function GET(): Promise<NextResponse> {
  try {
    const items = await getSubscriptionsFromNotion();
    const monthlyTotal = items.reduce((sum, i) => sum + i.monthlyAmount, 0);
    return NextResponse.json({
      items,
      monthlyTotal: Math.round(monthlyTotal),
      yearlyTotal:  Math.round(monthlyTotal * 12),
    } satisfies SubscriptionsResponse);
  } catch (e) {
    console.error("[subscriptions] Notion fetch error:", e);
    return NextResponse.json({ items: [], monthlyTotal: 0, yearlyTotal: 0 });
  }
}
