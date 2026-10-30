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
- 尚未初始化 Next.js 與 Supabase 工具鏈
- `tests/schema.test.mjs` 需要 `@electric-sql/pglite`，等建立 package.json 後再加進 devDependencies
- 尚未設定 Storage bucket policy（路徑 `{user_id}/{uuid}.webp`）
- 自由標籤可能出現同義詞，之後需要合併機制
