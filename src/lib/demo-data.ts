// Demo mode mock data — used when URL contains ?demo=1
// All shapes must match the real API responses exactly.

export const DEMO_SUMMARY = {
  monthly: [
    { month: "2025-11", income: 68000, expense: 41200 },
    { month: "2025-12", income: 72000, expense: 38800 },
    { month: "2026-01", income: 68000, expense: 53400 },
    { month: "2026-02", income: 68000, expense: 35600 },
    { month: "2026-03", income: 75500, expense: 42100 },
    { month: "2026-04", income: 68000, expense: 28300 },
  ],
  byCategory: [
    { category: "薪資",   type: "收入" as const, total: 60000 },
    { category: "兼職",   type: "收入" as const, total: 8000  },
    { category: "飲食",   type: "支出" as const, total: 9800  },
    { category: "交通",   type: "支出" as const, total: 3200  },
    { category: "娛樂",   type: "支出" as const, total: 1800  },
    { category: "購物",   type: "支出" as const, total: 4200  },
    { category: "居住",   type: "支出" as const, total: 12000 },
    { category: "醫療",   type: "支出" as const, total: 800   },
    { category: "通訊",   type: "支出" as const, total: 1200  },
    { category: "訂閱",   type: "支出" as const, total: 680   },
    { category: "其他",   type: "支出" as const, total: 2100  },
  ],
  recent: [
    { id: "d1", date: "2026-04-03", amount: 320,   category: "飲食", type: "支出", note: "午餐便當",   source: "line" },
    { id: "d2", date: "2026-04-03", amount: 1200,  category: "購物", type: "支出", note: "藥妝店",     source: "esun_cc" },
    { id: "d3", date: "2026-04-02", amount: 68000, category: "薪資", type: "收入", note: "四月薪資",   source: "esun_bank" },
    { id: "d4", date: "2026-04-02", amount: 580,   category: "交通", type: "支出", note: "悠遊卡加值", source: "line" },
    { id: "d5", date: "2026-04-01", amount: 12000, category: "居住", type: "支出", note: "房租",       source: "ctbc_bank" },
    { id: "d6", date: "2026-04-01", amount: 250,   category: "飲食", type: "支出", note: "早餐",       source: "line" },
    { id: "d7", date: "2026-03-31", amount: 3600,  category: "娛樂", type: "支出", note: "演唱會票",   source: "esun_cc" },
    { id: "d8", date: "2026-03-30", amount: 8000,  category: "兼職", type: "收入", note: "設計稿費",   source: "esun_bank" },
  ],
  totals: { income: 68000, expense: 28300, net: 39700 },
};

export const DEMO_BALANCES = [
  { source: "esun_bank",  balance: 87430,  asOfDate: "2026-04-03", alias: "主要帳戶",   savingsGoal: null },
  { source: "ctbc_bank",  balance: 45200,  asOfDate: "2026-04-01", alias: "緊急備用金", savingsGoal: 171000 },
  { source: "kgi_bank",   balance: 12800,  asOfDate: "2026-03-28", alias: "旅遊基金",   savingsGoal: 50000 },
  { source: "esun_cc",    balance: -8640,  asOfDate: "2026-04-03", alias: null,          savingsGoal: null },
  { source: "ctbc_cc",    balance: -3200,  asOfDate: "2026-04-02", alias: null,          savingsGoal: null },
  { source: "cash",       balance: 3850,   asOfDate: "2026-04-03", alias: "現金錢包",   savingsGoal: null },
];

export const DEMO_HEALTH_SNAPSHOTS = [
  { month: "2025-11", score: 52, savingsScore: 75, debtScore: 25, budgetScore: 50, savingsRate: 22, debtRatio: 48, budgetAdherence: 67 },
  { month: "2025-12", score: 58, savingsScore: 75, debtScore: 25, budgetScore: 75, savingsRate: 24, debtRatio: 46, budgetAdherence: 80 },
  { month: "2026-01", score: 46, savingsScore: 50, debtScore: 25, budgetScore: 75, savingsRate: 15, debtRatio: 44, budgetAdherence: 83 },
  { month: "2026-02", score: 65, savingsScore: 75, debtScore: 50, budgetScore: 75, savingsRate: 26, debtRatio: 41, budgetAdherence: 100 },
  { month: "2026-03", score: 63, savingsScore: 75, debtScore: 50, budgetScore: 50, savingsRate: 24, debtRatio: 40, budgetAdherence: 67 },
  { month: "2026-04", score: 72, savingsScore: 100, debtScore: 50, budgetScore: 50, savingsRate: 35, debtRatio: 39, budgetAdherence: 75 },
];

export const DEMO_NET_WORTH = {
  totalAssets:      149280,
  totalLoanDebt:    46239,
  totalCreditDebt:  11840,
  totalDebt:        58079,
  netWorth:         91201,
  monthlyInterest:  618,
  totalInterestPaid: 4230,
};

export const DEMO_BUDGETS = {
  budgets: [
    { category: "飲食", amount: 10000, spent: 9800  },
    { category: "交通", amount: 4000,  spent: 3200  },
    { category: "娛樂", amount: 2000,  spent: 1800  },
    { category: "購物", amount: 5000,  spent: 4200  },
    { category: "居住", amount: 13000, spent: 12000 },
    { category: "醫療", amount: 3000,  spent: 800   },
    { category: "通訊", amount: 1500,  spent: 1200  },
    { category: "訂閱", amount: 1000,  spent: 680   },
  ],
};

export const DEMO_TX_PAGE = {
  items: DEMO_SUMMARY.recent,
  total: 8,
  page: 1,
  limit: 30,
  totalPages: 1,
};

export const DEMO_CATEGORIES = ["飲食", "交通", "娛樂", "購物", "醫療", "居住", "教育", "通訊", "保險", "水電", "美容", "運動", "旅遊", "訂閱", "寵物", "薪資", "獎金", "兼職", "現金", "轉帳", "其他"];

export const DEMO_FIXED_EXPENSES = {
  fixedExpenses: [
    { id: "fe1", name: "房租",        amount: 12000, category: "居住", dayOfMonth: 1  },
    { id: "fe2", name: "Netflix",     amount: 390,   category: "訂閱", dayOfMonth: 15 },
    { id: "fe3", name: "手機月費",    amount: 799,   category: "通訊", dayOfMonth: 20 },
    { id: "fe4", name: "健身房",      amount: 1200,  category: "運動", dayOfMonth: 5  },
    { id: "fe5", name: "網路費",      amount: 450,   category: "通訊", dayOfMonth: 10 },
  ],
};

export const DEMO_LOANS = [
  {
    id: "l1",
    name: "速還金",
    lender: "凱基銀行",
    type: "個人信貸",
    status: "active",
    originalPrincipal: "80000",
    remainingPrincipal: "46239",
    interestRate: "16",
    paymentDay: 15,
    endDate: null,
    note: "優先還清",
    payments: [
      { principalPaid: "5000", paymentDate: "2026-03-15" },
      { principalPaid: "5000", paymentDate: "2026-02-15" },
    ],
  },
];

export const DEMO_AUDIT_LOGS = {
  logs: [
    { id: "a1", createdAt: "2026-04-03T10:23:00Z", action: "mcp_call",   tool: "get_summary",    params: null, summary: { months: 6 },        status: "success", errorMsg: null },
    { id: "a2", createdAt: "2026-04-02T08:10:00Z", action: "csv_import", tool: "esun_bank",       params: null, summary: { imported: 12 },     status: "success", errorMsg: null },
    { id: "a3", createdAt: "2026-04-01T09:00:00Z", action: "mcp_call",   tool: "add_transaction", params: null, summary: { amount: 68000 },    status: "success", errorMsg: null },
    { id: "a4", createdAt: "2026-03-31T20:15:00Z", action: "csv_import", tool: "ctbc_cc",         params: null, summary: { imported: 7 },      status: "success", errorMsg: null },
  ],
  total: 4,
  pages: 1,
};

export const DEMO_NOTIFICATIONS = {
  notifications: [
    { id: "budget-danger-娛樂",   type: "budget" as const, severity: "danger" as const, title: "娛樂 已超出預算",          body: "本月已花 NT$ 3,600，超出預算 NT$ 1,600" },
    { id: "bill-urgent-cc1",      type: "bill"   as const, severity: "danger" as const, title: "玉山信用卡 帳單 2 天後到期", body: "NT$ 8,640 待繳，截止日 2026/4/5" },
    { id: "budget-warn-購物",     type: "budget" as const, severity: "warn"   as const, title: "購物 已用 84% 預算",         body: "NT$ 4,200 / 5,000，剩餘 NT$ 800" },
    { id: "bill-warn-cc2",        type: "bill"   as const, severity: "warn"   as const, title: "中信信用卡 帳單 12 天後到期", body: "NT$ 3,200 待繳，截止日 2026/4/15" },
    { id: "goal-deadline-g2",     type: "goal"   as const, severity: "info"   as const, title: "✈️ 日本旅遊 距截止剩 272 天",   body: "目前進度 26%，距目標還差 NT$ 37,200" },
    { id: "goal-near-g1",         type: "goal"   as const, severity: "info"   as const, title: "🛡️ 緊急備用金 快達標了！",       body: "已達 26%，再存 NT$ 125,800 即可完成" },
  ],
  dangerCount: 2,
  warnCount:   2,
};

export const DEMO_TRANSFER_CANDIDATES = { pairs: [] };

// 12 months of income history for income stability analysis
export const DEMO_INCOME_12 = [
  { month: "2025-05", income: 68000, expense: 46800 },
  { month: "2025-06", income: 68000, expense: 40200 },
  { month: "2025-07", income: 76000, expense: 44500 },
  { month: "2025-08", income: 68000, expense: 35200 },
  { month: "2025-09", income: 68000, expense: 40100 },
  { month: "2025-10", income: 68000, expense: 58300 },
  { month: "2025-11", income: 68000, expense: 41200 },
  { month: "2025-12", income: 72000, expense: 38800 },
  { month: "2026-01", income: 68000, expense: 53400 },
  { month: "2026-02", income: 68000, expense: 35600 },
  { month: "2026-03", income: 75500, expense: 42100 },
  { month: "2026-04", income: 68000, expense: 28300 },
];

// Per-source monthly flow (6 months)
export const DEMO_ACCOUNT_FLOW = {
  months: ["2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04"],
  accounts: [
    {
      source: "esun_bank", alias: "主要帳戶",
      monthly: [
        { month: "2025-11", income: 68000, expense: 5200 },
        { month: "2025-12", income: 72000, expense: 4800 },
        { month: "2026-01", income: 68000, expense: 5600 },
        { month: "2026-02", income: 68000, expense: 3800 },
        { month: "2026-03", income: 75500, expense: 5200 },
        { month: "2026-04", income: 68000, expense: 1800 },
      ],
      totalIncome: 419500, totalExpense: 26400,
    },
    {
      source: "esun_cc", alias: null,
      monthly: [
        { month: "2025-11", income: 0, expense: 14200 },
        { month: "2025-12", income: 0, expense: 11800 },
        { month: "2026-01", income: 0, expense: 19600 },
        { month: "2026-02", income: 0, expense: 10400 },
        { month: "2026-03", income: 0, expense: 15200 },
        { month: "2026-04", income: 0, expense: 7200 },
      ],
      totalIncome: 0, totalExpense: 78400,
    },
    {
      source: "line", alias: null,
      monthly: [
        { month: "2025-11", income: 0, expense: 8400 },
        { month: "2025-12", income: 0, expense: 9200 },
        { month: "2026-01", income: 0, expense: 10800 },
        { month: "2026-02", income: 0, expense: 7600 },
        { month: "2026-03", income: 0, expense: 8900 },
        { month: "2026-04", income: 0, expense: 2100 },
      ],
      totalIncome: 0, totalExpense: 47000,
    },
    {
      source: "ctbc_bank", alias: "緊急備用金",
      monthly: [
        { month: "2025-11", income: 0,    expense: 12000 },
        { month: "2025-12", income: 8000, expense: 12000 },
        { month: "2026-01", income: 0,    expense: 12000 },
        { month: "2026-02", income: 0,    expense: 12000 },
        { month: "2026-03", income: 0,    expense: 12000 },
        { month: "2026-04", income: 0,    expense: 12000 },
      ],
      totalIncome: 8000, totalExpense: 72000,
    },
  ],
};

export const DEMO_ANNUAL_REPORT = {
  year: 2025,
  availableYears: [2025, 2026],
  monthly: [
    { month: "2025-01", income: 68000, expense: 45200, net: 22800, savingsRate: 34 },
    { month: "2025-02", income: 68000, expense: 32100, net: 35900, savingsRate: 53 },
    { month: "2025-03", income: 75500, expense: 41300, net: 34200, savingsRate: 45 },
    { month: "2025-04", income: 68000, expense: 38600, net: 29400, savingsRate: 43 },
    { month: "2025-05", income: 68000, expense: 52400, net: 15600, savingsRate: 23 },
    { month: "2025-06", income: 68000, expense: 39800, net: 28200, savingsRate: 41 },
    { month: "2025-07", income: 76000, expense: 44500, net: 31500, savingsRate: 41 },
    { month: "2025-08", income: 68000, expense: 35200, net: 32800, savingsRate: 48 },
    { month: "2025-09", income: 68000, expense: 40100, net: 27900, savingsRate: 41 },
    { month: "2025-10", income: 68000, expense: 58300, net:  9700, savingsRate: 14 },
    { month: "2025-11", income: 68000, expense: 41200, net: 26800, savingsRate: 39 },
    { month: "2025-12", income: 72000, expense: 38800, net: 33200, savingsRate: 46 },
  ],
  byCategory: [
    { category: "薪資",   type: "收入" as const, total: 780000 },
    { category: "獎金",   type: "收入" as const, total:  23500 },
    { category: "兼職",   type: "收入" as const, total:  32000 },
    { category: "居住",   type: "支出" as const, total: 144000 },
    { category: "飲食",   type: "支出" as const, total: 108600 },
    { category: "購物",   type: "支出" as const, total:  58400 },
    { category: "交通",   type: "支出" as const, total:  38200 },
    { category: "娛樂",   type: "支出" as const, total:  32500 },
    { category: "通訊",   type: "支出" as const, total:  14880 },
    { category: "醫療",   type: "支出" as const, total:  12400 },
    { category: "訂閱",   type: "支出" as const, total:   8160 },
    { category: "運動",   type: "支出" as const, total:  14400 },
    { category: "其他",   type: "支出" as const, total:  24960 },
  ],
  totals: {
    income: 835500, expense: 507500, net: 328000, savingsRate: 39, txCount: 312,
  },
  highlights: {
    peakIncomeMonth:    "2025-07",
    peakExpenseMonth:   "2025-10",
    lowestExpenseMonth: "2025-02",
    bestSavingsMonth:   "2025-02",
  },
};

export const DEMO_GOALS = [
  { id: "g1", name: "緊急備用金", emoji: "🛡️", targetAmount: 171000, savedAmount: 45200, linkedSource: "ctbc_bank", deadline: null,         note: "三個月支出" },
  { id: "g2", name: "日本旅遊",   emoji: "✈️", targetAmount: 50000,  savedAmount: 12800, linkedSource: "kgi_bank",  deadline: "2026-12-31", note: "京都+大阪五天" },
  { id: "g3", name: "換新電腦",   emoji: "💻", targetAmount: 40000,  savedAmount: 8000,  linkedSource: null,        deadline: "2026-09-30", note: "MacBook" },
];

// For LoanManager component
export const DEMO_LOANS_RAW = [
  {
    id: "l1", name: "速還金", lender: "凱基銀行", type: "個人信貸",
    originalPrincipal: "80000", remainingPrincipal: "46239",
    interestRate: "16", paymentDay: 15, endDate: null, status: "active", note: "優先還清",
    payments: [
      { id: "p1", paymentDate: "2026-03-15", principalPaid: "5000", interestPaid: "618", totalPaid: "5618", remainingPrincipal: "46239", note: "" },
      { id: "p2", paymentDate: "2026-02-15", principalPaid: "5000", interestPaid: "685", totalPaid: "5685", remainingPrincipal: "51239", note: "" },
    ],
  },
];

export const DEMO_SUBSCRIPTIONS = {
  candidates: [
    { patternKey: "netflix||390",    detectedName: "Netflix",        label: "Netflix 串流",  remark: "家庭方案",       amount: 390,  category: "訂閱", source: "esun_cc",   monthCount: 6, lastDate: "2026-04-01", confirmed: true,  dismissed: false },
    { patternKey: "spotify||149",    detectedName: "Spotify",        label: "",              remark: "",               amount: 149,  category: "訂閱", source: "esun_cc",   monthCount: 6, lastDate: "2026-04-01", confirmed: true,  dismissed: false },
    { patternKey: "line pay||1200",  detectedName: "Line Pay",       label: "手機費",        remark: "中華電信月租",   amount: 1200, category: "通訊", source: "ctbc_bank", monthCount: 6, lastDate: "2026-04-05", confirmed: true,  dismissed: false },
    { patternKey: "icloud||90",      detectedName: "iCloud",         label: "",              remark: "",               amount: 90,   category: "訂閱", source: "esun_cc",   monthCount: 5, lastDate: "2026-03-28", confirmed: false, dismissed: false },
    { patternKey: "chatgpt||600",    detectedName: "ChatGPT",        label: "ChatGPT Plus",  remark: "",               amount: 600,  category: "訂閱", source: "ctbc_cc",   monthCount: 4, lastDate: "2026-04-02", confirmed: false, dismissed: false },
    { patternKey: "youtube||220",    detectedName: "YouTube",        label: "",              remark: "",               amount: 220,  category: "訂閱", source: "esun_cc",   monthCount: 3, lastDate: "2026-03-15", confirmed: false, dismissed: false },
    { patternKey: "gym||800",        detectedName: "gym",            label: "健身房",        remark: "世界健身 月費",  amount: 800,  category: "運動", source: "ctbc_bank", monthCount: 3, lastDate: "2026-04-01", confirmed: false, dismissed: false },
    { patternKey: "morning coffee||120", detectedName: "morning coffee", label: "",          remark: "",               amount: 120,  category: "飲食", source: "line",      monthCount: 2, lastDate: "2026-03-10", confirmed: false, dismissed: true  },
  ],
  monthlyTotal: 3449,
};

export const DEMO_DUPLICATE_CANDIDATES = {
  pairs: [
    {
      a: { id: "dup-a1", date: "2026-04-01", amount: 12000, type: "支出", source: "line",      category: "居住", note: "房租" },
      b: { id: "dup-b1", date: "2026-04-01", amount: 12000, type: "支出", source: "ctbc_bank", category: "居住", note: "4月房租" },
    },
    {
      a: { id: "dup-a2", date: "2026-03-28", amount: 580,   type: "支出", source: "line",      category: "交通", note: "悠遊卡加值" },
      b: { id: "dup-b2", date: "2026-03-28", amount: 580,   type: "支出", source: "esun_cc",   category: "交通", note: "" },
    },
  ],
};

export const DEMO_CREDIT_CARDS_RAW = [
  {
    id: "cc1", name: "玉山信用卡", bank: "玉山銀行",
    creditLimit: "150000", statementDay: 15, dueDay: 5,
    currentBalance: "8640",
    bills: [
      { id: "b1", billingMonth: "2026-03", totalAmount: "8640", minimumPayment: "864", dueDate: "2026-04-05", paidAmount: "0", paidDate: null, status: "unpaid" },
      { id: "b2", billingMonth: "2026-02", totalAmount: "6200", minimumPayment: "620", dueDate: "2026-03-05", paidAmount: "6200", paidDate: "2026-03-01", status: "paid" },
    ],
  },
  {
    id: "cc2", name: "中信信用卡", bank: "中國信託",
    creditLimit: "100000", statementDay: 25, dueDay: 15,
    currentBalance: "3200",
    bills: [
      { id: "b3", billingMonth: "2026-03", totalAmount: "3200", minimumPayment: "320", dueDate: "2026-04-15", paidAmount: "0", paidDate: null, status: "unpaid" },
    ],
  },
];
