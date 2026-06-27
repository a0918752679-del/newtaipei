# 新北市打擊噪音車管理系統｜V15 Stable

## 本版修正

- 修正 Zeabur 建置失敗：`/.npmrc: not found`。
- Dockerfile 不再依賴 `.npmrc`，直接指定 npm 官方 registry。
- 補齊 `express`、`multer`、`xlsx` 依賴。
- 移除舊版 README，只保留 V15 / Zeabur / Local Test 說明。
- 保留 V14.1 場次資料：296 場、車流 303,110、超標 910、告發 56、通知到檢 27。

## 部署後檢查

```text
https://newtaipeinoise.zeabur.app/healthz
```

應回覆：

```json
{"ok":true,"service":"newtaipei-noise-control-system-v15-stable"}
```

## LINE Webhook

```text
https://newtaipeinoise.zeabur.app/api/line/webhook
```

## 後台

```text
https://newtaipeinoise.zeabur.app/admin.html
```

登入後請重新按：

```text
一鍵建立／更新 LINE 圖文選單
```
