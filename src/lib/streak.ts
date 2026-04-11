import { prisma } from "@/lib/db";
import { taipeiToday, taipeiYesterday } from "@/lib/time";

const MILESTONES = [7, 30, 100, 365];

export interface StreakResult {
  currentStreak: number;
  longestStreak: number;
  lastRecordDate: string | null;
  isNewMilestone: boolean;
  milestone: number | null;
}

/**
 * 每次記帳成功後呼叫，自動更新連續天數。
 * - 今天已記過：不重複累加
 * - 昨天有記帳：+1
 * - 更早：重置為 1
 */
export async function updateStreak(userId: string): Promise<StreakResult> {
  const today     = taipeiToday();
  const yesterday = taipeiYesterday();

  const current = await prisma.userStreak.findUnique({ where: { userId } });

  let currentStreak = current?.currentStreak ?? 0;
  let longestStreak = current?.longestStreak ?? 0;
  const lastDate    = current?.lastRecordDate ?? null;

  // 今天已記帳 → 不變
  if (lastDate === today) {
    return { currentStreak, longestStreak, lastRecordDate: lastDate, isNewMilestone: false, milestone: null };
  }

  // 昨天有記帳 → 連續
  if (lastDate === yesterday) {
    currentStreak += 1;
  } else {
    // 中斷或首次
    currentStreak = 1;
  }

  if (currentStreak > longestStreak) longestStreak = currentStreak;

  await prisma.userStreak.upsert({
    where:  { userId },
    update: { currentStreak, longestStreak, lastRecordDate: today },
    create: { userId, currentStreak, longestStreak, lastRecordDate: today },
  });

  const isNewMilestone = MILESTONES.includes(currentStreak);
  return {
    currentStreak,
    longestStreak,
    lastRecordDate: today,
    isNewMilestone,
    milestone: isNewMilestone ? currentStreak : null,
  };
}
