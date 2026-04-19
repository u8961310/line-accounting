# MCP 工具清單

> 真相源：`src/mcp/createMcpServer.ts`。新增工具時用 `/mcp-add` skill 會自動同步這份。

## 查詢類
| 工具 | 功能 |
|------|------|
| `get_summary` | 月收支摘要 |
| `get_transactions` | 交易列表（支援篩選） |
| `get_balances` | 銀行餘額 |
| `get_budgets` | 預算 vs 實際 |
| `get_net_worth` | 淨資產 |
| `get_loans` | 貸款明細 |
| `get_loan_summary` | 貸款總覽 |
| `get_income_breakdown` | 收入來源分析 |
| `get_weekly_report` | 週報 |
| `get_spending_trend` | 跨月分類比較 |
| `get_cashflow_forecast` | 月底結餘預測 |
| `get_today_spending` | 今天花了多少 |
| `get_category_trend` | 指定分類近 N 月趨勢 |
| `get_goals` | 目標 + 進度 + 預計達標日 |
| `get_budget_alert` | 超標/接近上限的預算分類 |
| `get_fixed_expenses` | 固定支出清單 |
| `get_credit_cards` | 信用卡 + 未繳帳單 |
| `get_health_score` | 財務健康評分 |
| `get_fire_progress` | FIRE 進度與預計達成年數 |
| `get_subscription_summary` | 訂閱清單 + 月費合計 |
| `get_subscriptions` | 完整訂閱明細（含 nextBillingDate） |
| `get_notifications` | 所有警示（預算/帳單/貸款/目標） |
| `get_annual_report` | 年度財報摘要 |
| `get_anomaly_detection` | z-score 異常支出偵測 |
| `get_grad_school_plan` | 研究所儲蓄規劃分析 |

## 寫入類
| 工具 | 功能 |
|------|------|
| `bulk_set_category` | 批量重新分類 |
| `set_income_source` | 設定收入來源類型 |
| `set_budget` | upsert 分類預算 |
| `add_transaction` | 新增記帳（source: "mcp"） |
| `update_transaction` | 修改分類/備註/金額/類型 |
| `delete_transaction` | 刪除交易（含 audit log） |
| `add_loan_payment` | 記錄還款 |
