# 新北市打擊噪音車管理系統｜LINE 原生操作版 V3

本版本主操作不再依賴互動式網頁，LINE 圖文選單採 `message` action，點選後會直接在聊天室觸發 BOT 指令。

## 已內建功能

- LINE Rich Menu 六宮格：成果查詢、開始回報、車號查詢、KPI報表、行政區統計、管理功能
- LINE Flex Message：主選單與 KPI 成果卡片
- Quick Reply：月份、行政區、查詢分類快速選項
- 外勤回報：LINE 對話式逐步填報
- 車號查詢：累犯、最高超標、告發、通檢、行政區紀錄
- 管理功能：密碼 `Wayne0118`，可導向後台與 Excel 匯出
- Webhook：`/api/line/webhook`
- 外部備援連結：成果系統 `https://noise115.zeabur.app`、外勤平台 `https://out115.zeabur.app`

## Zeabur 環境變數

請在 Zeabur Service → Variables 設定：

```env
NODE_ENV=production
PORT=8080
DATA_DIR=/app/data
ANNUAL_GOAL=490
ADMIN_PASSWORD=Wayne0118
SESSION_SECRET=請改成至少32字元以上的隨機字串
PUBLIC_BASE_URL=https://newtaipeinoise.zeabur.app
DASHBOARD_URL=https://noise115.zeabur.app
FIELD_REPORT_URL=https://out115.zeabur.app
LINE_CHANNEL_SECRET=你的LINE_CHANNEL_SECRET
LINE_CHANNEL_ACCESS_TOKEN=你的LINE_CHANNEL_ACCESS_TOKEN
```

修改後請 Redeploy。

## LINE Webhook 設定

LINE Developers → Messaging API：

```text
Webhook URL：https://newtaipeinoise.zeabur.app/api/line/webhook
Use webhook：Enabled
Webhook redelivery：Enabled
```

LINE Official Account Manager → 回應設定：

```text
Webhook：開啟
自動回應訊息：關閉
聊天：開啟
```

## 建立 LINE 圖文選單

部署後，在 Zeabur Terminal 或本機執行：

```bash
export LINE_CHANNEL_ACCESS_TOKEN="你的LINE_CHANNEL_ACCESS_TOKEN"
export PUBLIC_BASE_URL="https://newtaipeinoise.zeabur.app"
npm run richmenu
```

完成後，LINE 底部會出現「管理選單」。六個按鈕會直接送出指令，不會跳網頁。

## LINE 測試指令

```text
選單
成果查詢
進度
KPI報表
月份統計
2月份執行成效
淡水區執行成效
車號查詢
車牌 ABC-1234
開始回報
管理登入
開啟成果系統
開啟外勤回報
```

## 目前設計邏輯

- 第一線人員：以 LINE 對話與按鈕為主。
- 主管或管理者：需要完整地圖、Excel 匯入匯出、大量資料檢視時，再進入網頁後台。
- 成果查詢系統與外勤回報既有網址已保留為備援連結，但 Rich Menu 主操作均為 LINE 原生指令。
