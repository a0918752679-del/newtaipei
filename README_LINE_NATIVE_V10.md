# 新北市打擊噪音車管理系統 LINE Native V10 Enterprise

## V10 企業版新增

### 1. 自動回覆調整
- 找不到指令時，只回覆：`感謝您的回覆🙂`
- 建議 LINE Official Account Manager 內將「自動回應訊息」改成同一句，或關閉自動回應，只保留 Webhook。

### 2. 法規中心
LINE 輸入或 Rich Menu 點選：
- `法規中心`：回傳 Carousel 法規卡片
- `修法`：回覆最新修法重點
- `法條11`、`法條13`、`法條26`、`法條28`：回覆常用條文摘要
- `噪音車新聞`：回覆環境部、噪音車專區、中央社等新聞入口

### 3. 設備管理
LINE 輸入或 Rich Menu 點選：
- `設備管理`：回傳設備儀表板
- `設備清單`：列出設備紅黃綠燈狀態
- `設備 OE_ZB001`：查單台設備比測、噪音計、風速計到期狀態
- `設備提醒推播`：立即推播設備提醒給已互動 LINE 使用者

### 4. 設備期限規則
| 項目 | 週期 | 判斷 |
|---|---:|---|
| 中央比測 | 2年 | 30天內黃燈，逾期紅燈 |
| 噪音計檢定 | 1年 | 30天內黃燈，逾期紅燈 |
| 風速計檢定 | 1年 | 30天內黃燈，逾期紅燈 |

### 5. 後台設備匯入
後台位置：

```text
https://newtaipeinoise.zeabur.app/admin.html
```

可匯入 Excel，建議工作表名稱：`設備管理`

欄位建議：

```text
設備、設備名稱、行政區/地點、比測日期、噪音計檢定、風速計檢定、保管人、備註
```

本封包已附樣板：

```text
templates/equipment-management-template.xlsx
```

## Zeabur 環境變數

```env
NODE_ENV=production
PORT=8080
DATA_DIR=/app/data
ADMIN_PASSWORD=Wayne0118
SESSION_SECRET=請設定一組長隨機字串
PUBLIC_BASE_URL=https://newtaipeinoise.zeabur.app
DASHBOARD_URL=https://noise115.zeabur.app
FIELD_REPORT_URL=https://out115.zeabur.app
LINE_CHANNEL_ACCESS_TOKEN=你的LINE長效Token
LINE_CHANNEL_SECRET=你的LINE Secret
LINE_PUSH_USER_IDS=選填，多個 userId 用逗號分隔
```

## 上線後必做

1. 將 V10 封包完整部署到 Zeabur。
2. 確認 Webhook URL：

```text
https://newtaipeinoise.zeabur.app/api/line/webhook
```

3. 進入後台，按「一鍵建立／更新 LINE 圖文選單」。
4. 到 LINE Official Account Manager：
   - Use webhook：開啟
   - 自動回應訊息：建議關閉；若要保留，內容改成「感謝您的回覆🙂」

