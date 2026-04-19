/**
 * 自然語言 → 結構化任務（Claude Haiku）
 *
 * 抽自 kogao/src/lib/claude.ts parseIntent 的 task_create 部分，精簡為純任務解析。
 * APP / kogao-os 的「快速輸入」按鈕呼叫 /api/tasks/parse 走這支。
 *
 * 一律以台灣時間為基準（避免 UTC 容器在 00:00~07:59 算成昨天）。
 */
import Anthropic from "@anthropic-ai/sdk";
import { taipeiToday, taipeiTodayAsUTC } from "./time";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface ParsedTask {
  title: string;
  dueDate?: string;   // YYYY-MM-DD（一次性）
  dueTime?: string;   // HH:MM 台灣時間
  priority?: "high" | "mid" | "low";
  category?: "工作" | "生活" | "財務" | "其他";
  recurringDays?: number[];   // 0=日 1=一 ... 6=六
  recurringTime?: string;     // HH:MM（週期性）
}

export async function parseTaskText(text: string): Promise<ParsedTask | null> {
  const todayUTC = taipeiTodayAsUTC();
  const todayStr = taipeiToday();
  const tomorrow = new Date(todayUTC);
  tomorrow.setUTCDate(todayUTC.getUTCDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  const weekdays: string[] = [];
  for (let i = 1; i <= 7; i++) {
    const d = new Date(todayUTC);
    d.setUTCDate(todayUTC.getUTCDate() + i);
    weekdays.push(d.toISOString().split("T")[0]);
  }
  const [nextMon, nextTue, nextWed, nextThu, nextFri, nextSat, nextSun] = weekdays;
  const dayOfWeek = ["日", "一", "二", "三", "四", "五", "六"][todayUTC.getUTCDay()];

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{
        role: "user",
        content: `解析以下訊息為任務 JSON。今天是 ${todayStr}（週${dayOfWeek}）。

訊息：「${text}」

輸出欄位：
- title: 清理後的任務標題（去除「提醒我」「記得」「我要」等語助詞，保留動作與對象）
- dueDate: YYYY-MM-DD（一次性提醒，無指定日期則省略）
- dueTime: HH:MM 台灣時間（無指定時間則省略）
- priority: "high" | "mid" | "low"（有「緊急」「重要」→ high；一般 → mid；「有空」「不急」→ low）
- category: "工作" | "生活" | "財務" | "其他"
- recurringDays: 陣列 [0-6]（週期性才有，一次性請省略）
- recurringTime: HH:MM（週期性才有）

日期參考：
- 明天=${tomorrowStr}，後天=${weekdays[1]}
- 下週一=${nextMon}，下週二=${nextTue}，下週三=${nextWed}，下週四=${nextThu}，下週五=${nextFri}，下週六=${nextSat}，下週日=${nextSun}

時間解析（台灣時間）：
- 「早上9點」→ "09:00"，「下午3點」→ "15:00"，「晚上8點半」→ "20:30"，「晚上9點」→ "21:00"
- 「三點」在提醒場景預設為下午 → "15:00"
- 只有時間沒日期（如「19:41 提醒我去裝水」），dueDate 設為今天 ${todayStr}
- 無時間無日期（如「買牛奶」）→ dueDate/dueTime 都省略

週期性規則：
- 「每天」→ recurringDays [0,1,2,3,4,5,6]
- 「週一到五」「平日」→ [1,2,3,4,5]
- 「每週一三五」→ [1,3,5]
- 週期性必有 recurringTime，不要輸出 dueDate

無法解析（空訊息或完全看不懂）→ 輸出 {"title":""}

範例：
{"title":"繳電費","dueDate":"${tomorrowStr}","priority":"mid","category":"財務"}
{"title":"吃中藥","dueDate":"${todayStr}","dueTime":"21:00","priority":"high","category":"生活"}
{"title":"開會","dueDate":"${nextWed}","dueTime":"10:00","priority":"high","category":"工作"}
{"title":"去裝水","dueDate":"${todayStr}","dueTime":"19:41","priority":"mid","category":"生活"}
{"title":"買牛奶","priority":"mid","category":"生活"}
{"title":"吃藥","recurringDays":[0,1,2,3,4,5,6],"recurringTime":"08:00","priority":"high","category":"生活"}
{"title":"下班","recurringDays":[1,2,3,4,5],"recurringTime":"17:28","priority":"mid","category":"工作"}

只輸出 JSON，不要其他文字。`,
      }],
    });

    const output = message.content[0].type === "text" ? message.content[0].text : "{}";
    const raw = output.replace(/^```[a-z]*\n?/i, "").replace(/```$/m, "").trim();
    const parsed = JSON.parse(raw) as ParsedTask;

    if (!parsed.title || !parsed.title.trim()) return null;

    return {
      title: parsed.title.trim(),
      dueDate: parsed.dueDate,
      dueTime: parsed.dueTime,
      priority: parsed.priority,
      category: parsed.category,
      recurringDays: parsed.recurringDays,
      recurringTime: parsed.recurringTime,
    };
  } catch (e) {
    console.error("[claude-task-parse] error:", e);
    return null;
  }
}
