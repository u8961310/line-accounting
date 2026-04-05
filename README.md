# LINE 記帳系統

個人財務管理系統，透過 LINE Bot 快速記帳，並提供完整的 Dashboard 進行收支分析、預算管理、負債追蹤與財務規劃。

## 功能總覽

### LINE Bot
- 自然語言記帳（「早餐 80」「薪水 50000 收入」）
- 查詢本月摘要、帳戶餘額、最近記錄、預算狀況
- 自然語言查詢（「上週吃飯花多少」「這個月交通費」）
- AI 自動分類（Claude Haiku）
- Flex Message 美化回覆

### Dashboard
- 收支統計、月份趨勢圖、分類分析
- 帳戶餘額管理（含現金自動推算）
- 預算設定與使用率追蹤
- 通知中心（預算超標、帳單到期、目標進度）
- 信用卡帳單管理
- 貸款管理（雪球法 / 雪崩法還債優化）
- 財務目標追蹤
- 固定支出管理
- 訂閱費用偵測
- 帳單日曆
- 年度財報 / 月報列印
- 進階分析（退休試算、FIRE 進度、帳戶流量）
- 財務健康評分
- AI 月度洞察報告

### 資料匯入
- CSV / XLS 銀行對帳單（13 家銀行 / 信用卡）
- PDF 匯入（凱基銀行 / 永豐信用卡）
- JSON 備份還原

## 技術棧

| 類別 | 技術 |
|------|------|
| 框架 | Next.js 14 App Router + TypeScript |
| 資料庫 | PostgreSQL + Prisma ORM |
| AI | Claude API（Haiku 解析、記帳意圖分類） |
| LINE | LINE Messaging API (@line/bot-sdk) |
| 筆記同步 | Notion API（單向同步） |
| UI | Tailwind CSS + Recharts |
| CSV 解析 | papaparse + chardet + iconv-lite |
| 部署 | Zeabur |

## 支援銀行

| 代碼 | 銀行 |
|------|------|
| `tbank` | 台灣銀行 |
| `cathay_bank` | 國泰世華（存款） |
| `esun_bank` | 玉山銀行（存款） |
| `ctbc_bank` | 中國信託（存款） |
| `kgi_bank` | 凱基銀行（存款） |
| `mega_bank` | 兆豐銀行（存款） |
| `sinopac_bank` | 永豐銀行（存款） |
| `yuanta_bank` | 元大銀行（存款） |
| `cathay_cc` | 國泰世華信用卡 |
| `esun_cc` | 玉山信用卡 |
| `ctbc_cc` | 中信信用卡 |
| `taishin_cc` | 台新信用卡 |
| `sinopac_cc` | 永豐信用卡（PDF） |

## 本機開發

### 需求
- Node.js 20+
- PostgreSQL

### 安裝

```bash
npm install
```

### 環境變數

複製 `.env.example` 為 `.env` 並填入：

```bash
cp .env.example .env
```

| 變數 | 說明 |
|------|------|
| `DATABASE_URL` | PostgreSQL 連線字串 |
| `LINE_CHANNEL_SECRET` | LINE Developers 後台取得 |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Developers 後台取得 |
| `ANTHROPIC_API_KEY` | Anthropic Console 取得 |
| `ADMIN_PASSWORD` | Dashboard 登入密碼 |
| `SESSION_SECRET` | 隨機 32 字元以上字串 |
| `INTERNAL_API_KEY` | 供外部 Bot 服務呼叫 API 用 |
| `NOTION_TOKEN` | 選填，Notion 同步 |
| `NOTION_TRANSACTIONS_DB_ID` | 選填，Notion 同步 |

### 資料庫初始化

```bash
npx prisma migrate dev
```

### 啟動

```bash
npm run dev
```

開啟 [http://localhost:3000](http://localhost:3000)

## 部署（Zeabur）

1. 推送至 GitHub
2. Zeabur Dashboard → 新增 Project → Deploy from GitHub
3. 同一 Project 加入 **PostgreSQL** 服務（`DATABASE_URL` 自動注入）
4. 填入所有環境變數
5. 部署完成後開啟 Console 執行：

```bash
npx prisma migrate deploy
```

## 常用指令

```bash
npm run dev                              # 本機開發
npm run build                            # 建置
npx prisma migrate dev --name <說明>    # 建立新 migration（需先關 dev server）
npx prisma migrate deploy               # 套用 migration（正式環境）
npx prisma studio                       # 資料庫視覺化管理
```

## LINE Webhook 設定

LINE Developers Console → 你的 Channel → Messaging API：

```
Webhook URL: https://你的網域/api/webhook
```

開啟 **Use webhook**，點 **Verify** 確認回應 200。

## 記帳分類

```
支出：飲食 / 交通 / 娛樂 / 購物 / 醫療 / 居住 / 教育 / 通訊 / 保險 / 水電 / 美容 / 運動 / 旅遊 / 訂閱 / 寵物 / 其他
收入：薪資 / 獎金 / 兼職
通用：現金 / 轉帳
```

## 資料流

**LINE 記帳**
```
LINE 輸入 → webhook 驗簽 → Claude AI 解析
→ 存入 transactions（source: "line"）→ Flex Message 回覆
→ 背景同步 Notion
```

**CSV 匯入**
```
上傳檔案 → 轉 UTF-8 → 偵測銀行格式 → 解析
→ 去重（同 userId + date + amount + source）→ 存入 transactions
→ 背景同步 Notion
```
