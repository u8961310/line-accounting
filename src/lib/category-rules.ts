import { prisma } from "./db";

/**
 * 比對使用者的 CategoryRule，命中則回傳對應 category，否則 null。
 * 同時非同步更新 hitCount + lastUsedAt。
 */
export async function matchCategoryRule(
  userId: string,
  note: string,
  source?: string,
): Promise<string | null> {
  const rules = await prisma.categoryRule.findMany({ where: { userId } });
  if (rules.length === 0) return null;

  const noteLower = note.toLowerCase();
  const matched = rules.find(r => {
    if (r.source && r.source !== source) return false;
    return noteLower.includes(r.keyword.toLowerCase());
  });

  if (matched) {
    void prisma.categoryRule.update({
      where: { id: matched.id },
      data: { hitCount: { increment: 1 }, lastUsedAt: new Date() },
    }).catch(console.error);
    return matched.category;
  }
  return null;
}

/**
 * 從 note 提取適合作為 keyword 的字串：
 * - 長度 ≤ 30 chars → 整段 note
 * - 較長 → 取前 30 chars 到最後一個空格或符號為止
 */
export function extractKeyword(note: string): string {
  const trimmed = note.trim();
  if (trimmed.length <= 30) return trimmed;
  const cut = trimmed.slice(0, 30);
  const lastBreak = Math.max(cut.lastIndexOf(" "), cut.lastIndexOf("-"), cut.lastIndexOf("_"));
  return lastBreak > 5 ? cut.slice(0, lastBreak).trim() : cut.trim();
}
