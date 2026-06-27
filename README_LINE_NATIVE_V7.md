# LINE 原生操作版 V7

## 更新重點

- LINE Rich Menu 改為圖像化設計：文字更大、圖示更多、功能不重複。
- 保留 V4 的「月份統計」與「行政區統計」快速選擇流程。
- 自動回覆內容微調：加入較親和的提示語、emoji 與操作說明。
- Rich Menu 六格：成果查詢、外勤回報、車號追蹤、KPI報表、統計查詢、管理中心。

## 部署

1. 重新上傳本封包到 Zeabur。
2. 確認環境變數：

```env
PUBLIC_BASE_URL=https://newtaipeinoise.zeabur.app
DASHBOARD_URL=https://noise115.zeabur.app
FIELD_REPORT_URL=https://out115.zeabur.app
LINE_CHANNEL_ACCESS_TOKEN=你的 LINE Token
LINE_CHANNEL_SECRET=你的 LINE Secret
```

3. 進入後台：

```text
https://newtaipeinoise.zeabur.app/admin.html
```

4. 登入後按「一鍵建立／更新 LINE 圖文選單」。
