# CLAUDE.md — GreenThumb

本檔給進入這個專案的 AI agent 看，**內容自足，不依賴任何特定機器上的設定**。執行環境若另有全域指示，那是額外的；照本檔做就能正確參與這個專案。

## 專案目標

討論各種植物種植技巧的論壇

一句話不夠時補在這裡：種植技巧散落在 FB 社團與 Discord，難以被搜尋與累積。GreenThumb 要做成可被 Google 搜到的長期知識庫，並提供植物專屬功能（物種標籤、照護卡、地區篩選、種植日誌）。初期使用 Vercel + Supabase 的免費方案起步。

## 專案性質與技術棧

| 項目 | 內容 |
|------|------|
| 類型 | `software`（純軟體） |
| 技術棧 | Next.js (App Router) + Supabase (PostgreSQL/Auth/Storage)，部署於 Vercel |
| 建立日期 | 2026-10-31 |

## 資料夾用途

```
GreenThumb/
├── README.md
├── CLAUDE.md
├── LICENSE         # 授權條款
├── .gitignore      # 版控忽略規則
├── src/            # 程式碼本體
├── tests/          # 測試
├── docs/           # 設計文件、API 說明
│   └── images/     # 文件用圖
├── scripts/        # 開發輔助腳本（build / release / 資料處理）
├── examples/       # 可執行的使用範例
└── .github/
    └── workflows/  # CI 設定
```

寫東西前先確認要寫進哪個目錄。不確定就問，不要自己開新的頂層目錄。

## 開發約定

- Next.js 專案放在 `src/`；資料庫 migration 與 RLS policy 用 Supabase CLI 管理
- 資料庫維持標準 PostgreSQL 寫法，避免綁死 Supabase 專有功能，以便日後搬遷
- 上傳的圖片一律先壓縮、轉成 WebP 並限制尺寸，控制儲存空間與流量
- 頁面以 SSR／SSG 為主，以利 SEO
- 分支策略：`main` 為可部署版本，功能開在 `feat/*` 分支

## 版控

本專案使用 git 版控。push 前逐項確認：`.gitignore` 涵蓋完整、`.env` 與金鑰檔未被追蹤、程式碼與文件內沒有 token／密碼／連線字串／硬編碼 IP、README 沒有過期、沒有誤加大型二進位檔。

## 禁止事項

- 不得把 Supabase `service_role` key、資料庫連線字串寫進程式碼或提交進版控；機密一律放 `.env.local`
- 不得關閉資料表的 RLS（Row Level Security）
- 不得在前端直接信任使用者輸入；發文內容需經過消毒，避免 XSS

## 變更紀錄

每次涉及檔案修改、除錯或決策的對話結束前，把工作記錄追加到專案根目錄的 `DEVLOG.md`（不存在就建立）。純唯讀的問答可略過。

格式如下 —— 用當天日期當標題，當天已有記錄就往其下追加，不重複建標題：

```markdown
## YYYY-MM-DD

### 修改內容（Changes）
- 改了哪些檔案、做了什麼

### 問題與解法（Problems & Solutions）
- 遇到的障礙與最終採用的解法

### 待辦事項（TODO）
- 未完成或需要後續跟進的事項
```

只寫條列，不寫段落。
