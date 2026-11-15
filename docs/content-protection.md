# 公開內容的基本讀取防護

## 公開文章識別碼

- 討論使用 `posts.public_id` 的隨機 UUID；既有文章由 migration `00007_public_post_ids.sql` 自動補值，新文由 PostgreSQL `gen_random_uuid()` 產生。
- 原 bigint 主鍵與所有外鍵不變；作者、收藏、回應及按讚無須重建。會員的欄位權限不包含 `public_id`，不能自選流水識別碼或變更已發布網址。
- 閱讀、編輯、互動、收藏、地圖與清單游標均使用公開 UUID；API 不輸出文章內部流水號。回應的分頁編號只在已知文章內使用，不能用來查詢任意文章。
- **舊的 `/discussions/8` 這類數字網址停止提供文章，也不轉址到 UUID。** 保留轉址會使逐號列舉仍然有效。舊外部連結需改從首頁尋找文章並重新分享；資料庫內的既有收藏仍會轉換成正確公開識別碼。
- 清單最多 50 篇，只回傳每篇前 180 字摘要，不再整批傳回完整內文；編輯器另外要求指定文章的完整資料。

## 共用讀取限流

- Next.js Proxy 在執行內容查詢前檢查 GET／HEAD，包括 HTML、RSC／預先載入、討論 API、相容 API、專欄、地圖與回應 API。
- 同一來源共用每分鐘 90 次內容讀取額度，其中列表最多 30 次。切換文章 ID、路由、會員 cookie 或 User-Agent 都不建立新額度。
- 計數使用現有 `gt_rate_limit` 與 PostgreSQL 原子 upsert，多個 Vercel 執行個體共用；沒有僅存於單一程序的 Map，也不新增外部服務。
- Proxy 每次檢查只開一條連線，並在返回網站前於 finally 關閉；不將連線留在可能暫停的 Proxy 執行個體。這避免目前小型 session pool 被閒置連線占滿。
- 一般 API／文章共用池上限為 1、閒置逾 1 秒釋放，使用 Vercel 官方 `attachDatabasePool`；交易 promise 也掛入請求生命週期，避免 RSC／預載請求取消時留下未完成的讀取交易。僅對開始交易前的 session pool 額度拒絕，進行最多三次短暫退避；不重送 SQL 或可能已提交的寫入。參考 [Vercel 連線管理文件](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package#attachdatabasepool)。
- 超限回應 429、`Retry-After`、`private, no-store` 及 noindex。計數儲存不可用時回應 503 與重試提示，避免悄悄解除防護。
- 使用固定的一分鐘視窗；在視窗邊界可能出現雙倍短時突發。這是基本節流，並非滑動視窗流量防火牆。
- 只在 `VERCEL=1` 的執行環境信任 Vercel 注入的 `x-vercel-forwarded-for`，不採用瀏覽器自填的通用 forwarded header。平台標頭說明見 [Vercel 官方文件](https://vercel.com/docs/headers/request-headers#x-vercel-forwarded-for)。
- 使用既有 `BETTER_AUTH_SECRET` 對來源做 HMAC，計數表不寫入原始 IP。未識別來源與非 Vercel 部署共用保守的 fallback 額度；搬遷平台時必須另行設計可信 proxy 邊界。
- 逾一天未使用的 content 計數會在後續請求時分批清除，每次最多 100 筆，不清理登入限流紀錄。實際儲存時間取決於後續流量，沒有另設排程。
- 登入／登出、發文與靜態資產不受這個讀取額度限制，登入本身保留既有獨立限流。未將 User-Agent 冒充 Googlebot 作為白名單。

## 部署順序

1. 先執行 `npm run db:push -- --dry-run`，確認待套用的是 `00007_public_post_ids.sql`。
2. 套用 migration，再部署新版程式。新增欄位相容既有程式，不變更 RLS 或會員權限。
3. Vercel 保留既有 `APP_DATABASE_URL`、`BETTER_AUTH_SECRET`，並確認系統環境變數 `VERCEL=1` 有提供。無須新增金鑰或 Redis。
4. 在指定 Vercel 網站檢查首頁 UUID 連結、舊數字網址不再提供內容、完整閱讀、作者編輯、收藏、按讚、回應及地圖；測試超量時應見 429 與 Retry-After。
5. 若回滾程式，保留新增欄位即可；舊版會重新公開數字網址，因此會一併失去非流水識別碼防護。

## 索引與限制

- robots.txt 請合作型爬蟲略過 API、登入回呼與編輯頁；公開文章仍允許正常搜尋索引。API 另回應 X-Robots-Tag: noindex。
- UUID 能阻止有效的逐號猜測，**不會讓公開文章變成私密資料**。首頁與地圖上的連結仍可跟隨；慢速或分散式爬蟲仍可能收集公開內容。
- robots.txt 不是強制存取控制。若之後需要抵禦代理池、分散式爬取或大量流量，應另設定 Vercel 邊界防火牆／機器人挑戰，避免所有惡意流量先進入應用與資料庫。
- 共享出口的公司、校園或行動網路可能共用讀取額度；正常使用若誤觸，可依觀測調整額度。這次沒有把所有文章改成必須登入，也沒有 CAPTCHA 阻擋一般閱讀。
