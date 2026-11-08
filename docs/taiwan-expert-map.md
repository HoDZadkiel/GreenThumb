# 台灣達人地圖

討論文章也可以選填縣市與鄉鎮市區，在同一張地圖顯示棕色圖釘；達人專欄維持綠色。未選位置的文章不會顯示，圖釘只依行政區代表位置標示。作者之後可在文章編輯頁更改或取消位置。資料存放於 Supabase `posts.region_code`，地圖以 `/api/map-posts` 分頁讀取公開摘要。

專欄頁 `/columns#expert-map` 提供互動地圖、縣市篩選、關鍵字搜尋與專欄列表。發表頁 `/columns/write` 接受縣市及鄉鎮市區，發表後自動以區域代表位置落針，作者可從閱讀頁修改所在地。

## 地點資料

- 原始來源：內政部國土測繪中心「鄉鎮市區界線」，[政府資料開放平臺資料集](https://data.gov.tw/dataset/7441)、[國土測繪中心下載頁](https://maps.nlsc.gov.tw/pro/download.jsp)。使用[政府資料開放授權條款第 1 版](https://data.gov.tw/license)。
- 本次下載日期：2026-11-07；下載封裝內檔名為 `TOWN_MOI_1120317`，屬 2023-03-17 版本，不以下載日期宣稱為最新界線。
- `src/lib/taiwan-regions.json` 包含 22 縣市、368 鄉鎮市區的行政區代碼、名稱及代表點。`scripts/build-taiwan-regions.py` 使用最大陸域多邊形的 `representative_point()`，避免多島行政區的幾何重心落在海上。這是區域標記，不是作者住址或精確種植地點。
- 更新時從官方下載 TWD97 經緯度 SHP，解壓到本機資料夾；在 Python 環境安裝 `pyshp` 與 `shapely`，執行 `python scripts/build-taiwan-regions.py <解壓資料夾>`，再執行 `npm run test:columns`。原始壓縮檔及 Python 套件不提交進專案。

## 地圖與圖釘

- 使用 [Leaflet 1.9.4](https://leafletjs.com/reference-1.9.4.html) 與 [Leaflet.markercluster 1.5.3](https://github.com/Leaflet/Leaflet.markercluster/tree/v1.5.3)。地圖只在瀏覽器動態載入；MarkerCluster 分段加入圖釘，相近點聚合，重疊點可散開。
- 一篇專欄對應一個圖釘，多篇同區專欄仍保留獨立入口。列表每次增加六張卡片，點選卡片可定位圖釘並開啟摘要。
- 預設使用 OpenStreetMap 圖磚並保留可見來源標示，遵循[官方圖磚使用政策](https://operations.osmfoundation.org/policies/tiles/)。`NEXT_PUBLIC_MAP_TILE_URL` 可在建置時指定相容的 `{z}/{x}/{y}` 圖磚網址；更換供應商時也須同步調整 `taiwan-map-canvas.tsx` 的 attribution。圖磚無法載入時，保留文字列表與錯誤提示。
- 只顯示 Supabase 的實際專欄；沒有專欄時不落假針，顯示空狀態與發表入口，已移除示範模式。

## 雲端儲存與授權

- 使用 Supabase Auth session、PostgreSQL 與 RLS。網站不讀取本機 SQLite；`GREENTHUMB_TRIAL_AUTH` 不控制網站資料來源。
- `expert_columns` 儲存 `id`、`author_id`、`title`、`excerpt`、`body`、`region_code`、`created_at`、`updated_at`，並為區域及作者建立索引。行政區經緯度由網站資料表推導，客戶端不能任意指定作者或座標。
- `GET /api/expert-columns` 回傳摘要清單；`?id=` 回傳單篇正文。`POST` 建立或更新；作者與管理員可更新，其他會員回應 403，未登入回應 401。更新保留文章 ID、原作者與建立時間。
- 標題最多 100 字、簡介 200 字、內文 5,000 字，前後端皆驗證。閱讀與預覽沿用停用原始 HTML 的 Markdown 元件及 ImgBB 圖片白名單；圖釘彈窗以 DOM `textContent` 建立。
- 草稿由會員手動儲存在 Supabase `member_drafts`，僅本人可存取，可跨裝置還原；新專欄發表成功時在同一筆交易清除對應草稿。訪客可先撰寫，儲存時會開啟登入對話框並保留已寫內容。

## 驗證與後續容量

- `npm run test:supabase`：PostgreSQL migration／RLS 及輸入驗證測試，涵蓋草稿私密性、跨作者修改拒絕、管理員保留原作者、有效行政區與發表清草稿。`test:columns` 保留舊本機模型的回歸測試。
- 正式建置與 TypeScript 通過；瀏覽器驗證註冊登入、草稿還原、預覽、發表落針、修改後移動同一圖釘、重新整理、篩選、同點展開及 390px 手機版面。登入後重新載入串流文章沒有 hydration 錯誤。
- 摘要 API 每頁讀取 200 篇，地圖逐頁取得資料。尚未做大流量或大量資料壓力測試；後續依資料量加入視窗範圍查詢與伺服器聚合，並選擇符合預期流量的圖磚服務。現有聚合與分段加入改善瀏覽操作，不代表無上限容量。
