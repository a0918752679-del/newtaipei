# 新北市打擊噪音車管理系統 LINE 原生操作版 V5

## V5 重點

本版新增後台一鍵建立 LINE Rich Menu，不需要在本機執行 npm 指令。

後台路徑：

```text
https://newtaipeinoise.zeabur.app/admin.html
```

登入密碼：

```text
Wayne0118
```

登入後點選：

```text
一鍵建立／更新 LINE 圖文選單
```

系統會自動：

1. 建立 Rich Menu。
2. 上傳 `public/assets/line-rich-menu.jpg`。
3. 設為官方帳號預設圖文選單。
4. 將成果查詢按鈕連到 `DASHBOARD_URL`。
5. 將外勤回報按鈕連到 `FIELD_REPORT_URL`。
6. 其餘功能以 LINE 訊息指令方式操作。

## Zeabur 環境變數

```env
NODE_ENV=production
PORT=8080
DATA_DIR=/app/data
ANNUAL_GOAL=490
ADMIN_PASSWORD=Wayne0118
SESSION_SECRET=請填一組至少32字元的隨機字串
PUBLIC_BASE_URL=https://newtaipeinoise.zeabur.app
DASHBOARD_URL=https://noise115.zeabur.app
FIELD_REPORT_URL=https://out115.zeabur.app
LINE_CHANNEL_SECRET=你的 LINE Channel Secret
LINE_CHANNEL_ACCESS_TOKEN=你的 LINE Long-lived Channel Access Token
```

## LINE Webhook

LINE Developers → Messaging API → Webhook URL：

```text
https://newtaipeinoise.zeabur.app/api/line/webhook
```

並開啟：

```text
Use webhook：Enabled
```

## Rich Menu 按鈕配置

第一排：

- 成果查詢：開啟 `https://noise115.zeabur.app`
- 外勤回報：開啟 `https://out115.zeabur.app`
- 車號查詢：送出「車號查詢」

第二排：

- KPI報表：送出「KPI報表」
- 行政區：送出「行政區統計」
- 管理功能：送出「管理功能」

## 測試指令

```text
成果查詢
外勤回報
KPI報表
車號查詢
行政區統計
2月份執行成效
淡水區執行成效
管理功能
```

## 注意

若截圖或對話中已曝光 LINE Token / Secret，建議到 LINE Developers 重新發行 Access Token 並更新 Zeabur 環境變數。
