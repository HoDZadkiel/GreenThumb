<h1 align="center">GreenThumb</h1>

<p align="center">討論各種植物種植技巧的論壇</p>

<p align="center">
  <img src="https://img.shields.io/badge/type-software-blue" alt="type: software" />
  <img src="https://img.shields.io/badge/status-WIP-orange" alt="status: WIP" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="license: MIT" />
</p>

<!-- 封面：docs/images/cover.png，放論壇首頁截圖 -->

## ✨ 規劃特色

- 🌱 依植物物種分類討論，點進物種頁就能看到所有相關文章
- 📷 發文、回覆都能附上照片，方便分享植株狀況
- 🗂️ 結構化照護卡：光照、澆水、介質、適溫一目了然
- 🗺️ 依台灣地區與氣候篩選種植經驗
- ✅ 發問文可以選出最佳解答，好答案不會被埋沒
- 📔 用種植日誌記錄同一株植物的成長過程

```mermaid
flowchart LR
  使用者 --> Next.js[Next.js on Vercel]
  Next.js --> DB[(PostgreSQL，目前由 Supabase 託管)]
  Next.js --> Auth[Better Auth + 帳密／Google 登入]
  Auth --> SMTP[Gmail SMTP 備援，預設關閉]
  Next.js --> Images[ImgBB 圖片外連]
```

## 🚀 快速開始

使用 Node.js 24 安裝依賴並啟動開發伺服器。

```sh
npm ci
npm run dev
```

依 [會員登入設定](docs/authentication.md) 在 `.env.local` 設定資料庫管理連線，確認後執行 `npm run db:setup-auth` 並重啟網站。既有帳密會員可直接登入，Google 登入另需 OAuth 憑證。在瀏覽器開啟 `http://localhost:3000`，網址需與 `BETTER_AUTH_URL` 一致。會員與 session 由網站管理，論壇內容透過受限帳號直接讀寫 PostgreSQL；目前可使用 Supabase 託管的資料庫，本機 SQLite 保留為切換前備份。

專欄頁 `/columns` 提供在地種植地圖，同時顯示達人專欄與選填位置的討論文章。發表討論時可選縣市與鄉鎮市區，也可以不公開位置；有選位置才會出現圖釘，之後可編輯或取消。地圖的「寫在地專欄」可發表專欄，圖釘只標示行政區代表位置。實作及資料來源見 [台灣達人地圖](docs/taiwan-expert-map.md)。

討論文章 `/discussions/[id]`、在地專欄 `/columns/community/[id]` 與編輯精選 `/columns/[slug]` 都有獨立閱讀頁，支援登入後回應、按讚／取消讚，以及複製固定網址分享。首頁精選、文章、互動、會員草稿與收藏都從 Supabase 讀寫，不混入示範文章或本機內容。

執行 `npm run db:push -- --dry-run` 預覽 migration，`npm run db:push` 套用，`npm run db:check` 檢查資料表及權限。`npm run test:auth` 在隔離 PostgreSQL 中驗證 Google OAuth、session、草稿、發表、收藏與互動；模擬 Google 回應且不寄信。`npm run test:supabase` 保留歷史 migration 回歸測試。真實 Google 登入與 Gmail 收件的驗收步驟見 [會員登入設定](docs/authentication.md)。

## 📁 專案結構

```
GreenThumb/
├── README.md
├── CLAUDE.md
├── LICENSE     # 授權條款
├── .gitignore  # 版控忽略規則
├── src/        # 程式碼本體
├── tests/      # 測試
├── docs/       # 設計文件、API 說明
├── scripts/    # 開發輔助腳本（build / release / 資料處理）
├── examples/   # 可執行的使用範例
└── .github/
```

## 🗺️ Roadmap

**目前階段**為網頁原型，會員、所有文章、編輯精選、會員草稿及收藏均使用 Supabase；網站只保留版型、操作文字與基本分類／行政區選項。登入後手動儲存的草稿與收藏可跨裝置讀取。

- [x] MVP 資料表設計（[`docs/database-schema.md`](docs/database-schema.md)）
- [ ] **MVP**：會員、發文（發問／分享／教學）、回覆、圖片上傳、物種與自由標籤、地區、按讚、最佳解答
- [ ] **第二階段**：照護卡、全文搜尋
- [ ] **第三階段**：種植日誌、AI 植物辨識／病蟲害判斷

## 📄 License

本專案採用 MIT 授權，全文見 [`LICENSE`](LICENSE)。

---

<sub>給 AI agent 的專案指示在 [`CLAUDE.md`](CLAUDE.md)。</sub>
