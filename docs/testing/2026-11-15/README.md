# Vercel 正式站功能與帳號隔離驗收

後續：[F01／F02 程式碼修正與回歸紀錄](fixes.md)；[修正部署後的 Vercel 複測](post-fix/README.md) 已通過 53 項 API 與 29 項瀏覽器檢查。本報告保留修正前的正式站實測結果。

- 測試日期：2026-11-15，Asia/Taipei。
- 唯一應用測試目標：<https://greenthumb-eta.vercel.app/>。沒有啟動或測試 self-host 網站。
- 身分：訪客及既有的一般會員 test01、test02、test03；另建立同會員的獨立 HTTP session 驗證跨 session 持久性。
- 方法：內建瀏覽器實際操作、畫面與 DOM 驗證，以及對相同 Vercel origin 的真實 HTTP 請求。沒有 mock 網站或以本機單元測試代替正式站驗收。
- 結論：**API 回歸 52/52 通過；瀏覽器帳號隔離未完全通過，有兩項可重現缺陷。**
- 本次只新增驗收腳本與測試紀錄，沒有修改或部署網站功能。

## 必須修正的隔離問題

### F01／P1：跨分頁切換帳號後，舊分頁會把前一會員的草稿存入新會員

實際重現：

1. 在分頁 A 以會員 01 登入，開啟 `/discussions/write`，儲存並重整還原私人草稿「QA-UI-20261115 會員隔離與植物日記」。
2. 開啟同一內建瀏覽器的分頁 B；確認同樣登入會員 01。
3. 在 B 登出，再登入會員 02。B 的新編輯頁起初為空白，確認伺服器沒有直接洩漏會員 01 的草稿。
4. 回到未重整的 A：仍顯示會員 01 的舊身分與原私人內容。按「儲存草稿」。
5. 重整 B：會員 02 的編輯頁出現會員 01 的完整草稿、字體字級與臺北市大安區設定，並顯示「雲端草稿已儲存」。

預期：帳號變更後，其他分頁應重新驗證身分；與草稿擁有者不符時，禁止儲存／發表並要求明確切換內容。

影響：同一瀏覽器的不同登入身分可能誤存或覆寫私人草稿。這項實測是舊分頁帶著舊內容，使用已切換成會員 02 的有效 cookie 發送寫入；直接以會員 02 的獨立 session 要求讀取會員 01 草稿仍遭隔離。不能據此宣稱任意遠端帳號能突破資料庫 RLS。

證據：

- [切換後仍停留在舊身分的分頁 A](06-stale-member01.jpg)；畫面中的 QA 暱稱是同次 API 測試為會員 01 暫設的暱稱，之後已還原。
- [會員 02 重整後讀到原會員 01 的內容](07-member02-received-member01-draft.jpg)。

本機原始碼提供的初步原因線索：

- `src/components/community/community-home.tsx:49` 的會員讀取 effect 依賴 `editId`，沒有在其他分頁登入／登出後重新同步身分。
- `src/components/community/use-cloud-draft.ts:33` 儲存時直接送出目前元件內容，沒有將預期的草稿擁有者與實際 session 再核對。
- 建議加入登入狀態跨分頁通知／焦點恢復時重新驗證；以會員 ID 隔離編輯器狀態，並在提交時驗證預期操作者與當前 session 一致。

### F02／P2：登出後仍顯示從雲端載入的私人草稿

實際重現：在分頁 B 以會員 02 載入上述已儲存草稿，再按頁首「登出」。頁首已變成「登入」、出現訪客撰寫提示，但標題、內文、行政區與已儲存狀態仍留在畫面。

預期：登出後清除從會員雲端讀取的私人草稿及其儲存狀態，避免在共用裝置暴露前一會員內容。

證據：[已登出但私人草稿仍可見](08-logged-out-draft-retained.jpg)。

本機原始碼線索：`src/components/community/use-cloud-draft.ts:16` 在沒有 user 時直接返回；`src/components/community/community-home.tsx:126` 只將 user 設為 null，沒有重設會員編輯內容。相同分頁繼續登入會員 03 時，畫面有重新讀取其空白草稿，這個後續動作正常。

## 功能覆蓋與結果

下表「通過」表示已實際完成該列流程；完整 API 斷言見 [api-results.json](api-results.json)。

| 功能／情境 | 瀏覽器操作 | 正式站 API | 結果 |
| --- | --- | --- | --- |
| 首頁、討論區、專欄、三篇編輯精選、獨立閱讀頁 | 實際導覽與閱讀 | 各頁 HTTP 與 metadata | 通過 |
| 三組測試帳號帳密登入 | 三帳號均完成表單登入 | 核對各自 ID 與一般會員 role | 通過 |
| 錯誤密碼與不存在帳號 | 錯誤密碼顯示一致的登入失敗提示 | 回應 401；密集嘗試另觀察到 429 | 通過 |
| session 持久性與登出 | 重整維持登入，登出恢復訪客 | 舊 cookie 失效，登出後寫入 401 | 通過 |
| cookie 與快取 | — | Secure、HttpOnly、SameSite=Lax、private/no-store | 通過 |
| 訪客發文、專欄、草稿、收藏、暱稱、互動限制 | 訪客按讚導向登入視窗 | 各寫入遭 401 拒絕 | 通過 |
| 公開帳密註冊關閉 | 登入視窗沒有帳密註冊入口 | sign-up/email 為 404 | 通過 |
| 跨來源登入及會員寫入 | — | 外站 Origin 被拒絕 403 | 通過 |
| 搜尋、分類、地區、排序、空狀態、清除篩選 | 實際操作並檢查結果 | — | 通過 |
| 精簡／摘要列表 | 實際切換 | — | 通過 |
| 發文必填、縣市與鄉鎮市區連動 | 必填與不完整地區提示 | 位置代碼、縣市錯配與欄位限制 | 通過 |
| 發問範本、七種 Markdown 工具 | 實際插入 | — | 通過 |
| 撰寫、對照、預覽、字體與字級 | 實際切換，確認渲染字體 | 格式欄位儲存讀回 | 通過 |
| HTML／javascript 連結安全 | 預覽中 script=0、危險 href=0；回覆無 script 節點 | 閱讀頁不輸出測試 script 標籤 | 通過本次測試樣本 |
| ImgBB 圖片插入與來源限制 | 非 ImgBB 拒絕，符合格式網址可插入 Markdown | 圖片網域、數量與欄位驗證 | 通過格式驗證；實際第三方上傳未驗收 |
| 討論與專欄雲端草稿 | 儲存後重整還原 | 三會員兩類草稿交錯讀取、更新與刪除隔離 | 通過一般流程 |
| 草稿同會員跨 session 還原 | — | 第二 session 讀回同一草稿 | 通過 |
| 草稿跨分頁切換會員 | 完整重現會員 01 → 02 誤存 | 單獨 session 隔離正常 | **失敗 F01** |
| 登出清除會員私人畫面 | 登出後仍保留原草稿 | session 已失效 | **失敗 F02** |
| 同分頁重新登入另一會員 | 登入會員 03 後載入其空白草稿 | 各帳號讀取自己的資料 | 通過 |
| 發表討論、獨立閱讀、作者編輯與位置取消 | 會員 03 完成新發表及修訂 | 會員 01、02 各自發表、修改、移動及取消位置 | 通過 |
| 發表專欄、預覽、作者編輯與改地區 | 會員 03 發表後從大安區改到信義區 | 兩會員各自發表與修改 | 通過 |
| 非作者編輯討論及專欄 | 會員 03 的兩種編輯頁顯示無權限 | 雙向交叉編輯回應 403，原內容不變 | 通過 |
| 冒用 authorId／userId、role | — | 作者取自 session；暱稱與草稿不修改指定的他人；role 保持 member | 通過 |
| 收藏、取消、重整與不同會員隔離 | 實際收藏、重整仍勾選、取消 | 冪等、跨 session、取消自己的收藏不影響他人 | 通過 |
| 文章按讚、回覆、分享 | 實際送出並顯示計數與成功提示，剪貼簿網址正確 | 討論／專欄／精選三類均測試 | 通過 |
| 個人按讚隔離與冪等 | — | 三帳號各自按讚／取消，數量不重複、不影響他人 | 通過 |
| 回覆作者與計數 | 顯示正確作者、回覆及計數 | 忽略偽造作者，計數與討論清單一致 | 通過 |
| 回覆載入更多 | 30 筆增加至 32 筆，載完按鈕消失 | 兩頁無重複，nextCursor 正確 | 通過 |
| 地圖搜尋、縣市、圖釘、閱讀連結、縮放、重設 | 討論與專欄圖釘均實際操作；新專欄更新至信義區 | 位置增改移除與無位置不落針 | 通過 |
| 非法 ID、游標、分頁、JSON、Content-Type、大小、方法 | 無權限頁與錯誤狀態有呈現 | 400／403／404／405／413／415 | 通過 |
| 不存在文章與專欄 | — | 顯示 not-found 並含 robots noindex | 通過 Next.js 串流規則 |
| 手機 390×844：首頁、專欄與地圖 | 三頁均檢查無水平溢出並截圖 | — | 通過所測尺寸 |
| 社群說明對話框 | 開啟、閱讀、關閉 | — | 通過 |

## 其他觀察與驗收限制

- 失效 ImgBB 連結會插入為圖片，但只出現破圖；本次 DOM 確認 `complete=true`、`naturalWidth=0`，沒有看到說明錯誤的替代畫面。屬低優先度體驗改善，見 [失效圖片預覽](05-discussion-preview.jpg)。正常有效的第三方圖片載入及 ImgBB 真正上傳沒有驗收。
- 正式站的登入設定回報帳密登入已啟用，Google 與 Email 驗證碼停用。Google 按鈕停用，Email 驗證碼入口隱藏；沒有真實 Google OAuth 或 SMTP 收件驗收，也沒有寄信。
- 本次只有一般會員，沒有管理員／版主測試帳號；不宣稱管理功能已通過。
- README 規劃中的照護卡、種植日誌、AI 識別、最佳解答等未開放功能不列為已通過。
- 已測回覆 30 筆的下一頁；沒有在正式站大量建立 51／201 篇內容來測試討論、地圖及專欄的資料量門檻，也沒有做負載測試或完整無障礙稽核。
- 手機版以內建瀏覽器 viewport 驗收，沒有替代真實 iOS／Android 裝置驗收。
- 網站沒有刪文 UI/API。只有測試結束的 fixture 清理由既有資料庫管理連線完成；各項功能斷言及清理後還原驗證仍全部透過 Vercel 網站。沒有變更 schema、RLS、帳密或帳號權限。
- 初次腳本有三項斷言需校正：密集登入的 429 視為拒絕；省略位置欄位測試不得自行帶入空字串；Next.js 串流後 `notFound()` 可保持 HTTP 200 並注入 noindex。已依本機 `next@16.4.3` 隨附 `not-found.md` 的規則複測，52 組最終均通過。原始失敗與複測紀錄保留於 [api-rechecks.json](api-rechecks.json)，沒有修改網站來消除測試結果。

## 清理與還原

- 已移除本次新增的 3 篇討論、3 篇專欄、35 則回覆與 2 份測試私人草稿；相關測試文章的按讚／收藏依外鍵一併清除。
- 以實際記錄的 ID、作者與 QA 標記核對後才清除。沒有刪除測試帳號或既有文章。
- 以三帳號重新登入 Vercel 確認原暱稱、member 權限、兩類原草稿皆還原，收藏不含本次測試文章；驗證 session 全部登出。
- 原有兩篇討論與三篇編輯精選保留；本次測試文章 API 均回應 404。
- 內建瀏覽器保留登出的正式站首頁，顯示原有兩篇討論、沒有 QA 文章。
- 詳細證據：[cleanup-results.json](cleanup-results.json)、[restoration-verification.json](restoration-verification.json)、[清理後首頁](15-clean-home.jpg)。

## 截圖

| 檔案 | 內容 |
| --- | --- |
| [01-home.jpg](01-home.jpg) | 首頁、既有內容與會員登入 |
| [02-map.jpg](02-map.jpg) | 討論地圖圖釘 |
| [03-mobile-editorial.jpg](03-mobile-editorial.jpg) | 手機精選閱讀頁 |
| [04-mobile-home.jpg](04-mobile-home.jpg) | 手機首頁 |
| [05-discussion-preview.jpg](05-discussion-preview.jpg) | 預覽與失效圖片觀察 |
| [06-stale-member01.jpg](06-stale-member01.jpg) | 跨分頁切換後舊身分未更新 |
| [07-member02-received-member01-draft.jpg](07-member02-received-member01-draft.jpg) | 新會員讀回舊會員內容，F01 |
| [08-logged-out-draft-retained.jpg](08-logged-out-draft-retained.jpg) | 登出後仍保留私人草稿，F02 |
| [09-discussion-preview-valid.jpg](09-discussion-preview-valid.jpg) | 完整 Markdown 預覽 |
| [10-published-discussion.jpg](10-published-discussion.jpg) | 發表、按讚、回覆與分享 |
| [11-foreign-edit-denied.jpg](11-foreign-edit-denied.jpg) | 非作者編輯討論遭拒 |
| [12-published-column.jpg](12-published-column.jpg) | 已發表的在地專欄 |
| [13-updated-column-map.jpg](13-updated-column-map.jpg) | 專欄改位置後圖釘更新 |
| [14-mobile-map.jpg](14-mobile-map.jpg) | 手機地圖 |
| [15-clean-home.jpg](15-clean-home.jpg) | 清理後的訪客首頁 |

## 重跑方式

腳本需要 Git 忽略的 `.local/test-accounts.json`；原帳密與草稿備份不放入報告。清理還需要專案原有資料庫管理設定。

```sh
node scripts/test-vercel-regression.mjs
# 必須在仍保有該次 fixture 的情況下做必要複測：
node scripts/recheck-vercel-regression.mjs
# 瀏覽器若另建立 fixture，先明確記錄於 .local/vercel-ui-fixtures.json。
node scripts/cleanup-vercel-regression.mjs
node scripts/verify-vercel-cleanup.mjs
```

這些腳本是本次正式站驗收工具，會建立公開 QA 測試內容；清理只限該次明確記錄的 fixture。瀏覽器缺陷的完整重現仍依 F01／F02 步驟進行。
