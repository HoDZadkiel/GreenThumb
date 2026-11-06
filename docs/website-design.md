# GreenThumb 網站設計

- 方向：以台灣植物同好交流為核心，結合論壇的閱讀效率與植物生活雜誌的留白。
- 視覺以米白、森林綠和陶土橘為主。介面採 Noto Sans TC，主視覺和專欄大標題採 Noto Serif TC。
- 首頁：品牌導覽、植物主視覺、討論搜尋與分類、地區篩選、植物探索、當季照護筆記、分享入口。
- 響應式：桌機雙欄，手機單欄；分類列可橫向捲動。
- 互動：即時搜尋、最新／熱門排序、分類與地區組合篩選、收藏狀態、文章預覽、本機草稿儲存與還原。
- 網頁試用的會員與發表文章儲存在 SQLite。收藏保留於當次頁面，草稿保留於目前瀏覽器。
- 架構：保留 Next.js App Router；首頁由伺服器路由載入互動元件，後續沿用 Vercel 與 Supabase。

## 頁面分工

| 頁面 | 版面與功能 |
|---|---|
| `/` | 植物主視覺、編輯精選、社群討論與植物探索 |
| `/columns` | 專欄封面、精選文章、文章卡片及通往討論區的側欄 |
| `/columns/[slug]` | 獨立網址與閱讀欄寬，每篇文章各有標題與摘要 |
| `/discussions` | 討論入口、搜尋、植物分類、地區篩選、排序與 ImgBB 草稿 |

三個主要頁面共用導覽與發文入口。發文與修改文章使用獨立的 `/discussions/write` 頁面。

網頁試用可執行 `npm run dev` 後進入討論區。點「發起討論」後登入並填寫標題、分類與內文。桌機可邊寫邊看預覽，手機可切換撰寫與預覽。發表前可選擇正文的字體和字級，並在游標處插入 ImgBB 直連。

未來的贊助連結與店家網站可放在首頁精選下方，或放在專欄的獨立側欄卡片。手機版將卡片排在主要內容後。上線時以「贊助」或「合作店家」標示，卡片使用店名、簡介和外部連結，與編輯內容分開呈現。

## 發文編輯器與字體

| 選項 | 評估 |
|---|---|
| `@uiw/react-md-editor` | React 即用工具列及預覽，適合希望快速採用完整編輯介面的方案。[官方儲存庫](https://github.com/uiwjs/react-md-editor) |
| `react-markdown` 加 `remark-gfm` | 已採用。保留既有表單與 ImgBB 流程，原生文字欄提供格式按鈕，預覽和閱讀共用渲染元件，支援 GFM 表格和任務清單。[react-markdown 官方儲存庫](https://github.com/remarkjs/react-markdown) |
| Noto Sans TC | 全站介面、按鈕及文章預設字體。黑體適合快速掃讀問題和清單。[Noto 官方字樣](https://notofonts.github.io/noto-docs/specimen/NotoSansCJKtc/) |
| Noto Serif TC | 主視覺和專欄大標題，也可用於種植筆記等長篇正文。[Noto 官方字樣](https://notofonts.github.io/noto-docs/specimen/NotoSerifCJKtc/) |
| 系統字體 | 蘋方、微軟正黑體等用於字型尚未載入或缺字時，字面會因平台而異。 |

字型由網站提供 Unicode 分段的 WOFF2。文章保留 Markdown 原文、正文字體與小／標準／大三種字級的設定。渲染停用原始 HTML，內文插圖限 ImgBB 直連。

## 主視覺

- 工具：內建 imagegen。
- 檔案：`public/images/plant-studio.png`。
- 生成提示：

> Use case: photorealistic-natural. Asset type: hero photograph for GreenThumb, a Taiwanese plant growing community website. Wide landscape editorial photograph, ratio 3:2. A quiet sunny plant studio: large sculptural deep green Monstera deliciosa with naturally fenestrated leaves in an earthy pale terracotta pot, a small delicate fern and a few plants beside it, an aged light oak table, warm ivory limewash wall, subtle leaf shadows, natural morning sunlight from upper left. Composition: foliage dominates right two thirds, warm textured wall and a small leaf on left, close framing of expressive green leaves, sophisticated Kinfolk gardening magazine photography, tactile analog film grain, muted warm olive greens and creamy neutrals. No people, no letters, no text, no logos, no borders, no collage, no watermark.
