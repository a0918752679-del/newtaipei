# 新北市打擊噪音車管理系統 — LINE Native V12 Ultimate

## 主要修正

V12 針對 V11 回傳 LINE Reply API 400 的問題進行修正：

- 修正 Flex Message 內不相容的色碼格式，例如 `#fff` 改為 `#ffffff`。
- 新增 Flex 回覆失敗備援機制：若 LINE 拒收 Flex，會自動改回文字備援，避免使用者無回覆。
- `/healthz` 版本更新為 `newtaipei-noise-control-system-v12-ultimate`。
- Rich Menu 名稱更新為 `新北噪音車V12 Ultimate企業版圖文選單`。
- 新增 Flex 除錯端點：
  - `/api/debug/flex/law`
  - `/api/debug/flex/equipment`
  - `/api/debug/flex/kpi`

## 部署

Zeabur 重新上傳本封包後，確認環境變數：

```env
PUBLIC_BASE_URL=https://newtaipeinoise.zeabur.app
DASHBOARD_URL=https://noise115.zeabur.app
FIELD_REPORT_URL=https://out115.zeabur.app
ADMIN_PASSWORD=Wayne0118
LINE_CHANNEL_ACCESS_TOKEN=你的 LINE token
LINE_CHANNEL_SECRET=你的 LINE secret
```

## 部署後檢查

```text
https://newtaipeinoise.zeabur.app/healthz
https://newtaipeinoise.zeabur.app/api/line/test
https://newtaipeinoise.zeabur.app/api/debug/flex/law
https://newtaipeinoise.zeabur.app/api/debug/flex/equipment
```

## LINE 圖文選單

部署完成後，到後台：

```text
https://newtaipeinoise.zeabur.app/admin.html
```

登入後按：

```text
一鍵建立／更新 LINE 圖文選單
```

## 測試指令

在 LINE 直接輸入：

```text
法規中心
設備管理
KPI報表
統計選單
車號查詢
2月份執行成效
土城區執行成效
```

## 注意

LINE Official Account Manager 的自動回覆建議關閉，只保留 Webhook；若要保留自動回覆，內容請改為：

```text
感謝您的回覆🙂
```
