# 新北市打擊噪音車管理系統｜LINE Native V11 Enterprise

## V11 重點

本版針對 LINE 端「Rich Menu 有顯示、但點擊後無反應」進行企業版修正：

- 完整 Message Router：法規中心、設備管理、KPI、統計、車號、月份、行政區皆可直接在 LINE 內執行。
- 新增 Webhook 偵錯端點，可直接確認 LINE 是否送事件到 Zeabur。
- 新增 LINE Reply API 狀態紀錄，可判斷 Token 錯誤、Reply API 失敗或簽章錯誤。
- 找不到指令時統一回覆：`感謝您的回覆🙂`。
- 保留成果查詢系統 `https://noise115.zeabur.app` 與外勤回報 `https://out115.zeabur.app`。

## 部署後檢查

### 1. 健康檢查

```text
https://newtaipeinoise.zeabur.app/healthz
```

應顯示：

```json
{"ok":true,"service":"newtaipei-noise-control-system-v11-enterprise"}
```

### 2. LINE 測試端點

```text
https://newtaipeinoise.zeabur.app/api/line/test
```

應顯示 `LINE BOT OK`，並確認：

- `hasToken: true`
- `hasSecret: true`

### 3. Rich Menu 規格

```text
https://newtaipeinoise.zeabur.app/api/line/rich-menu-spec
```

應包含：

- 法規中心
- 設備管理
- KPI報表
- 統計選單
- 車號追蹤

### 4. Webhook 偵錯

在 LINE 內輸入 `法規中心` 後，打開：

```text
https://newtaipeinoise.zeabur.app/api/line/debug/latest
```

若 `lastEvents` 有看到 `法規中心`，代表 LINE 已送到 Zeabur。
若 `lastReply.status` 不是 200，代表 LINE Token 或 Reply API 有問題。

## LINE Official Account Manager 必要設定

請到：

```text
LINE Official Account Manager → 設定 → 回應設定
```

建議設定：

```text
聊天：開啟
Webhook：開啟
自動回應訊息：關閉
AI聊天機器人：關閉
```

如果自動回應一定要留，內容請改成：

```text
感謝您的回覆🙂
```

## Zeabur 環境變數

```env
NODE_ENV=production
PORT=8080
PUBLIC_BASE_URL=https://newtaipeinoise.zeabur.app
DASHBOARD_URL=https://noise115.zeabur.app
FIELD_REPORT_URL=https://out115.zeabur.app
ADMIN_PASSWORD=Wayne0118
SESSION_SECRET=請使用長隨機字串
LINE_CHANNEL_ACCESS_TOKEN=你的 LINE Channel Access Token
LINE_CHANNEL_SECRET=你的 LINE Channel Secret
ANNUAL_GOAL=490
DATA_DIR=/app/data
```

## 上線流程

1. 將 V11 封包上傳到 Zeabur。
2. 確認 `/healthz` 顯示 V11。
3. 進入後台：

```text
https://newtaipeinoise.zeabur.app/admin.html
```

4. 登入後按「一鍵建立／更新 LINE 圖文選單」。
5. 在 LINE 測試：

```text
法規中心
設備管理
KPI報表
統計選單
2月份執行成效
土城區執行成效
車牌 ABC-1234
```
