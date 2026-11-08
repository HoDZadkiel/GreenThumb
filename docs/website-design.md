# GreenThumb 網站設計

- 方向：以台灣植物同好交流為核心，結合論壇的閱讀效率與植物生活雜誌的留白。
- 視覺以米白、森林綠和陶土橘為主。介面採 Noto Sans TC，主視覺和專欄大標題採 Noto Serif TC。
- 首頁：上半部為種植專欄（圖文精選與兩篇文章入口），下半部為植物討論區，含看板導覽、搜尋與列表、地區篩選、社群入口和當季照護筆記。
- 響應式：寬桌機三欄（看板／討論／社群資訊），中型螢幕雙欄，手機單欄；手機的看板分類列可橫向捲動。
- 互動：即時搜尋、最新／熱門排序、分類與地區組合篩選、收藏狀態、文章預覽、本機草稿儲存與還原。
- 網頁試用的會員與發表文章儲存在 SQLite。收藏保留於當次頁面，草稿保留於目前瀏覽器。
- 架構：保留 Next.js App Router；首頁由伺服器路由載入互動元件，後續沿用 Vercel 與 Supabase。

## 頁面分工

| 頁面 | 版面與功能 |
|---|---|
| `/` | 上半部為專欄精選，下半部為看板導覽、社群討論與植物探索 |
| `/columns` | 台灣達人地圖、縣市與關鍵字篩選、在地專欄列表，下方保留編輯精選 |
| `/columns/[slug]` | 獨立網址與閱讀欄寬，每篇文章各有標題與摘要 |
| `/columns/write` | 縣市與鄉鎮市區、專欄標題與簡介、Markdown 內文、預覽、本機草稿與會員發表；以 `?edit=` 修改自己的專欄 |
| `/columns/community/[id]` | 會員專欄閱讀、作者及所在地，作者與管理員可編輯 |
| `/discussions` | 看板導覽、搜尋、分類與地區篩選、最新／熱門／最多回覆排序、精簡／摘要列表 |
| `/discussions/write` | 看板、標題、Markdown 內文、圖片、預覽／對照、本機草稿與會員發表 |

頁首保留品牌、登入與發文入口，移除「首頁／討論區／專欄」三個分頁。點品牌可回首頁，專欄區的「所有專欄」通往專欄列表，首頁下方可直接瀏覽討論。發文與修改文章使用獨立的 `/discussions/write` 頁面。

網頁試用可執行 `npm run dev` 後進入討論區。點「發表文章」後可先撰寫與儲存本機草稿，發表時再登入；登入對話框不會卸載編輯器。從特定看板進入時，以 `?board=` 帶入分類；若已有本機草稿，優先還原草稿。預設為寬版撰寫區，支援預覽與對照；手機對照為上下排列。發表前可選擇正文字體和字級，並在游標處插入 ImgBB 直連。頁面底部固定提供草稿與發表操作。

## 台灣達人地圖

- 專欄頁上方以台灣地圖搭配專欄列表，手機改為地圖在上、列表在下。點圖釘或列表可查看地點與閱讀入口。
- 發表時選擇「縣市＋鄉鎮市區」，以區域代表位置落針；支援全台 22 縣市、368 鄉鎮市區與離島。修改所在地會移動原有專欄圖釘。
- 使用 Leaflet 與 MarkerCluster；相近圖釘顯示數字，放大後可展開，同點專欄可散開選取。地圖延後在瀏覽器載入，卡片分批顯示。
- 未有真實專欄時呈現空狀態，可主動選擇「體驗示範圖釘」。示範位置有明確標示，不當作現有編輯文章的作者所在地。
- 沿用本機會員與 SQLite 試用，作者身分及編輯權限由伺服器驗證。正式環境資料庫與容量規劃見 [台灣達人地圖實作](taiwan-expert-map.md)。

## 台灣論壇參考（2026-11-07）

使用內建瀏覽器查看公開首頁、看板與發文入口，並在使用者協助登入後查看巴哈姆特新版發文頁及伊莉園藝交流發文頁。以下為實際介面觀察，不代表流量排名或功能完整測試。

| 參考頁 | 觀察到的設計 | GreenThumb 採用方式 |
|---|---|---|
| [JKF 閒聊版](https://jkforum.net/forum-374-1.html) | 左側導覽、看板名稱、內容分頁與分類、作者及回覆資訊、右側社群資訊 | 看板與討論固定分區，標題和互動數字集中，保留綠色品牌 |
| [巴哈姆特文章列表](https://forum.gamer.com.tw/B.php?bsn=60030) | 子板入口、縮圖／清單切換、置頂區、排序與互動欄 | 精簡／摘要列表與最多回覆排序；目前沒有置頂資料，未製造假公告 |
| [巴哈姆特新版發文頁](https://forum.gamer.com.tw/post/60030) | 分類先於標題，集中格式工具、預覽、備份狀態與發表，提供範本 | 看板 → 標題 → 內文；圖示格式工具、字體與字級、三種編輯模式、手動草稿狀態、發問範本及固定操作列 |
| [伊莉園藝交流](https://www54.eyny.com/forum-499-1.html)及[發文頁](https://www54.eyny.com/forum.php?mod=post&action=newthread&fid=499) | 階層麵包屑、植物分類、密集主題列表；分類與標題位於工具列前、大面積內文、圖片工具展開上傳／網絡圖片面板、保存數據與草稿 | 加入麵包屑、分類入口和討論數量；保留寬版內文、按需展開圖片工具、明確的草稿操作與字數限制 |

- 保留既有 Markdown 渲染與 ImgBB 白名單，沒有改成所見即所得編輯器。
- 發問範本只在空白內文時啟用，避免覆蓋已寫內容；未加入尚無資料支援的會員排行或公告。
- 草稿由使用者手動儲存在目前瀏覽器，未宣稱自動備份或跨裝置同步。

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
