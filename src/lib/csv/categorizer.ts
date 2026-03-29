import Anthropic from "@anthropic-ai/sdk";
import { ParsedTransaction } from "./types";

// Reference categories — AI may use these or create more specific ones freely
const EXAMPLE_CATEGORIES = ["飲食", "交通", "娛樂", "購物", "醫療", "住房", "帳單", "貸款", "薪資", "獎金", "其他"];
const BATCH_SIZE = 60; // keep within haiku token budget

// Lazy getter — reads env var at call time, not module-load time
function getClient(): Anthropic {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

/**
 * Sends transactions in batches to Claude Haiku for category classification.
 * Falls back to "其他" on any error or missing API key.
 */
export async function batchCategorize(
  transactions: ParsedTransaction[],
): Promise<ParsedTransaction[]> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("[categorizer] ANTHROPIC_API_KEY 未設定，跳過 AI 分類");
    return transactions;
  }
  if (transactions.length === 0) return transactions;

  console.log(`[categorizer] 開始 AI 分類，共 ${transactions.length} 筆，每批 ${BATCH_SIZE} 筆`);
  const result = [...transactions];

  for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
    const batch = transactions.slice(i, i + BATCH_SIZE);
    console.log(`[categorizer] 處理第 ${i + 1}~${Math.min(i + BATCH_SIZE, transactions.length)} 筆...`);
    const categories = await categorizeBatch(batch);
    categories.forEach((cat, j) => {
      result[i + j] = { ...result[i + j], category: cat };
    });
  }

  const nonOther = result.filter(t => t.category !== "其他").length;
  console.log(`[categorizer] 完成，${nonOther}/${transactions.length} 筆識別為非「其他」`);
  return result;
}

async function categorizeBatch(transactions: ParsedTransaction[]): Promise<string[]> {
  const items = transactions.map((tx, idx) => ({
    i: idx,
    t: tx.type,   // 收入 | 支出
    n: tx.note,   // description / 摘要
  }));

  const prompt = `你是記帳分類助手。根據交易摘要（可能包含銀行存摺備註），為每筆交易選出最合適的分類。

分類可以自由命名，以下為常見參考分類：${EXAMPLE_CATEGORIES.join("、")}
若摘要更適合細分（如「保險費」「學費」「寵物」「美容」等），請直接使用更精確的名稱，不要強迫歸入上述清單。

分類規則（依優先順序）：
- 飲食：餐廳、早餐、午餐、晚餐、飲料、咖啡、超商消費、外送、食品、foodpanda、ubereats
- 交通：捷運、公車、計程車、Uber、加油、停車、悠遊卡（悠遊付儲值）、ETC、台鐵、高鐵、航空、電支轉含悠遊
- 娛樂：電影、遊戲、KTV、旅遊、訂閱（Netflix、Spotify等）、健身
- 購物：百貨、網購、服飾、3C、電商（蝦皮、momo、PChome）、超市（以生活用品為主）
- 醫療：醫院、診所、藥局、健保、保險費、助聽器、醫療器材
- 住房：房租、租金、水費、電費、瓦斯費、管理費、物業費、房貸
- 帳單：電信費、網路費、中華電信、台哥大、遠傳、第四台、水電費、公共費用
- 貸款：貸款、信貸、車貸、學貸、信用卡還款（繳交信用卡）、繳卡費、銀行貸款
- 薪資：薪資、薪水、工資、月薪、學校/公司/財團法人匯入（type=收入）
- 獎金：年終、績效獎金、紅包、禮金（type=收入）
- 其他：純帳號數字備註、FEE0手續費、ATM、無意義轉帳代號、空白摘要

兆豐銀行特殊規則（存摺備註欄位）：
- 備註含「悠遊付儲值」→ 交通
- 備註含學校/財團法人/公司名稱且 type=收入 → 薪資
- 備註含「FEE0」或純銀行代碼（如 807-xxxx）→ 其他
- 交易項目「薪資」→ 薪資
- 備註含「房租」「租金」→ 住房
- 備註含「電信費」「中華電信」→ 帳單
- 備註含「貸款」「信貸」「繳交信用卡」→ 貸款

交易清單：
${JSON.stringify(items)}

回傳 JSON 陣列（長度 ${transactions.length}），每個元素為對應索引的分類名稱字串。只回傳 JSON，不加任何說明。`;

  try {
    const response = await getClient().messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0];
    if (text.type !== "text") return fallback(transactions.length);

    const raw = text.text.trim();
    console.log("[categorizer] AI 原始回應（前 200 字）:", raw.slice(0, 200));
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/) ?? raw.match(/(\[[\s\S]*\])/);
    const parsed = JSON.parse(match ? match[1] : raw) as string[];

    if (!Array.isArray(parsed) || parsed.length !== transactions.length) {
      return fallback(transactions.length);
    }

    return parsed.map((cat) => (typeof cat === "string" && cat.trim() ? cat.trim() : "其他"));
  } catch (err) {
    console.error("[categorizer] batch error:", err);
    return fallback(transactions.length);
  }
}

function fallback(n: number): string[] {
  return Array(n).fill("其他");
}
