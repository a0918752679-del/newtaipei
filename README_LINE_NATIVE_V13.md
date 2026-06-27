# 新北市打擊噪音車管理系統 V13 Ultimate

## 本版修正

1. 成果資料一致化
   - 全計畫進度固定顯示年度目標、已完成、待執行。
   - 月份／行政區／時段查詢改為顯示「查詢範圍場次」與「資料筆數」，避免行政區查詢仍顯示全計畫已完成場次造成誤解。
   - KPI 改以查詢範圍的成案件數 ÷ 查詢範圍場次計算。

2. 成果查詢系統頁面
   - 月份、行政區改為自製勾選晶片，不使用手機瀏覽器原生下拉框。
   - 手機版篩選條件改為浮出式面板，避免勾選視窗被頁面遮住或文字顯示異常。
   - 支援月份與行政區複選比較。

3. LINE Bot 查詢
   - 「月份統計」會直接回傳可點選的月份查詢面板。
   - 「行政區統計」會直接回傳可點選的行政區查詢面板。
   - 成果查詢 Flex Message 加入 Quick Reply：月份、行政區、KPI、車號。

4. LINE 圖文選單 UI
   - 改為科技風深藍介面。
   - 移除破圖 emoji，全部改成向量式圖示。
   - 大字體、高對比、按鈕分區清楚。

## 部署

重新上傳本封包至 Zeabur 後，確認：

```text
https://newtaipeinoise.zeabur.app/healthz
```

應顯示：

```json
{"ok":true,"service":"newtaipei-noise-control-system-v13-ultimate"}
```

接著進入：

```text
https://newtaipeinoise.zeabur.app/admin.html
```

按「一鍵建立／更新 LINE 圖文選單」。

## 注意

若 LINE Rich Menu 圖片仍是舊版，請在 LINE 聊天室重新開啟、重新加入好友，或於後台重新建立一次 Rich Menu。
