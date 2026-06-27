# 新北市打擊噪音車管理系統 LINE 原生 V9

## 新增功能

### 1. Rich Menu 4×2 智慧選單
- 成果查詢：跳轉 `DASHBOARD_URL`
- 外勤回報：跳轉 `FIELD_REPORT_URL`
- 車號追蹤：LINE 內查詢
- KPI報表：LINE 內查詢
- 統計查詢：保留 V4 月份／行政區快速選單
- 法規中心：修法、法條、新聞來源
- 設備管理：比測、噪音計、風速計到期提醒
- 管理中心：後台、Excel、Rich Menu、推播

### 2. 法規中心
支援指令：
- `法規中心`
- `修法`
- `法條11`
- `法條13`
- `法條26`
- `法條28`
- `噪音車新聞`

### 3. 設備管理
支援指令：
- `設備管理`
- `設備清單`
- `設備 OE_ZB004`
- `設備提醒推播`

期限規則：
- 中央比測：2年
- 噪音計檢定：1年
- 風速計檢定：1年
- 30天內：黃燈
- 已逾期：紅燈

### 4. 後台新增
登入 `/admin.html` 後可使用：
- 一鍵建立／更新 LINE 圖文選單
- 匯入設備管理 Excel
- 立即推播設備到期提醒

## Zeabur 環境變數

```env
PUBLIC_BASE_URL=https://newtaipeinoise.zeabur.app
DASHBOARD_URL=https://noise115.zeabur.app
FIELD_REPORT_URL=https://out115.zeabur.app
ADMIN_PASSWORD=Wayne0118
SESSION_SECRET=請設定長隨機字串
LINE_CHANNEL_ACCESS_TOKEN=你的 LINE Token
LINE_CHANNEL_SECRET=你的 LINE Secret
LINE_PUSH_USER_IDS=可選，逗號分隔的 userId
```

## Webhook

```text
https://newtaipeinoise.zeabur.app/api/line/webhook
```

## 設備管理 Excel 欄位建議

工作表名稱建議：`設備管理`

| 設備 | 比測日期 | 噪音計檢定 | 風速計檢定 | 地點 | 備註 |
|---|---|---|---|---|---|
| OE_ZB001 | 2026/05/18 | 2026/04/10 | 2026/04/10 | 淡水區 | 正常 |

## 每日自動提醒
系統會在伺服器時間換算台北時間 08:00 左右，自動推播設備到期提醒給已與 BOT 互動過的 LINE 使用者；也可在後台按「立即推播設備到期提醒」。
