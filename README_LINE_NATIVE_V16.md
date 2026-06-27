# 新北市打擊噪音車管理系統 V16 Ultimate

## 版本重點

- 全新重構，移除舊版 V3~V15 累積殘留。
- 可直接部署到 Zeabur。
- 修正 express / node_modules / .npmrc / Dockerfile 建置問題。
- LINE 原生操作：Rich Menu、Flex Message、Carousel、Quick Reply。
- 成果查詢：月份、行政區、KPI、車牌查詢。
- 法規中心：修法、常用法條、新聞摘要。
- 設備管理：比測 2 年、噪音計 1 年、風速計 1 年，到期亮燈。
- 後台：一鍵建立 Rich Menu、匯入成果 Excel、Debug 檢查。

## Zeabur 環境變數

```env
NODE_ENV=production
PORT=8080
PUBLIC_BASE_URL=https://newtaipeinoise.zeabur.app
DASHBOARD_URL=https://noise115.zeabur.app
FIELD_REPORT_URL=https://out115.zeabur.app
ADMIN_PASSWORD=Wayne0118
LINE_CHANNEL_ACCESS_TOKEN=你的 LINE Long-lived Channel Access Token
LINE_CHANNEL_SECRET=你的 LINE Channel Secret
DATA_DIR=/app/data
```

## Webhook

LINE Developers → Messaging API → Webhook URL：

```text
https://newtaipeinoise.zeabur.app/api/line/webhook
```

## 部署後檢查

```text
https://newtaipeinoise.zeabur.app/healthz
https://newtaipeinoise.zeabur.app/api/line/test
https://newtaipeinoise.zeabur.app/api/line/debug/latest
```

## 後台

```text
https://newtaipeinoise.zeabur.app/admin.html
```

登入後按：一鍵建立／更新 LINE 圖文選單。
