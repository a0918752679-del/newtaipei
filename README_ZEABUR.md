# Zeabur 部署

1. 解壓縮本封包。
2. 確認 GitHub Repo 最外層包含：
   - package.json
   - server.js
   - Dockerfile
   - public/
   - data/
3. 上傳至 GitHub 或 Zeabur Add files via upload。
4. Zeabur 服務 Port 使用 8080。
5. 設定環境變數。
6. 部署完成後測試 `/healthz`。
7. 後台按「一鍵建立／更新 LINE 圖文選單」。

注意：本版 Dockerfile 不依賴 `.npmrc`，不會再出現 `.npmrc not found`。
