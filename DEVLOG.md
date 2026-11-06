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

### 問題與解法（Problems & Solutions）
- 從最近一次 Next.js 建置的 source map 還原 `src/lib/` 內五個缺少的模組。核對同批建置內的 API 與編輯器原始碼和工作目錄一致。
- 隔離環境通過 ESLint、正式建置與頁面和 SQLite 試用帳號檢查。資料表測試也已通過。
- 發現 `00001_init.sql` 編碼損壞且遺失 SQL 行。從資料表設計文件以 UTF-8 重建 migration，並用重建的檔案通過 32 項資料表與權限測試。
- 確認 Git 忽略 `.env`，並移除 `.env.local` 的同名設定，避免覆蓋 `.env`。

### 待辦事項（TODO）
- 將 `.env` 內的 Supabase URL 與金鑰換成 `greenproject` 的 Project URL 和 Publishable Key。
