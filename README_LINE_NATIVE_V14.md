# 新北市打擊噪音車管理系統 V14 Ultimate Enterprise Stable

## 本版修正

1. 修正 Zeabur 部署錯誤：`Cannot find package /app/node_modules/express/index.js`。
   - 移除含內部 registry 的 package-lock。
   - 新增 `.npmrc` 指定 `https://registry.npmjs.org/`。
   - Dockerfile 改為乾淨安裝 dependencies。
   - `.dockerignore` 不再排除 node_modules 造成上傳部署混亂，部署時以 npm install 為準。
2. 保留 V13 成果資料一致化：全計畫進度與查詢範圍成果分開計算。
3. 保留 V13 成果查詢頁浮出式月份與行政區勾選面板。
4. 保留 LINE 原生月份、行政區選擇邏輯。
5. 保留 V12 Flex 備援機制：Flex Reply API 失敗時改用純文字回覆，避免 LINE 無回應。
6. 保留法規中心、設備管理、KPI、統計選單、車號追蹤與管理中心指令。

## Zeabur 必要環境變數

```env
NODE_ENV=production
PORT=8080
PUBLIC_BASE_URL=https://newtaipeinoise.zeabur.app
DASHBOARD_URL=https://noise115.zeabur.app
FIELD_REPORT_URL=https://out115.zeabur.app
ADMIN_PASSWORD=Wayne0118
SESSION_SECRET=請填一組長隨機字串
LINE_CHANNEL_ACCESS_TOKEN=你的 LINE Channel access token
LINE_CHANNEL_SECRET=你的 LINE Channel secret
ANNUAL_GOAL=490
DATA_DIR=/app/data
```

## 部署後檢查

```text
https://newtaipeinoise.zeabur.app/healthz
```

應顯示：

```json
{"ok":true,"service":"newtaipei-noise-control-system-v14-ultimate-enterprise-stable"}
```

## LINE 測試

重新部署完成後：

1. 到 `https://newtaipeinoise.zeabur.app/admin.html`
2. 登入密碼：`Wayne0118`
3. 按「一鍵建立／更新 LINE 圖文選單」
4. LINE 內測試：
   - 法規中心
   - 設備管理
   - KPI報表
   - 統計選單
   - 土城區執行成效
   - 2月份執行成效

## 若仍出現官方自動回覆

到 LINE Official Account Manager：

```text
設定 → 回應設定
聊天：開啟
Webhook：開啟
自動回應訊息：關閉
AI聊天機器人：關閉
```

或將官方自動回覆文字改成：

```text
感謝您的回覆🙂
```


## V14.1 Clean Updated（本次整理）

- 已移除舊版 `README_LINE_NATIVE_V3/V6/V7/V10/V11/V12/V13` 等檔案，只保留 V14 文件。
- 已更新場次資料來源：`聲音照相資料匯入樣板06.17v1.xlsx`。
- 成果資料：296 場次，辨識車流 303,110 件，超標 910 件，告發 56 件，通知到檢 27 件。
- 車輛案件資料：83 筆，已納入車號追蹤。
- 若 Zeabur 使用 Volume 且仍保留舊 `store.json`，本版啟動時會依 `seed-data.json` 版本自動更新至 V14.1。
