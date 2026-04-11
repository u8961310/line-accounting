# Prisma Schema 重要模型

| 模型 | 說明 |
|------|------|
| `User` | `lineUserId = "dashboard_user"`（Dashboard 固定用戶） |
| `Transaction` | unique(userId, date, amount, source) |
| `BankBalance` | unique(userId, source)；每個 source 只存一筆，更新覆蓋 |
| `Budget` | unique(userId, category)；循環月設定 |
| `Loan + LoanPayment` | 貸款與還款記錄 |
| `CreditCard + CreditCardBill` | 信用卡與帳單 |
| `FixedExpense` | 固定支出（每月必要支出） |
| `FinancialGoal` | 財務目標；`linkedSource` 可連結帳戶自動同步已存金額 |
| `NetWorthSnapshot` | unique(userId, month)；每月淨資產歷史快照 |
| `PayeeMapping` | 帳號對照（pattern → label/category） |
| `AuditLog` | 操作記錄 |
| `SubscriptionMark` | 訂閱標記；`patternKey = "note\|\|amount"`，確認/排除/自訂名稱/備註 |
| `UserCategory` | unique(userId, name)；自訂分類（type: expense/income/both） |
| `HealthScoreSnapshot` | unique(userId, month)；財務健康評分歷史快照 |
| `SavingsChallenge` | unique(userId)；存錢挑戰（type/multiplier/fixedAmount/completedWeeks JSON/linkedGoalId）；linkedGoalId 只讀取目標 savedAmount 顯示，不寫入目標 |

## Migration 注意事項
- 跑 migration 前務必關閉 dev server（DLL lock 問題）
- 指令：`npx prisma migrate dev --name [說明]`
- Migration 後執行 `npx prisma generate` 重新產生 client
