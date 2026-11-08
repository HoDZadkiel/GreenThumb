# Supabase 連線與維護

網站會員、登入、討論文章、在地達人專欄、編輯精選、會員草稿與收藏均使用 Supabase Auth／PostgreSQL。網站不再讀寫本機 SQLite、localStorage 或 sessionStorage；舊 `.local/forum.sqlite` 與瀏覽器資料不刪除，但不再作為網站資料來源。網站只保留版型、操作文字、基本分類與行政區選項。

## 環境變數

`.env` 或 `.env.local` 設定：

```dotenv
NEXT_PUBLIC_SUPABASE_URL=專案的_Project_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=專案的_Publishable_Key
```

現有名稱 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 仍可使用，兩者同時設定時優先使用 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`。前端只使用公開金鑰；權限由 Supabase Auth 與資料表 RLS 執行。

建立／更新資料表才需要在 `.env.local` 額外設定：

```dotenv
DATABASE_URL="從 Dashboard 的 Connect → Session pooler 複製完整 URI"
SUPABASE_DB_PASSWORD=
```

將專案的資料庫密碼填入 `SUPABASE_DB_PASSWORD`。URI 裡可以保留 `[YOUR-PASSWORD]`，管理腳本會將獨立密碼編碼並填入。腳本會檢查資料庫連線與 Project URL 屬於同一個專案。以上管理設定不需提供給 Vercel 或前端，也不要加上 `NEXT_PUBLIC_`。

## 建表及檢查

```sh
npm run db:push -- --dry-run
npm run db:push
npm run db:check
npm run test:supabase
```

`db:push` 使用 Supabase CLI 3 的 migration history；只套用尚未執行的 migration，不會重設資料庫。`00001_init.sql` 建立基礎論壇；`00002_live_forum.sql` 加入現有編輯器欄位、四個植物看板、在地專欄及 368 個行政區；`00003_cloud_content.sql` 加入編輯精選、會員草稿及收藏，並搬入原有三篇編輯文章。每張網站資料表皆啟用 RLS，會員只能以自己身分發文，作者及管理員／版主可以編輯，作者欄位不能從公開 API 更換。

`editorial_articles` 管理首頁與專欄精選：`published` 決定是否公開，`sort_order` 決定順序，標題／簡介／Markdown 內文均從資料庫讀取。可透過 Supabase Table Editor 或具有版主／管理員權限的資料 API 維護。資料修改後重新載入頁面即可看到，不需要重新建置網站。

`00004_article_interactions.sql` 補上文章互動：討論文章沿用 `replies`／`post_likes`，在地專欄與編輯精選使用 `column_replies`／`column_likes`，以外鍵綁定文章。訪客可閱讀公開回應，登入會員只能以自己身分新增回應、按讚及取消自己的讚；每位會員每篇文章只計一次讚。已鎖定的討論不能新增回應，已刪除文章與未公開精選不能從互動 API 存取。新增資料表有 RLS 與明確的欄位權限。

討論文章網址為 `/discussions/[id]`，在地專欄為 `/columns/community/[id]`，編輯精選為 `/columns/[slug]`。所有文章頁都有回應、按讚及分享；分享會複製固定網址，若瀏覽器不允許存取剪貼簿，則提供可選取的連結欄位。`/api/article-interactions` 以 `kind=post|column|editorial` 與 `id` 取得互動，每次載入 30 則回應，`cursor` 取得下一頁；POST 支援 `reply`（1–2000 字）與 `like`（明確的布林狀態）。

`00005_optional_post_location.sql` 在討論文章加入選填的 `region_code`，外鍵對應既有 368 個行政區。發文時預設「不公開位置」，選擇縣市與鄉鎮市區後才會出現圖釘，舊文章不會自動加入地圖。草稿可先只選縣市；正式發表需完成鄉鎮市區或取消位置。編輯文章可移動或取消圖釘，作者權限沿用原本的 RLS。`/api/map-posts` 每頁回傳至多 200 篇未刪除且有位置的文章摘要，提供 `nextCursor`；不回傳全文或私人草稿。地圖將其與在地專欄合併，以不同顏色標示並連至各自閱讀頁。取消位置會同步清除廣域地區；有位置時由資料庫同步北／中／南／東／離島分類，保留討論區原有的地區篩選。

`member_drafts` 每位會員各保留一份討論草稿與一份專欄草稿，只有本人可讀寫；未登入可暫時撰寫，儲存草稿時需登入。表單恢復雲端草稿時不覆蓋已開始輸入的內容。正式發表新文章時，資料庫 trigger 在同一筆交易清除對應草稿，發表失敗則保留草稿。`post_bookmarks` 保存每位會員自己的收藏，其他會員與版主無法查看。

`node scripts/test-live-supabase.mjs` 在完整回滾的交易中驗證雲端文章、字體字級、專欄地點與 RLS。測試資料不提交，也不寄送郵件。

網站啟動後，`node scripts/test-cloud-workflows.mjs` 會建立隨機臨時 Auth 測試帳號，透過真實登入 session 驗證草稿、收藏、發表、跨作者權限及即時精選內容讀取，最後刪除本次 UUID 對應的帳號與內容；不寄送郵件，不更動既有帳號。

測試也涵蓋三種文章的回應、按讚／取消、跨 session 狀態、回應分頁、鎖定與下架保護。若本機使用不同連接埠，傳入測試網址，例如 `node scripts/test-cloud-workflows.mjs http://127.0.0.1:3001`。

## 註冊、信箱驗證及管理員

網站原本的 SQLite 帳號、密碼雜湊與登入 cookie 不會被當作 Supabase 身分。切換時本機只有一個預設管理員、零篇文章及零篇在地專欄；沒有文章需要搬移。舊管理員請在網站重新註冊 Supabase 會員，原 SQLite 不會被刪除或改寫。

1. 在 Supabase 的 **Authentication → URL Configuration** 設定正式 **Site URL**。
2. **Redirect URLs** 加入網站的 `/auth/callback`，本機測試也加入實際使用的網址，例如 `http://localhost:3000/auth/callback` 與 `http://127.0.0.1:3000/auth/callback`。
3. 設定自訂 SMTP，讓一般使用者可以收到驗證信。內建 SMTP 只寄給組織團隊成員且每專案每小時限兩封。
4. 使用者註冊後完成信箱驗證，再登入；不需要驗證的專案也支援立即登入。
5. 如需跨裝置開啟驗證信，可將 **Confirm signup** 信件範本中的連結設為 `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`。程式同時提供 PKCE 的 `/auth/callback`。

將指定的、已完成驗證的會員設為管理員：

```sh
npm run db:admin -- your-email@example.com
```

只有管理腳本使用資料庫管理連線。網站 API 一律使用該使用者的 Supabase session 與公開金鑰，沒有 service-role 繞過權限。

## 部署

部署環境設定同一組 Supabase Project URL 及公開金鑰後重新建置。`NEXT_PUBLIC_` 值會在建置時寫入前端產物。`GREENTHUMB_TRIAL_AUTH` 已不控制網站資料來源，不需要設定。

討論 API 為 `/api/forum`，每次 50 篇並提供載入更多；指定 `id` 可以獨立取得待編輯文章。舊 `/api/trial-forum` 轉接同一套 Supabase 實作。專欄 API 每頁 200 篇，地圖逐頁取得完整資料。`/api/member-data` 管理會員自己的草稿與收藏。原本四篇示範討論、六枚示範圖釘與瀏覽器舊文章不再顯示；三篇編輯文章已搬進資料庫並保留原網址。

參考：[連線方式](https://supabase.com/docs/guides/database/connecting-to-postgres)、[SSR Auth](https://supabase.com/docs/guides/auth/server-side/creating-a-client)、[自訂 SMTP](https://supabase.com/docs/guides/auth/auth-smtp)。
