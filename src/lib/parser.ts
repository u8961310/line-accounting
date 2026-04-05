import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ParsedExpense {
  amount: number;
  category: string;
  type: "收入" | "支出";
  note: string;
  date?: string; // YYYY-MM-DD，未指定則為 null
}


export async function parseExpenseText(text: string, today?: string): Promise<ParsedExpense | null> {
  const todayStr = today ?? new Date().toISOString().split("T")[0];
  const systemPrompt = `你是一個記帳助手，專門從自然語言中解析記帳資訊。
今天日期是 ${todayStr}。
請從使用者的訊息中提取記帳資訊，並以 JSON 格式回應。

回應格式：
{
  "amount": 數字（正數），
  "category": "分類名稱",
  "type": "收入" 或 "支出",
  "note": "備註說明",
  "date": "YYYY-MM-DD 或 null"
}

常見分類參考：飲食、交通、娛樂、購物、醫療、住房、帳單、貸款、薪資、獎金、現金、其他
可自由使用更精確的分類名稱（如「保險費」「學費」「寵物」「美容」等）。

規則：
- amount 必須是正數
- 薪資、獎金、紅包等收入類型 → type: "收入"
- 其他消費支出 → type: "支出"
- 如果無法判斷是記帳訊息，回應 null
- note 保留原始描述（去除日期部分），category 選最合適的名稱
- 住房：房租、水電、瓦斯、管理費
- 帳單：電信費、網路費、訂閱服務費
- 貸款：貸款還款、信用卡繳費
- 提款、領錢 → category: "現金", type: "支出"
- date：若訊息含有日期（如「昨天」「3/28」「上週五」）則解析為 YYYY-MM-DD，否則為 null`;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: text,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== "text") return null;

    const rawText = content.text.trim();

    // Handle null response
    if (rawText === "null" || rawText.toLowerCase() === "null") return null;

    // Extract JSON from potential markdown code blocks
    const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) ?? rawText.match(/(\{[\s\S]*\})/);
    const jsonStr = jsonMatch ? jsonMatch[1] : rawText;

    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;

    if (parsed === null) return null;

    const amount = Number(parsed["amount"]);
    const category = String(parsed["category"] ?? "其他");
    const type = parsed["type"] === "收入" ? "收入" : "支出";
    const note = String(parsed["note"] ?? "");
    const dateVal = parsed["date"];
    const date = typeof dateVal === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateVal) ? dateVal : undefined;

    if (!isFinite(amount) || amount <= 0) return null;

    return {
      amount,
      category: category || "其他",
      type,
      note,
      date,
    };
  } catch (error) {
    console.error("parseExpenseText error:", error);
    return null;
  }
}
