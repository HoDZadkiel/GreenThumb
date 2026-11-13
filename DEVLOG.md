## 2026-10-31

### 修改內容（Changes）
- 用 project-init（software 類型）初始化專案：`src/` `tests/` `docs/images/` `scripts/` `examples/` `.github/workflows/`
- 新增 `README.md`、`CLAUDE.md`（目標、技術棧 Next.js + Supabase、開發約定、禁止事項）、`LICENSE`（MIT）、`.gitignore`（node）、`.github/FUNDING.yml`（Ko-fi）
- 新增 `docs/database-schema.md`：MVP 資料表 8 張（profiles / boards / species / posts / post_species / replies / images / reports）、trigger、RLS
- 新增 `tests/schema.test.mjs`：用 PGlite 模擬 Supabase，驗證權限與 trigger 行為
- 調整資料表設計：新增 `post_type`（發問／分享／教學）、`region`（domain，7 個地區）、按讚（`post_likes` / `reply_likes`）、最佳解答（`accepted_reply_id` 複合外鍵）、自由標籤（`tags` / `post_tags`）；測試擴充到 32 項，全部通過
- `README.md`：更新特色與 Roadmap
- `.gitignore` 加入 `.claude/settings.local.json`；`git init` 後建立私人 repo `HoDZadkiel/GreenThumb` 並 push `main`

### 問題與解法（Problems & Solutions）
- 資料夾內已有 `.claude/settings.local.json`，scaffold 腳本判定為非空而拒絕寫入 → 先建在暫存區，再用 `cp -n` 複製進來，沒有動到 `.claude/`
- safe-push 掃描把 CLAUDE.md 的規則說明文字（「token／密碼／連線字串」）與 `.env.local` 判成機密 → 人工確認為誤判後才 push
- 預設 username 取 uuid 前 8 碼會撞號 → 改用 `md5(id)` 前 15 碼
- 欄位保護 trigger 連後台（SQL Editor / service_role）也攔，導致無法任命版主 → `auth.uid()` 為 null 時放行
- 版主可自行升為 admin → 角色變更限定只能從後台執行
- 最佳解答要保證屬於同一篇文章 → `replies` 加上 `unique (id, post_id)`，再用複合外鍵 `on delete set null (accepted_reply_id)` 參照（需 PG15+）

### 待辦事項（TODO）
- 尚未設定 Storage bucket policy（路徑 `{user_id}/{uuid}.webp`）
- 自由標籤可能出現同義詞，之後需要合併機制
- `.env.local` 需填入實際的 Supabase URL 與 anon key
- Next.js 16 已將 middleware 改為 proxy 慣例，待日後遷移（`npx @next/codemod@canary middleware-to-proxy .`）
- 清理 `public/` 中 create-next-app 預設的 SVG 圖示

### 環境建置（Environment Setup）
- 初始化 Next.js 16 App Router（TypeScript + Tailwind CSS v4），`--src-dir` 模式
- 安裝 shadcn/ui（v4.23，Tailwind v4 整合），含 `button` 元件與 `cn` 工具
- 安裝 `@supabase/supabase-js` v2、`@supabase/ssr` v0
- 建立 Supabase client 工具：`src/lib/supabase/client.ts`（瀏覽器端）、`server.ts`（Server Component）、`middleware.ts`（Session 刷新）
- 建立 `src/middleware.ts` 整合 Supabase Auth session
- 從 `docs/database-schema.md` 提取 SQL，生成 `supabase/migrations/00001_init.sql`
- 建立 `.env.local`（需填入 Supabase 憑證）與 `.env.example`
- `package.json` 加入 `test:schema` 腳本；`@electric-sql/pglite` 已加進 devDependencies
- 更新 `.gitignore`：加入 `next-env.d.ts`、`supabase/.temp/`、`AGENTS.md`
- `layout.tsx` 設定 `lang="zh-Hant"`、metadata 改為 GreenThumb 標題與描述
- `page.tsx` 改為 GreenThumb 佔位首頁
- `next build` 通過，無錯誤

## 2026-11-02

### 修改內容（Changes）
- `src/app/page.tsx`、`src/components/community/community-home.tsx`：實作響應式首頁、搜尋、分類、地區與熱門篩選、文章預覽、當次頁面收藏、本機草稿儲存與還原。
- `src/app/community.css`、`src/app/globals.css`：建立米白與森林綠視覺、手機排版、焦點與減少動態效果設定，修正字型變數自我引用。
- `public/images/plant-studio.png`：使用內建 imagegen 製作植物主視覺。
- `docs/website-design.md`：記錄設計方向、示範範圍及圖片生成提示；`docs/images/home-desktop.jpg`、`home-mobile.jpg`：保存實際預覽。

### 問題與解法（Problems & Solutions）
- 沙箱內 npm 網域解析與 Nextcloud 檔案讀取失敗；改於經核准的一般本機環境安裝既有依賴並完成檢查，未修改憑證。
- ESLint、正式建置及建置內 TypeScript 檢查通過；瀏覽器實測搜尋、分類、空結果、收藏、文章預覽、草稿儲存／還原，手機寬度 390px 無水平溢位。
- 瀏覽器未記錄前端錯誤；桌機全頁截圖失敗，改保存首頁可視範圍截圖。

### 待辦事項（TODO）
- 串接 Supabase 會員、真實文章、圖片上傳與持久收藏；目前人物及文章均為示範，草稿只存目前瀏覽器。
- 依已建議的架構導入 CI/CD；既有 middleware 改名 proxy 的警告留待後續處理。

### 帳號與積分設計

#### 修改內容（Changes）
- 新增 `docs/accounts-and-points.md`：Email 註冊驗證、公開會員資料、角色與停權、綠芽積分、成長稱號、頁面流程、最小實作方式及驗收案例。

#### 問題與解法（Problems & Solutions）
- 沿用既有 Auth、profiles 與角色，不另建登入系統；積分只影響稱號。
- 設計每日獎勵上限、刪除撤銷、最佳解答改選及防重複入帳規則；確認 Supabase 官方 Auth、SMTP 與 RLS 文件。
- 本次只產出設計規格，未變更程式或資料庫，未執行功能測試。

#### 待辦事項（TODO）
- 依規格實作會員頁面、SMTP、驗證流程、受保護的停權欄位及積分明細 migration，並執行文件中的驗收案例。

## 2026-11-03

### 修改內容（Changes）
- 新增 `docs/image-hosting-research.md`：研究 PTT 式外連圖片、四家圖床、費用歸屬、Next.js／Vercel 行為、R2 保存方案及分階段驗收。

### 問題與解法（Problems & Solutions）
- 官方資料確認 Postimages 禁止自動／程式化上傳，Imgur 與 Catbox 有商業用途限制；將人工外連與站內 API 整合分開評估。
- 明列既有 WebP 約定、images.storage_path 與外連方案的差異，保留正式實作時的調整事項。
- 檢查 Markdown 章節、引用網址格式與容量算式；未執行實際上傳、跨網路可用性或網站功能測試。

### 待辦事項（TODO）
- 實測候選圖床的台灣可用性、回連及圖片管理流程，再選定白名單。
- 確認採用方案後實作外連圖片介面與 migration；重要內容保存另行設計作者授權與備份流程。

## 2026-11-04

### 修改內容（Changes）
- 在 `docs/image-hosting-research.md` 補充 Imgur 與 ImgBB 的外連及保存政策比較。
- 在 `src/components/community/community-home.tsx` 與 `src/app/community.css` 加入 ImgBB 上傳引導、最多五張直連預覽、移除與本機草稿還原。
- 新增 `docs/cross-platform-architecture.md`，評估電腦網頁、手機網頁及 App 的內容共用、編輯與發布方式。
- 新增 `src/app/columns/`、`src/app/discussions/page.tsx` 和 `src/lib/columns.ts`，完成專欄列表、三篇文章及討論區路由。首頁、共同導覽及樣式同步更新。
- 在 `docs/website-design.md` 記錄各頁分工和未來合作卡片的擺放位置。
- 依使用者指示優先做網頁試用。抽出 `src/lib/community-content.ts`，新增 `src/lib/trial-posts.ts` 與本機試發文、閱讀、修改流程，支援分類與 ImgBB 附圖。
- 使用 `src/lib/trial-forum-db.mjs`、`src/app/api/trial-forum/route.ts` 與 `src/middleware.ts` 啟用本機 SQLite，加入 Email 註冊、登入、登出與伺服器端發文及編輯授權。
- 更新 `src/components/community/community-home.tsx`、`src/app/community.css` 與 `src/lib/trial-posts.ts`。新文章存在 SQLite，舊版本機文章仍可讀，草稿仍由瀏覽器保存。
- 透過 `scripts/seed-trial-admin.mjs` 建立預設管理員。在 `.env.example` 記錄啟用方式，`.gitignore` 排除本機資料庫。

### 問題與解法（Problems & Solutions）
- 查核兩家官方文件，依貼圖流程與自動刪除設定將 ImgBB 列為兩家之中的優先測試候選，保留來源頁及可替換連結以便補圖。
- 通過 ESLint 與正式建置。瀏覽器驗證相簿連結提示、重複連結、移除和草稿還原。官方範例直連回傳圖床的缺圖占位圖，瀏覽器將其視為正常圖片。
- 區分文章同步與介面發版，評估 Next.js PWA、Expo 與 Capacitor 的共用範圍。
- 建置產物遭檔案鎖定，將舊 `.next` 移至本機暫存後重新建置成功。ESLint、專欄連結、搜尋與地區篩選、ImgBB 入口及 390px 手機寬度均已檢查。
- 本機試用通過 ESLint 和正式建置。瀏覽器驗證空白欄位提示、發表、編輯、重新整理、首頁與討論區共用文章，以及 390px 閱讀版面。
- 暫停 App 試作並移至本機暫存，以便專注驗證網頁。
- 正式建置與 ESLint 通過。依實際請求的 Host 修正本機同源檢查，HTTP 測試通過註冊、重複帳號、錯誤密碼、登入登出、訪客與跨作者發文權限，以及預設管理員登入和編輯。瀏覽器確認訪客點發文後可進入註冊頁。

### 待辦事項（TODO）
- 實測免費帳號上傳與 GreenThumb 網域直連，驗證斷圖提示及替換流程。
- 正式發文功能接上資料庫時，再儲存文章的圖片直連並驗證實際照片載入。
- 實作共用文章資料與伺服器草稿，驗收跨裝置續編，再規劃商店版 App。
- 專欄和討論區使用示範內容。合作卡片待有實際贊助或店家資料後加入。
- 本機 SQLite 試用支援會員及發文。Email 驗證、忘記密碼及跨裝置草稿待後續開發。

## 2026-11-06

### 修改內容（Changes）
- `src/components/community/` 加入 Markdown 工具列、撰寫／預覽切換、游標處插入 ImgBB 圖片及正文黑體／宋體選擇。預覽與閱讀共用 `react-markdown` 和 `remark-gfm`。
- `src/app/api/trial-forum/route.ts`、`src/lib/trial-forum-db.mjs` 和 `src/lib/trial-posts.ts` 新增文章字體欄位，舊純文字與文末附圖可繼續讀取。
- `src/app/layout.tsx`、`src/app/globals.css`、`src/app/community.css` 接上本機 Noto Sans TC 和 Noto Serif TC 字型。模組與字體評估寫入 `docs/website-design.md`。
- 新增 `src/app/discussions/write/page.tsx`，從 `community-home.tsx` 抽出 `post-editor.tsx`。發文及編輯共用獨立頁面，桌機並排預覽，手機切換撰寫與預覽。
- 發文工具列新增連結和刪除線，透過 `trial-forum` API 與 SQLite 儲存三種正文字級。

### 問題與解法（Problems & Solutions）
- SQLite 以可空欄位辨識舊純文字。用舊資料表測試升級並驗證拒絕任意字體值。
- 正式建置及資料表測試通過。瀏覽器驗證宋體、標題、粗體、表格、ImgBB 圖片元素、封鎖其他圖床與 HTML，以及重新整理後維持排版。390px 寬度無橫向溢出。
- 修正本機草稿的型別推斷後，ESLint 和正式建置通過。瀏覽器驗證入口跳轉、登入、即時預覽、發表後保留宋體和大字級、重新編輯改為小字級，以及 390px 版面切換。

### 待辦事項（TODO）
- 用實際植物照片測試 ImgBB 上傳與不同裝置的載入效果。

## 2026-11-07

### 修改內容（Changes）
- 更新 README 的啟動流程與試用範圍，並在 `.gitignore` 補上 PKCS#12 憑證檔案的排除規則。
- 將 Supabase URL 與公開金鑰的環境變數從 `.env.local` 移至 `.env`，保留其他本機設定。
- 瀏覽 JKF、巴哈姆特與伊莉；使用者協助登入巴哈姆特及伊莉後，檢視發文頁與圖片工具。參考與採用方式記錄於 `docs/website-design.md`。
- `src/components/community/community-home.tsx` 與 `src/app/community.css` 改為桌機三欄論壇布局、精簡首頁主視覺、看板導覽、精簡／摘要列表及最多回覆排序；手機採單欄與可橫向捲動的分類列。
- `src/components/community/post-editor.tsx` 整理看板、標題、內文的發文順序，加入寬版撰寫／對照／預覽、圖示工具列、按需展開圖片工具、發問範本、草稿狀態及底部固定操作列。
- 訪客可先撰寫與儲存草稿，再從登入對話框繼續發表；從植物看板進入會帶入分類，有草稿時優先還原草稿。編輯他人文章的權限仍由 API 驗證。
- `src/app/layout.tsx` 標示既有的平滑捲動設定，讓 Next.js 在路由切換時正確處理捲動。
- 依試用回饋移除頁首「首頁／討論區／專欄」三個分頁；`src/app/page.tsx` 改為上半部專欄精選與兩篇文章入口，下半部接續植物討論區，沿用植物照片作為專欄封面。
- 專欄頁新增 Leaflet 台灣達人地圖、圖釘聚合與重疊點展開、縣市及關鍵字篩選、專欄列表與明確標示的示範模式。手機以地圖在上、列表在下呈現。
- 新增專欄發表／編輯頁、會員專欄閱讀頁及 `expert-columns` API，沿用會員 session、Markdown、SQLite 與手動本機草稿；縣市＋鄉鎮市區決定圖釘所在地。
- 新增官方行政區代表點資料、可重建的 Python 腳本、11 項專欄資料與權限測試、`test:columns` 指令及 `docs/taiwan-expert-map.md`，同步更新 README 與網站設計文件。
- 會員、登入 cookie、討論文章及在地專欄全面改接 Supabase Auth／PostgreSQL；新增 `/api/forum` 與信箱驗證回呼，既有試用 API 轉接相同雲端實作。依 Next.js 16 文件將 middleware 改為 proxy。
- 套用 `00001_init.sql`、`00002_live_forum.sql` 至使用者指定的 Supabase 專案，建立四個植物看板、368 個行政區及專欄資料表，保留 Markdown、ImgBB 圖片連結、字體及字級；資料表皆啟用 RLS，禁止公開 API 改寫作者或提升會員權限。
- 新增 migration 預覽／套用、公開 API 檢查、管理員設定及完整回滾的雲端權限測試腳本，新增輸入驗證與 PostgreSQL migration 測試；README、`.env.example` 及 `docs/supabase-setup.md` 記錄環境變數、驗證信與部署操作。
- `.env.local` 停用舊試用旗標，原 SQLite 保留；切換時本機只有一個預設管理員，零篇文章及零篇在地專欄。舊瀏覽器草稿保留，靜態示範討論加上標示，避免其編號與雲端文章的 React key 重複。

### 問題與解法（Problems & Solutions）
- 從最近一次 Next.js 建置的 source map 還原 `src/lib/` 內五個缺少的模組。核對同批建置內的 API 與編輯器原始碼和工作目錄一致。
- 隔離環境通過 ESLint、正式建置與頁面和 SQLite 試用帳號檢查。資料表測試也已通過。
- 發現 `00001_init.sql` 編碼損壞且遺失 SQL 行。從資料表設計文件以 UTF-8 重建 migration，並用重建的檔案通過 32 項資料表與權限測試。
- 確認 Git 忽略 `.env`，並移除 `.env.local` 的同名設定，避免覆蓋 `.env`。
- 補齊工作目錄缺少的既有 Markdown 依賴，未改動依賴宣告。初次正式建置遇到 Nextcloud 快取 mmap 錯誤，將舊 `.next` 保留於 `.local/next-cache-forum-ui-20261107`，重新在本機完成建置。
- TypeScript 與正式建置通過。瀏覽器驗證最新／熱門／最多回覆、搜尋與地區篩選、兩種列表、看板帶入、空白欄位提示、範本與粗體工具、圖片網址驗證、預覽／對照、草稿儲存及重新載入還原。
- 經使用者授權建立本機測試帳號，驗證登入後保留內文、發表、編輯、重新載入，以及宋體與字級持久化；測試後已清理本次建立的帳號、文章與 session。
- 驗證 390px 手機首頁、討論區與發文預覽無整頁橫向溢出；桌機檢查首頁、發文頁與專欄導覽。畫面保留於 `.local/ui-review/`，驗證用伺服器已停止。
- 首頁重排後 TypeScript 與差異格式檢查通過；瀏覽器確認三個分頁已移除、專欄位於討論區之前、專欄連結與討論搜尋可用，390px 手機無整頁橫向溢出。保留 `http://127.0.0.1:3000/` 開發伺服器供使用者繼續試用，更新畫面存於 `.local/ui-review/home-columns-first.jpg`。
- 使用者確認地點精度為縣市＋鄉鎮市區；由官方 SHP 產生 368 個區域代表點，記錄封裝檔 2023-03-17 版本及來源授權，避免以示範作者的假地點充當真實資料。
- 專欄儲存由 session 決定作者；測試拒絕訪客、跨作者修改及偽造行政區，作者可移動原有圖釘，管理員修改保留原作者。11 項測試、TypeScript 與正式建置通過。
- 瀏覽器驗證草稿、登入後保留內文、發表、編輯所在地、重新整理、地圖與列表連動、同點聚合展開、地區與關鍵字篩選；390px 地圖與編輯器無整頁橫向溢出。已清理本次測試帳號、專欄及 session。
- 修正串流專欄的編輯入口與提早完成的會員請求造成的 hydration 差異；正式建置後驗證登入作者重新整理可見編輯入口，瀏覽器無錯誤。保留正式試用伺服器與地圖頁，畫面存於 `.local/ui-review/`。
- 使用者補上 Session pooler URI 與獨立資料庫密碼後驗證連線，腳本自動編碼密碼並核對 Project URL。Supabase CLI 3 改用 `db push --remote=<url>`，已成功套用兩份 migration。
- Supabase 公開 API 驗證資料表、四個看板與 368 個區域皆可讀。雲端交易驗證文章格式、專欄地點、跨作者拒絕、管理員保留作者與全表 RLS，測試會員及內容完整回滾。
- 原 schema 32 項檢查、既有專欄 11 項測試、新增輸入與 migration 測試、TypeScript、ESLint 及正式建置通過。ESLint 排除 `.local` 暫存快取；受限環境編譯卡住，停止後在完整環境建置成功。
- HTTP 驗證新版／相容 API、訪客拒絕、輸入、同源、請求大小、四個主要頁面及無效驗證信回呼。原 3000 埠已重新啟動為 Supabase 版本；未寄送測試郵件，尚未驗收真實信箱註冊與驗證信送達。

### 待辦事項（TODO）
- 正式開放註冊前配置 Supabase Site URL／Redirect URLs 與自訂 SMTP，實測真實信箱驗證。舊本機管理員需重新註冊，完成驗證後可用 `db:admin` 指令指定管理員。
- 達人地圖依資料量加入範圍查詢與伺服器聚合；目前每頁載入 200 篇，但尚未進行大量資料壓力測試。

## 2026-11-08

### 修改內容（Changes）
- 完成 Supabase 切換的最後驗證，保留既有本機 SQLite 與瀏覽器草稿。
- 依使用者要求將剩餘網站內容全面改為 Supabase：移除四篇硬編碼示範討論、六枚示範圖釘與瀏覽器舊文章讀取；首頁精選、專欄列表與正文改為查詢雲端，原三篇編輯文章搬入資料庫並保留網址。
- 套用 `00003_cloud_content.sql`，建立 `editorial_articles`、`member_drafts`、`post_bookmarks` 與 RLS；會員草稿及收藏可跨登入還原，訪客儲存時要求登入。發表新文章與清除對應草稿在同一筆資料庫交易完成。
- 討論列表的時間、類型、地區、讚數及回覆數改用雲端欄位；移除固定季節文章卡。前端保留版型、視覺素材、操作文字與基本分類／行政區選項，沒有 localStorage／sessionStorage 內容資料來源。
- 新增真實 Supabase Auth 流程測試腳本、草稿輸入與 RLS 回歸測試，更新 README、Supabase 設定及台灣達人地圖文件。
- 依使用者要求整理本批論壇介面、達人地圖與完整 Supabase 串接變更，推送目標為既有 `origin/main`。補齊公開金鑰相容名稱、Python／日誌／本機資料庫忽略規則，並將 README 圖片流程修正為目前的 ImgBB 外連。

### 問題與解法（Problems & Solutions）
- 上次最後一項唯讀檢查因自動核准審查服務用量限制未能執行；使用者要求繼續後已成功補驗。雲端 migration history 包含 `00001`、`00002`，所有 public 網站資料表皆啟用 RLS，測試帳號、文章及專欄數量均為零，確認交易測試完整回滾。
- 恢復工作時發現先前的本機伺服器已停止，改以隱藏背景程序啟動正式版本。重啟後首頁、討論 API 與專欄 API 均回應 HTTP 200，保留 `http://127.0.0.1:3000/` 供繼續試用。
- 新 migration／草稿驗證測試、TypeScript、ESLint 與正式建置通過。以隨機臨時 Auth 帳號測試真實登入、兩個獨立 session 還原草稿與收藏、重複儲存、跨會員隔離、發表後清草稿、專欄所在地與登出；全部通過，未寄送測試郵件。
- 臨時公開精選在不重新建置的情況下立即出現在首頁及正文頁，確認資料來自 Supabase。測試後刪除本次 UUID 對應的帳號與內容；最後資料庫只有搬入的三篇編輯文章，會員、討論、在地專欄、草稿及收藏皆為零，所有 public 資料表均啟用 RLS，migration history 包含 `00001`、`00002`、`00003`。
- 瀏覽器驗證首頁零篇討論空狀態、雲端三篇編輯精選、無示範圖釘、訪客儲存草稿開啟登入對話框；修正舊的瀏覽器草稿提示並重新建置。首頁畫面存於 `.local/ui-review/cloud-content-20261108.png`，正式背景伺服器保留於原 3000 埠。
- 推送前使用 safe-push 檢查忽略規則、機密檔案、程式與文件、README、blob 大小及環境變數範例；將文件密碼示例改為空白欄位。掃描器對環境變數檔名的內部主機警告經逐項確認為誤判，無關的 `新增 文字文件.txt` 保留本機、不納入提交。

### 待辦事項（TODO）
- 使用真實信箱驗收 Supabase 註冊及驗證信送達；對外開放前確認 Site URL／Redirect URLs 與自訂 SMTP。舊本機管理員需改用已驗證的 Supabase 會員，再指定管理員權限。


## 2026-11-13

### 修改內容（Changes）
- Google 登入改用網站內的 Better Auth，Supabase 僅提供 PostgreSQL；移除執行中的 Supabase Auth／Data API 模組，論壇、專欄、草稿、收藏與互動改為標準 SQL。
- 加入 Gmail SMTP 六位數登入碼、雜湊儲存、過期／一次性／嘗試限制與資料庫速率限制；預設關閉 Email 入口，另提供不寄信的 mail:check。
- Google 使用獨立視窗，保留原頁面編輯內容；會員可設定公開暱稱，不自動公開 Google 姓名。
- 新增 00006_portable_auth.sql、通用 PostgreSQL migration runner、受限執行帳號初始化與新資料庫檢查指令；既有 UUID 與文章歸屬保留，RLS 持續啟用。
- 新增 Google OAuth／Gmail 設定文件，更新 README、資料表文件、環境變數範例及專案約定。本機已準備空白憑證欄位與隨機 session 密鑰，未輸出機密。
- 使用者明確同意後，已對目前 Supabase PostgreSQL 套用 `00006_portable_auth.sql`、建立 `greenthumb_app` 受限登入帳號，並將網站執行連線安全寫入 `.env.local`。
- 依使用者要求直接在 Supabase PostgreSQL 建立 `test01` 至 `test03` 三組一般測試會員，建立 `gt_user`／`gt_account` 及公開 profile；原始帳密保存於 Git 忽略的 `.local/test-accounts.json`，資料庫只儲存 Better Auth 相容的密碼雜湊。
- 開放既有會員以 Email／密碼登入，加入網站表單、錯誤提示、資料庫登入頻率限制與 `AUTH_PASSWORD_ENABLED` 開關；公開帳密註冊保持關閉，沿用原三組測試帳密。
- 補齊 Vercel Production 環境變數設定文件；程式更新將推送既有 `origin/main`，本機帳密檔及 `.env.local` 不上傳。

### 問題與解法（Problems & Solutions）
- 本機隔離測試通過 Google RSA token、PKCE、一次性 state、issuer／audience／期限／簽章拒絕、登出、會員與論壇權限、OTP 安全限制，以及舊會員／文章遷移保留；不連 Google、不寄信、不寫入既有資料庫。
- 既有 schema、歷史 Supabase migration 與專欄測試通過；TypeScript、ESLint、正式建置通過。瀏覽器確認未設定憑證時停用 Google 按鈕，SMTP 入口隱藏；畫面位於 .local/ui-review/google-login-pending.png。
- 遠端資料庫原有根憑證不在 Node 的預設信任庫；下載供應商公開 CA，新增 DATABASE_CA_FILE／DATABASE_CA_CERT，維持完整 TLS 驗證。唯讀 migration 預覽確認只有 00006 待套用。
- 自動核准審查拒絕執行 db:setup-auth，理由是需明確授權現有資料庫的會員外鍵、RLS 及登入角色變更；沒有套用 migration 或建立資料庫角色。
- 使用者後續明確同意執行遷移；六張既有會員與內容資料表的筆數及完整內容指紋均與遷移前相同，保留 1 位會員、1 篇討論及 3 篇編輯精選。
- 修正初始化腳本的 PostgreSQL `format` 參數型別；先確認角色沒有高權限，再只設定 LOGIN／密碼，避免受管管理角色不能重述 NOSUPERUSER 屬性的限制。
- 真實雲端資料庫驗證受限連線、全表 RLS、訪客無法讀取 session、會員草稿寫入與拒絕提權、連線池身分清除；測試交易完整回滾，沒有保留測試資料。migration history 已包含 `00001` 至 `00006`。
- 啟用後正式建置通過；本機論壇、會員 session、專欄、地圖、收藏 API 與首頁／討論／專欄／撰寫頁皆回應 HTTP 200。保留僅綁定本機的 `http://localhost:3000` 試用網站；Google 尚待憑證，SMTP 維持關閉。
- 三組測試會員均已核對一般會員權限及原始密碼與雜湊相符；帳密與初始化腳本均位於 `.local/`，未輸出密碼至對話或日誌。此次僅建立資料，未新增網站帳密登入入口，未寄送郵件。
- 修正 Cache Components 對 NextRequest 的 Proxy 包裝造成 Undici 複製請求失敗；以網址、method 與 headers 重建已驗證的請求，新增實際 Proxy 請求回歸驗證。
- 帳密／Google／OTP 共五項整合測試、TypeScript、ESLint 與正式建置通過。正式啟動模式驗證三組測試帳號登入、會員狀態、論壇／私人草稿權限、登出及 session 失效；錯誤密碼被拒絕，沒有寄信或變更原密碼。
- 瀏覽器確認登入視窗顯示 Email、密碼與帳密登入按鈕，Google 未設定時維持停用；畫面保存於 `.local/ui-review/password-login.png`。

### 待辦事項（TODO）
- 使用者尚未建立 Google OAuth Client ID／Secret；依 docs/authentication.md 建立並填入 .env.local 後，以真實 Google 帳號驗收會員功能。
- Gmail SMTP 待填入專用寄件帳號與應用程式密碼，再測試連線及真實送達；測試期間 AUTH_EMAIL_ENABLED=false。
- Vercel 尚未連接，需配置 Production 的受限資料庫連線、session 密鑰、正式網址與公開 CA 後驗收線上帳密登入；本機設定不會隨 GitHub 推送同步。
