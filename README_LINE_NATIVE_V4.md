# 新北市打擊噪音車管理系統｜LINE 原生操作版 V4

## V4 重點

- Rich Menu 第一格「成果查詢」直接開啟：`https://noise115.zeabur.app`
- Rich Menu 第二格「外勤回報」直接開啟：`https://out115.zeabur.app`
- 其餘功能維持 LINE 內操作：車號查詢、KPI 報表、行政區統計、管理功能。
- Webhook URL 維持：`https://newtaipeinoise.zeabur.app/api/line/webhook`

## Zeabur 環境變數

```env
NODE_ENV=production
PORT=8080
DATA_DIR=/app/data
ANNUAL_GOAL=490
ADMIN_PASSWORD=Wayne0118
SESSION_SECRET=請填入至少32字元的隨機字串
PUBLIC_BASE_URL=https://newtaipeinoise.zeabur.app
DASHBOARD_URL=https://noise115.zeabur.app
FIELD_REPORT_URL=https://out115.zeabur.app
LINE_CHANNEL_SECRET=你的_LINE_Channel_Secret
LINE_CHANNEL_ACCESS_TOKEN=你的_LINE_Channel_Access_Token
```

## LINE Developers Webhook

Webhook URL：

```text
https://newtaipeinoise.zeabur.app/api/line/webhook
```

設定：

- Use webhook：Enabled
- Webhook redelivery：Enabled
- LINE 官方帳號自動回覆：關閉

## 建立圖文選單

部署完成後，在 Zeabur Terminal 或本機執行：

```bash
export LINE_CHANNEL_ACCESS_TOKEN="你的 LINE Channel Access Token"
export PUBLIC_BASE_URL="https://newtaipeinoise.zeabur.app"
export DASHBOARD_URL="https://noise115.zeabur.app"
export FIELD_REPORT_URL="https://out115.zeabur.app"
npm run richmenu
```

## Rich Menu 動作

| 區塊 | 動作 |
|---|---|
| 成果查詢 | 直接開啟 `https://noise115.zeabur.app` |
| 外勤回報 | 直接開啟 `https://out115.zeabur.app` |
| 車號查詢 | LINE 內詢問車牌 |
| KPI報表 | LINE 內回覆 KPI 卡片 |
| 行政區統計 | LINE 內快速選擇行政區 |
| 管理功能 | LINE 內管理登入 |

## LINE 文字指令

- `選單`
- `成果查詢`
- `外勤回報`
- `LINE填報`
- `KPI報表`
- `行政區統計`
- `車號查詢`
- `2月份執行成效`
- `淡水區執行成效`
- `車牌 ABC-1234`

## 注意

若你曾經在截圖中露出 LINE Channel Secret 或 Access Token，請在 LINE Developers 重新發行後再更新 Zeabur 環境變數。
