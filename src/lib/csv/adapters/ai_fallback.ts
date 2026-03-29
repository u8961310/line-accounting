import Anthropic from "@anthropic-ai/sdk";
import { CsvAdapter, ParsedTransaction, BankSource } from "../types";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface AiParsedRow {
  date: string;
  amount: number;
  type: "收入" | "支出";
  note: string;
}

async function parseRowsWithAI(
  headers: string[],
  rows: Record<string, string>[]
): Promise<AiParsedRow[]> {
  const sampleRows = rows.slice(0, 10);
  const csvPreview = [
    headers.join(","),
    ...sampleRows.map((r) => headers.map((h) => r[h] ?? "").join(",")),
  ].join("\n");

  const prompt = `以下是一段 CSV 銀行對帳單資料，請幫我解析每一筆交易。

CSV 資料：
${csvPreview}

請將所有 ${rows.length} 筆資料解析成 JSON 陣列，每個物件包含：
- date: 日期字串 (ISO 格式 YYYY-MM-DD)
- amount: 金額 (正數)
- type: "收入" 或 "支出"
- note: 交易說明

直接回傳 JSON 陣列，不要有其他說明。`;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== "text") return [];

    const rawText = content.text.trim();
    const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) ?? rawText.match(/(\[[\s\S]*\])/);
    const jsonStr = jsonMatch ? jsonMatch[1] : rawText;

    const parsed = JSON.parse(jsonStr) as AiParsedRow[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("AI fallback parse error:", error);
    return [];
  }
}

export function createAiFallbackAdapter(source: BankSource = "unknown"): CsvAdapter {
  return {
    source,

    parse(rows: Record<string, string>[]): ParsedTransaction[] {
      // This adapter needs to be called asynchronously
      // Return empty array synchronously; async parsing happens via parseAsync
      return rows.map((row) => {
        // Best-effort synchronous parse
        const values = Object.values(row);
        const dateCandidate = values.find((v) => /\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/.test(v)) ?? "";
        const amountCandidate = values.find((v) => /^[\d,]+\.?\d*$/.test(v.replace(/,/g, ""))) ?? "0";
        const note = values.filter((v) => v.trim() && !/^\d/.test(v)).join(" ").slice(0, 100);

        return {
          date: dateCandidate ? new Date(dateCandidate) : new Date(),
          amount: parseFloat(amountCandidate.replace(/,/g, "")) || 0,
          type: "支出" as const,
          category: "其他",
          note: note.trim(),
          source: source as BankSource,
        };
      }).filter((t) => t.amount > 0);
    },
  };
}

export async function parseWithAiFallback(
  headers: string[],
  rows: Record<string, string>[],
  source: BankSource = "unknown"
): Promise<ParsedTransaction[]> {
  const aiRows = await parseRowsWithAI(headers, rows);

  return aiRows
    .filter((r) => r.amount > 0 && r.date)
    .map((r) => ({
      date: new Date(r.date),
      amount: r.amount,
      type: r.type,
      category: "其他",
      note: r.note ?? "",
      source,
    }));
}
