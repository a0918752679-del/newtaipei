# 新北市打擊噪音車管理計畫｜LINE BOT 管理系統

本封包是一套可直接部署到 Zeabur 的 Node.js / Express 管理系統，包含：

- LINE BOT 跳轉入口頁：`/`
- 成果查詢系統：`/dashboard.html`
- 外勤人員回報平台：`/field-report.html`
- 噪音車個案車號追蹤：`/plate.html`
- 後端管理系統：`/admin.html`
- LINE BOT webhook：`/api/line/webhook`
- Rich Menu 圖文選單素材：`/public/assets/line-rich-menu.jpg`

---

## 1. 本機測試

```bash
npm install
cp .env.example .env
npm start
```

開啟：

```text
http://localhost:8080
```

後台：

```text
http://localhost:8080/admin.html
```

預設管理密碼：

```text
Wayne0118
```

---

## 2. Zeabur 部署方式

### 方法A：GitHub 部署，建議使用

1. 解壓縮本封包。
2. 建立 GitHub Repository。
3. 將整個資料夾內容上傳到 GitHub。
4. 到 Zeabur 建立 Project。
5. 新增 Service，選擇 GitHub Repository。
6. Zeabur 會偵測 `Dockerfile`，使用 Dockerfile 部署。
7. 服務 Port 設為 `8080`。
8. 部署完成後，取得 Zeabur 網址，例如：

```text
https://your-service.zeabur.app
```

### 必設環境變數

在 Zeabur Service 的 Environment Variables / Configuration 設定：

```env
NODE_ENV=production
PORT=8080
PUBLIC_BASE_URL=https://your-service.zeabur.app
DATA_DIR=/app/data
ANNUAL_GOAL=490
ADMIN_PASSWORD=Wayne0118
SESSION_SECRET=請改成一組很長的隨機字串
LINE_CHANNEL_ACCESS_TOKEN=你的 LINE Channel access token
LINE_CHANNEL_SECRET=你的 LINE Channel secret
```

### 持久化資料夾

請在 Zeabur Service 的 Volumes / 硬碟功能新增：

```text
Volume ID: noise-data
Mount Directory: /app/data
```

若未掛載 `/app/data`，重新部署或重啟後可能回到初始資料。

---

## 3. LINE Official Account 設定

### Webhook URL

部署完成後，到 LINE Developers 的 Messaging API 設定：

```text
https://your-service.zeabur.app/api/line/webhook
```

並啟用：

```text
Use webhook: Enabled
```

建議關閉 LINE 官方帳號後台的自動回覆，避免 BOT webhook 回覆與官方自動回覆互相衝突。

### LINE 常用文字指令

| 指令 | 回覆內容 |
|---|---|
| 選單 | 回傳六宮格平台入口 |
| 進度 | 年度目標、已完成、待執行、達成率 |
| 2月份執行成效 | 月分統計、告發、通檢、KPI |
| 淡水區執行成效 | 行政區統計與成效 |
| 車牌 ABC-1234 | 累犯、最高超標、告發與通檢紀錄 |

---

## 4. 設定 LINE Rich Menu 圖文選單

本封包已產生圖文選單圖片：

```text
public/assets/line-rich-menu.jpg
```

圖文選單 JSON 範本：

```text
config/line-rich-menu.template.json
```

### 自動建立 Rich Menu

在本機或 Zeabur Terminal 執行：

```bash
export LINE_CHANNEL_ACCESS_TOKEN="你的 LINE Channel access token"
export PUBLIC_BASE_URL="https://your-service.zeabur.app"
npm run richmenu
```

成功後，會建立預設 Rich Menu，LINE 下方選單即會出現六個主要功能入口。

---

## 5. 後台管理功能

進入：

```text
/admin.html
```

可執行：

1. 匯入 Excel / CSV 成果資料。
2. 追加資料或覆蓋成果資料。
3. 一鍵匯出 Excel 總表。
4. 調整年度目標場次。
5. 下載 LINE Rich Menu JSON。
6. 還原範例資料。

匯入欄位可使用中文欄名：

```text
日期、月份、行政區、路段、地點、時段、場次、機台編號、車牌號碼、噪音標準、量測分貝、超標分貝、辨識量、超標件數、告發件數、通知到檢件數、監測時數、備註
```

---

## 6. 外勤人員回報平台

外勤人員可從 LINE Rich Menu 點選「外勤回報」，或直接開啟：

```text
/field-report.html
```

可回報：

- 日期
- 回報類型
- 行政區
- 執行場次
- 機台編號
- 校正值
- 限速
- 噪音標準
- 執勤地點
- GPS座標
- 車牌號碼
- 量測分貝
- 告發件數
- 通知到檢件數
- 備註

勾選「同步建立成果資料紀錄」後，該筆回報會同步進成果查詢系統。

---

## 7. 系統資料位置

系統以 JSON 檔保存資料，位置為：

```text
/app/data/store.json
```

初始資料來源：

```text
/data/seed-data.json
```

正式上線建議定期下載 `/app/data/store.json` 或使用後台匯出 Excel 留存。

---

## 8. 注意事項

- `Wayne0118` 已依需求設為預設後台密碼；正式上線仍建議改成更長密碼。
- 若要讓 LINE webhook 正常運作，`PUBLIC_BASE_URL` 必須是 Zeabur 對外 HTTPS 網址。
- 若 LINE 出現「正在自動回覆訊息」，請到 LINE Official Account Manager 關閉自動回覆或調整為 webhook 優先。
- 本系統為可部署原型，可先用範例資料驗證功能，再匯入正式總表。
