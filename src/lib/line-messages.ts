/**
 * LINE Flex Message 模板
 * 深色科技主題，搭配 Quick Reply 按鈕
 */

// ── 色彩系統 ──────────────────────────────────────────────────────────────────
const BG   = "#0D1117";
const SURF = "#161B22";
const BORD = "#21262D";
const TEXT = "#E6EDF3";
const MUTE = "#8B949E";
const GRN  = "#3FB950";
const RED  = "#F85149";
const BLUE = "#58A6FF";

function fmt(n: number) {
  return n.toLocaleString("zh-TW");
}

// ── Quick Reply 按鈕（每則訊息底部） ─────────────────────────────────────────
const QUICK_REPLY = {
  items: [
    { type: "action", action: { type: "message", label: "📊 摘要", text: "摘要" } },
    { type: "action", action: { type: "message", label: "📋 最近", text: "最近" } },
    { type: "action", action: { type: "message", label: "❓ 說明", text: "說明" } },
  ],
};

// ── 記帳確認卡片 ──────────────────────────────────────────────────────────────
export function buildRecordedMessage(p: {
  type: "收入" | "支出";
  amount: number;
  category: string;
  note: string;
  date: Date;
}): Record<string, unknown> {
  const isIncome  = p.type === "收入";
  const typeColor = isIncome ? GRN : RED;
  const typeEmoji = isIncome ? "💰" : "💸";
  const dateStr   = p.date.toLocaleDateString("zh-TW", { month: "numeric", day: "numeric", weekday: "short" });

  return {
    type: "flex",
    altText: `${typeEmoji} 已記錄${p.type} NT$ ${fmt(p.amount)}`,
    contents: {
      type: "bubble",
      size: "kilo",
      body: {
        type: "box",
        layout: "vertical",
        backgroundColor: BG,
        paddingAll: "20px",
        contents: [
          // 類型標籤
          {
            type: "box",
            layout: "horizontal",
            contents: [{
              type: "box",
              layout: "vertical",
              backgroundColor: typeColor + "22",
              cornerRadius: "20px",
              paddingAll: "5px",
              paddingStart: "12px",
              paddingEnd: "12px",
              contents: [{
                type: "text",
                text: `${typeEmoji} ${p.type}`,
                color: typeColor,
                size: "xs",
                weight: "bold",
              }],
            }],
          },
          // 金額
          {
            type: "text",
            text: `NT$ ${fmt(p.amount)}`,
            size: "3xl",
            weight: "bold",
            color: TEXT,
            margin: "lg",
          },
          { type: "separator", margin: "lg", color: BORD },
          // 分類 + 備註
          {
            type: "box",
            layout: "horizontal",
            margin: "lg",
            spacing: "sm",
            alignItems: "center",
            contents: [
              {
                type: "box",
                layout: "vertical",
                backgroundColor: BLUE + "33",
                cornerRadius: "20px",
                paddingAll: "4px",
                paddingStart: "10px",
                paddingEnd: "10px",
                contents: [{
                  type: "text",
                  text: p.category,
                  color: BLUE,
                  size: "xs",
                  weight: "bold",
                }],
              },
              ...(p.note ? [{
                type: "text",
                text: p.note,
                color: MUTE,
                size: "sm",
                flex: 1,
                wrap: true,
              }] : []),
            ],
          },
          // 日期
          { type: "text", text: dateStr, color: MUTE, size: "xs", margin: "md" },
        ],
      },
    },
    quickReply: QUICK_REPLY,
  };
}

// ── 月摘要卡片 ────────────────────────────────────────────────────────────────
export function buildSummaryMessage(p: {
  month: string;
  income: number;
  expense: number;
  categories: { category: string; total: number }[];
}): Record<string, unknown> {
  const net      = p.income - p.expense;
  const netColor = net >= 0 ? GRN : RED;
  const maxAmt   = Math.max(...p.categories.map(c => c.total), 1);

  const catRows = p.categories.slice(0, 5).flatMap(c => {
    const pct = Math.max(1, Math.round((c.total / maxAmt) * 100));
    return [
      {
        type: "box",
        layout: "horizontal",
        marginTop: "10px",
        contents: [
          { type: "text", text: c.category, color: TEXT,  size: "sm", flex: 1 },
          { type: "text", text: `NT$ ${fmt(c.total)}`, color: MUTE, size: "sm", align: "end" },
        ],
      },
      {
        type: "box",
        layout: "horizontal",
        height: "4px",
        marginTop: "4px",
        contents: [
          { type: "box", layout: "vertical", flex: pct,       backgroundColor: BLUE, cornerRadius: "2px", contents: [] },
          { type: "box", layout: "vertical", flex: 100 - pct, backgroundColor: BORD, cornerRadius: "2px", contents: [] },
        ],
      },
    ];
  });

  return {
    type: "flex",
    altText: `📊 ${p.month} 收入 ${fmt(p.income)} 支出 ${fmt(p.expense)}`,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        backgroundColor: BG,
        paddingAll: "20px",
        contents: [
          // 標題
          {
            type: "box", layout: "horizontal", alignItems: "center",
            contents: [
              { type: "text", text: "📊", size: "xl" },
              { type: "text", text: ` ${p.month} 收支摘要`, color: TEXT, size: "md", weight: "bold", margin: "sm" },
            ],
          },
          { type: "separator", margin: "lg", color: BORD },
          // 收支數字
          {
            type: "box", layout: "vertical", margin: "lg", spacing: "md",
            contents: [
              {
                type: "box", layout: "horizontal",
                contents: [
                  { type: "text", text: "💰 收入", color: MUTE, size: "sm", flex: 1 },
                  { type: "text", text: `+NT$ ${fmt(p.income)}`, color: GRN, size: "sm", weight: "bold", align: "end" },
                ],
              },
              {
                type: "box", layout: "horizontal",
                contents: [
                  { type: "text", text: "💸 支出", color: MUTE, size: "sm", flex: 1 },
                  { type: "text", text: `-NT$ ${fmt(p.expense)}`, color: RED, size: "sm", weight: "bold", align: "end" },
                ],
              },
              { type: "separator", color: BORD },
              {
                type: "box", layout: "horizontal",
                contents: [
                  { type: "text", text: "📈 結餘", color: MUTE, size: "sm", flex: 1 },
                  { type: "text", text: `${net >= 0 ? "+" : ""}NT$ ${fmt(Math.abs(net))}`, color: netColor, size: "sm", weight: "bold", align: "end" },
                ],
              },
            ],
          },
          // 支出分類
          ...(catRows.length > 0 ? [
            { type: "separator", margin: "lg", color: BORD },
            { type: "text", text: "支出分類", color: MUTE, size: "xs", margin: "md" },
            ...catRows,
          ] : []),
        ],
      },
    },
    quickReply: QUICK_REPLY,
  };
}

// ── 最近 5 筆卡片 ─────────────────────────────────────────────────────────────
export function buildRecentMessage(txs: {
  date: string; type: string; amount: number; category: string; note: string;
}[]): Record<string, unknown> {
  const rows = txs.map((tx, i) => ({
    type: "box",
    layout: "horizontal",
    paddingTop: i === 0 ? "12px" : "10px",
    paddingBottom: "10px",
    borderWidth: i > 0 ? "1px" : "0px",
    borderColor: BORD,
    contents: [
      {
        type: "box", layout: "vertical", flex: 1, spacing: "xs",
        contents: [
          {
            type: "box", layout: "horizontal", spacing: "sm", alignItems: "center",
            contents: [
              {
                type: "box", layout: "vertical",
                backgroundColor: tx.type === "收入" ? GRN + "22" : RED + "22",
                cornerRadius: "10px",
                paddingAll: "3px", paddingStart: "7px", paddingEnd: "7px",
                contents: [{
                  type: "text",
                  text: tx.category,
                  color: tx.type === "收入" ? GRN : RED,
                  size: "xxs", weight: "bold",
                }],
              },
              {
                type: "text",
                text: tx.note || "—",
                color: MUTE, size: "xs", flex: 1,
              },
            ],
          },
          { type: "text", text: tx.date, color: BORD, size: "xxs" },
        ],
      },
      {
        type: "text",
        text: `${tx.type === "收入" ? "+" : "−"}${fmt(tx.amount)}`,
        color: tx.type === "收入" ? GRN : RED,
        size: "sm", weight: "bold", align: "end",
      },
    ],
  }));

  return {
    type: "flex",
    altText: "📋 最近 5 筆交易",
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        backgroundColor: BG,
        paddingAll: "20px",
        contents: [
          { type: "text", text: "📋 最近 5 筆", color: TEXT, size: "md", weight: "bold" },
          { type: "separator", margin: "lg", color: BORD },
          ...rows,
        ],
      },
    },
    quickReply: QUICK_REPLY,
  };
}

// ── 使用說明卡片 ──────────────────────────────────────────────────────────────
export function buildHelpMessage(): Record<string, unknown> {
  const example = (text: string) => ({
    type: "box",
    layout: "horizontal",
    paddingStart: "10px",
    contents: [
      { type: "text", text: "›", color: BLUE, size: "sm", flex: 0 },
      { type: "text", text: `  ${text}`, color: TEXT, size: "sm", wrap: true },
    ],
  });

  const cmd = (label: string, desc: string) => ({
    type: "box", layout: "horizontal",
    contents: [
      { type: "text", text: label, color: BLUE,  size: "sm", weight: "bold", flex: 2 },
      { type: "text", text: desc,  color: MUTE, size: "sm", flex: 3 },
    ],
  });

  return {
    type: "flex",
    altText: "📖 使用說明",
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        backgroundColor: BG,
        paddingAll: "20px",
        contents: [
          { type: "text", text: "📖 使用說明", color: TEXT, size: "lg", weight: "bold" },
          { type: "separator", margin: "lg", color: BORD },

          { type: "text", text: "✏️ 記帳範例", color: BLUE, size: "sm", weight: "bold", margin: "lg" },
          {
            type: "box", layout: "vertical", margin: "sm", spacing: "sm",
            contents: [
              example("早餐 80"),
              example("計程車 250"),
              example("昨天晚餐 300"),
              example("薪水入帳 50000"),
              example("提款 3000"),
            ],
          },
          { type: "separator", margin: "lg", color: BORD },

          { type: "text", text: "🔍 查詢指令", color: BLUE, size: "sm", weight: "bold", margin: "lg" },
          {
            type: "box", layout: "vertical", margin: "sm", spacing: "md",
            contents: [
              cmd("摘要", "本月收支統計"),
              cmd("最近", "最近 5 筆記錄"),
              cmd("說明", "顯示此說明"),
            ],
          },
        ],
      },
    },
    quickReply: QUICK_REPLY,
  };
}

// ── 錯誤訊息 ──────────────────────────────────────────────────────────────────
export function buildErrorMessage(): Record<string, unknown> {
  return {
    type: "flex",
    altText: "⚠️ 無法解析，請重新輸入",
    contents: {
      type: "bubble",
      size: "kilo",
      body: {
        type: "box",
        layout: "vertical",
        backgroundColor: BG,
        paddingAll: "20px",
        contents: [
          { type: "text", text: "⚠️ 無法解析", color: RED, size: "md", weight: "bold" },
          { type: "text", text: "請試著輸入：", color: MUTE, size: "sm", margin: "md" },
          {
            type: "box", layout: "vertical", margin: "sm", spacing: "sm",
            backgroundColor: SURF, cornerRadius: "8px", paddingAll: "12px",
            contents: [
              { type: "text", text: "早餐 80", color: TEXT, size: "sm" },
              { type: "text", text: "計程車 250", color: TEXT, size: "sm" },
              { type: "text", text: "薪水入帳 50000", color: TEXT, size: "sm" },
            ],
          },
        ],
      },
    },
    quickReply: QUICK_REPLY,
  };
}
