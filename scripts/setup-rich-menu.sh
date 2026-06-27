#!/usr/bin/env bash
set -euo pipefail
: "${LINE_CHANNEL_ACCESS_TOKEN:?請先設定 LINE_CHANNEL_ACCESS_TOKEN}"
: "${PUBLIC_BASE_URL:?請先設定 PUBLIC_BASE_URL，例如 https://xxx.zeabur.app}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_JSON="${ROOT}/config/line-rich-menu.generated.json"
export ROOT TMP_JSON
python - <<'PY'
from pathlib import Path
import os
root=Path(os.environ['ROOT'])
src=(root/'config/line-rich-menu.template.json').read_text(encoding='utf-8')
base=os.environ['PUBLIC_BASE_URL'].rstrip('/')
Path(os.environ['TMP_JSON']).write_text(src.replace('${PUBLIC_BASE_URL}', base), encoding='utf-8')
PY
RICH_ID=$(curl -sS -X POST https://api.line.me/v2/bot/richmenu \
  -H "Authorization: Bearer ${LINE_CHANNEL_ACCESS_TOKEN}" \
  -H 'Content-Type: application/json' \
  -d @"${TMP_JSON}" | python -c "import sys,json; print(json.load(sys.stdin).get('richMenuId',''))")
if [ -z "$RICH_ID" ]; then echo "建立 rich menu 失敗"; exit 1; fi
echo "Rich Menu ID: $RICH_ID"
curl -sS -X POST "https://api-data.line.me/v2/bot/richmenu/${RICH_ID}/content" \
  -H "Authorization: Bearer ${LINE_CHANNEL_ACCESS_TOKEN}" \
  -H 'Content-Type: image/jpeg' \
  --data-binary @"${ROOT}/public/assets/line-rich-menu.jpg"
echo "圖片已上傳"
curl -sS -X POST "https://api.line.me/v2/bot/user/all/richmenu/${RICH_ID}" \
  -H "Authorization: Bearer ${LINE_CHANNEL_ACCESS_TOKEN}"
echo "已設為預設圖文選單"
