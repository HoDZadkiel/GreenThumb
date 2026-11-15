# Vercel 修正後完整回歸驗收

- 日期：2026-11-15，Asia/Taipei；JSON 時間戳使用 UTC。
- 應用測試唯一目標：[GreenThumb 正式站](https://greenthumb-eta.vercel.app/)。未啟動或測試 self-host。
- 已部署修正：[`5e42ad7`](https://github.com/HoDZadkiel/GreenThumb/commit/5e42ad7fc9c803cd2236b75bcd04b9cb140be8ce)。GitHub 的 Vercel status 為 success，正式站也已回應新版 `ownerId` 格式，見 [deployment.json](deployment.json)。
- 身分：訪客及既有 test01、test02、test03 三組一般會員。帳密與 session 不列入報告。
- 結果：**53/53 項正式站 API 回歸、29/29 項瀏覽器檢查通過，F01 與 F02 的正式站複測均通過。**
- 瀏覽器兩分頁的警告／錯誤紀錄均為空，見 [browser-console.json](browser-console.json)。這不代表已涵蓋所有裝置與執行時序。

## 帳號隔離缺陷複測

### F01：跨分頁切換會員後誤存前一會員草稿

1. 會員 01 分別儲存討論與專欄私人草稿，重新載入後確認雲端還原；討論另保留未送出的圖片網址與地點設定。
2. 討論分頁先導覽到首頁，讓編輯器留在 Next.js 路由快取。另一分頁登出會員 01，再登入會員 02。
3. 第一分頁的頁首同步為會員 02。返回快取中的討論編輯頁後，標題、內文及圖片網址均為空，行政區與字體也已重設；專欄同樣沒有帶入會員 01 內容。
4. 會員 02 自行撰寫並儲存討論草稿，重整只還原自己的 `MEMBER02_ONLY` 內容。
5. 另以獨立 HTTP session 讀取正式站：會員 01 兩類草稿仍為其原內容；會員 02 僅有自己的討論草稿，專欄為空。見 [ui-isolation-api.json](ui-isolation-api.json)。
6. API 回歸另以新會員有效 cookie 搭配舊會員或缺少的 `expectedUserId`，驗證草稿儲存／刪除、發表、收藏、暱稱與互動寫入均遭 409 拒絕，且新會員資料不變。

結果：**通過**。伺服器隔離與跨分頁／返回快取頁面的畫面隔離均有實測證據。

| 證據 | 說明 |
| --- | --- |
| [會員 01 討論原稿](09-member01-discussion-before-switch.jpg) | 切換前的私人標題、內文與所在地 |
| [會員 01 專欄原稿](10-member01-column-before-switch.jpg) | 專欄草稿已從雲端還原 |
| [會員 02 專欄](12-member02-column-isolated.jpg) | 沒有帶入會員 01 草稿 |
| [會員 02 返回快取討論頁](13-member02-cached-discussion-cleared.jpg) | 頁首會員正確，私人欄位為空 |
| [會員 02 自己的草稿](14-member02-own-draft.jpg) | 新撰寫內容可正常儲存並還原 |

### F02：登出後仍顯示私人內容

- 討論：載入會員草稿並補入未送出的圖片網址、切換預覽後登出。標題、內文、圖片網址及已儲存狀態清除，回到撰寫模式。
- 專欄：從雲端還原會員 01 私人草稿後登出。三個文字欄位及已儲存狀態均清除。
- 回應：會員 03 輸入尚未送出的私人回應後登出。輸入框清空，入口變為「登入參與回應」，另一分頁也同步為訪客。
- 訪客首次登入仍保留其剛寫下、尚未儲存的內容；同會員重整仍正常還原自己的雲端草稿。

結果：**通過**。證據：[討論登出清除](15-discussion-logout-cleared.jpg)、[專欄登出清除](11-column-logout-cleared.jpg)、[回應登出清除](19-logged-out-reply-cleared.jpg)、[訪客首次登入保留內容](08-guest-content-preserved.jpg)。

## 功能覆蓋

下表為本輪已完成的實際檢查；逐項結果見 [API 原始紀錄](api-results.json) 與 [瀏覽器原始紀錄](ui-results.json)。一項紀錄可能包含多個斷言，項目數不代表請求數。

| 範圍 | 本輪實測與結果 |
| --- | --- |
| 導覽與閱讀 | 首頁、討論、專欄、編輯精選、獨立閱讀頁與分享網址正常；公開頁、SEO 與不存在內容的 noindex 經 API 驗證 |
| 登入／登出 | 三組帳密、同會員跨 session、重整持久性、舊 cookie 登出失效、錯誤登入、註冊關閉與登入限流正常 |
| 會員保護 | cookie 安全屬性、private/no-store、訪客寫入 401、跨來源 403、舊操作者寫入 409 正常 |
| 搜尋與列表 | 關鍵字、植物分類、地區、最新／熱門／最多回覆、摘要／精簡、空狀態與清除篩選正常 |
| 撰寫工具 | 必填、不完整位置提示、範本、七種 Markdown 工具、字體字級、撰寫／對照／預覽正常 |
| 輸入安全 | 本次 script／危險連結樣本未產生可執行節點；非 ImgBB 來源被拒絕；JSON、Content-Type、大小與欄位限制正常 |
| 私人草稿 | 三會員兩類草稿交錯儲存、更新、刪除、跨 session 讀回隔離；瀏覽器 F01／F02 與首次登入情境均通過 |
| 發表與編輯 | 三會員透過 API 或表單發表；自己的討論與專欄可修訂，其他會員直接開編輯網址遭拒絕，API 雙向越權 403 且原內容不變 |
| 地圖 | 搜尋、縣市、圖釘、閱讀連結、縮放、重設、編輯移動位置及取消位置正常；UI 專欄由大安區改至信義區，討論取消位置後不再落針 |
| 收藏與暱稱 | 收藏／取消、重整還原、冪等及各會員隔離正常；暱稱跨 session 與冒用 ID 不影響他人經 API 驗證 |
| 互動 | 討論、會員專欄、編輯精選三類按讚、回覆作者與計數、個人按讚隔離正常；瀏覽器分享與送出回應正常 |
| 回應分頁 | 瀏覽器初始 30 則，載入更多後 32 則且按鈕消失；API 游標續讀無重複 |
| 響應式 | 390×844 的首頁、精選閱讀與地圖均未出現整頁水平溢出；保留手機截圖 |

## 資料清理與還原

- 本次 API 標記：`QA-20261115-76813346`；UI 標記：`QA-UI-20261115-postfix-updjib`。
- 按 fixture ID、測試作者與 QA 標記核對後，清除 **3 篇討論、3 篇專欄、35 則回覆及 3 份測試私人草稿**。關聯的測試互動隨文章清除，沒有刪除測試帳號、調整 schema 或關閉 RLS。
- 網站沒有文章刪除介面，因此僅清理階段使用資料庫連線；所有功能與隔離斷言仍使用 Vercel 網站／API。
- 清理後重新透過 Vercel 登入三帳號，核對原暱稱、member 權限、兩類原草稿及無測試收藏；六個 fixture 的 API 均為 404。見 [cleanup-results.json](cleanup-results.json) 與 [restoration-verification.json](restoration-verification.json)。
- 既有討論 3、8 與精選文章保留；本次測試 session 已登出。瀏覽器重整首頁後只顯示原有兩篇討論。

## 本次檔案變更與驗證

- 三支測試／清理腳本支援 `GREENTHUMB_TEST_OUTPUT`、`GREENTHUMB_TEST_STATE`，UI 清理另支援 `GREENTHUMB_TEST_UI`，讓本輪證據與修正前證據分開保存。未修改網站功能。
- 三支腳本的 `node --check` 與 ESLint 均通過。
- [修正前報告](../README.md) 與其原始證據保留，原來的失敗不是本輪結果；[程式碼修正紀錄](../fixes.md) 另保留當時的單元／整合／建置檢查。

## 驗收限制

- 正式站 Google 與 Email OTP／SMTP 未啟用，本輪只核對入口狀態，未宣稱真實 OAuth 或郵件送達通過。
- 使用一般會員帳號，未驗收管理員／版主專用操作；沒有壓力、大資料量、多瀏覽器或真實行動裝置測試。
- ImgBB 驗證涵蓋來源限制與文章資料讀回，未進行第三方實際照片上傳；修正前報告的失效圖片友善提示觀察仍保留。
- 本輪通過表示上述已執行情境沒有再現缺陷，不代表任何時序或安全攻擊均已窮盡。

## 其他畫面證據

- [首頁](01-home.jpg)、[圖釘](02-map-pin.jpg)、[手機地圖](03-mobile-map.jpg)、[手機精選](04-mobile-editorial.jpg)、[訪客登入限制](05-guest-login-gate.jpg)、[手機首頁](06-mobile-home.jpg)。
- [安全預覽](07-guest-preview.jpg)、[專欄發表](16-published-column.jpg)、[討論互動](17-published-discussion-interactions.jpg)、[修改後地圖](18-edited-column-map.jpg)。
