import Anthropic from "@anthropic-ai/sdk";

export interface ParsedTransaction {
  type: "支出" | "收入";
  amount: number;
  category: string;
  note: string;
  mealType?: "breakfast" | "lunch" | "dinner";
  confidence: number; // 0-1，低於 0.6 建議使用者確認
}

const EXPENSE_CATEGORIES = [
  "飲食", "交通", "娛樂", "購物", "醫療", "居住",
  "教育", "通訊", "保險", "水電", "美容", "運動",
  "旅遊", "訂閱", "寵物", "其他",
];

const INCOME_CATEGORIES = ["薪資", "獎金", "兼職"];

function getClient(): Anthropic {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

/**
 * 解析自然語言記帳輸入
 *
 * @example
 *   parseTransaction("晚餐 180 拉麵")
 *   → { type: "支出", amount: 180, category: "飲食", note: "拉麵", mealType: "dinner", confidence: 0.95 }
 */
export async function parseTransaction(text: string): Promise<ParsedTransaction | null> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("[claude-parse] ANTHROPIC_API_KEY 未設定");
    return null;
  }
  if (!text || text.trim().length === 0) return null;

  const prompt = `你是記帳解析助手。解析以下輸入並輸出 JSON。

輸入：「${text.trim()}」

規則：
1. type：「支出」或「收入」
2. amount：數字（去掉「元」「塊」「$」等符號）
3. category：從以下選擇
   支出：${EXPENSE_CATEGORIES.join("、")}
   收入：${INCOME_CATEGORIES.join("、")}
4. note：簡短描述，不含金額和分類（例如「午餐便當」「加油」「薪水」）
5. mealType：只在飲食類記帳時輸出，值為 "breakfast"/"lunch"/"dinner"
   - 含「早餐」「早上吃」「breakfast」→ breakfast
   - 含「午餐」「中餐」「中午吃」「lunch」→ lunch
   - 含「晚餐」「晚上吃」「dinner」「宵夜」→ dinner
   - 無法判斷或非飲食類 → 不輸出此欄位
6. confidence：0-1 之間，對解析結果的信心度
   - 金額和分類都明確 → 0.9+
   - 有歧義或需要猜 → 0.6-0.8
   - 完全猜不出 → 0.3 以下

輸出範例：
{"type":"支出","amount":180,"category":"飲食","note":"拉麵","mealType":"dinner","confidence":0.95}
{"type":"支出","amount":80,"category":"飲食","note":"早餐","mealType":"breakfast","confidence":0.95}
{"type":"支出","amount":6000,"category":"交通","note":"交通費","confidence":0.9}
{"type":"支出","amount":1200,"category":"水電","note":"水電費","confidence":0.9}
{"type":"收入","amount":50000,"category":"薪資","note":"薪水","confidence":0.95}

只輸出 JSON，不要其他文字或 markdown 標記。`;

  try {
    const client = getClient();
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });
    const output = message.content[0].type === "text" ? message.content[0].text : "";
    const raw = output.replace(/^```[a-z]*\n?/i, "").replace(/```$/m, "").trim();
    const parsed = JSON.parse(raw) as ParsedTransaction;

    if (!parsed.type || !parsed.amount || !parsed.category) {
      console.warn("[claude-parse] 欄位不完整：", parsed);
      return null;
    }
    return parsed;
  } catch (e) {
    console.error("[claude-parse] 解析失敗：", e);
    return null;
  }
}
