# Notion 整合說明

## 欄位對應

| Notion 欄位 | 來源 |
|------------|------|
| 名稱 (title) | note 不空用 note，否則用 category_name |
| 金額 (number) | amount |
| 類型 (select) | 收入 / 支出 |
| 分類 (select) | category_name |
| 日期 (date) | date |
| 來源 (select) | source |

## 開發慣例
- Notion 同步一律不 `await`，錯誤只 `console.error` 不 `throw`
- 單向同步：只從系統寫入 Notion，不回寫
- 訂閱資料從 Notion Database 讀取（產品/訂閱開始日/付款方式/分類標籤/訂閱週期/訂閱費/每月金額/總計花費）
- 勾選「取消訂閱」的項目自動排除

## 環境變數
```
NOTION_TOKEN
NOTION_TRANSACTIONS_DB_ID
```
