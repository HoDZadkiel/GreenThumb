# 會員登入：帳密、Google 與 Gmail SMTP

會員驗證由網站內的 Better Auth 管理，資料直接存 PostgreSQL。目前可使用 Supabase 的 PostgreSQL；網站不再呼叫 Supabase Auth 或 Data API。日後搬到其他 PostgreSQL 時，會員 UUID、外部身分與 session 資料一起搬移。

## 目前狀態與上線順序

- 帳密登入：已開放既有會員使用 Email／密碼登入，預設 `AUTH_PASSWORD_ENABLED=true`。密碼由 Better Auth 驗證資料庫內的雜湊，不需要 Google 或 SMTP 憑證。
- Google 登入：第一次登入建立會員。
- 次要入口：Gmail SMTP 寄六位數登入碼，預設 `AUTH_EMAIL_ENABLED=false`，測試期間先使用 Google。
- Google 姓名存在驗證資料內，公開個人資料預設顯示「新會員」；首次登入可選擇暱稱，也可點頁首暱稱修改。
- Google 使用獨立視窗登入，原頁面保留尚未儲存的編輯內容。瀏覽器需允許登入視窗；同一瀏覽器的不同登入不能同時進行。
- 登入完成後，原頁面每兩秒確認自己的 session，最多等候五分鐘。完成頁也會確認真實 session。
- 本機整合測試使用產生的 RSA 金鑰、模擬 Google HTTP 回應與隔離 PostgreSQL，不使用真實 Google 帳號、不寄信。
- 真實 Google／Gmail 驗收需要專案擁有者設定下列憑證。

## 既有會員帳密登入

在網站點「登入」，輸入帳號的 **Email** 與密碼，再按「帳密登入」。目前三組資料庫測試帳號的原始帳密存放於 Git 忽略的 `.local/test-accounts.json`；請使用其中的 `email`／`password` 欄位。

帳密入口僅登入資料庫中已具有 `credential` 密碼紀錄的會員，不提供公開帳密註冊。原有 Supabase Auth 的密碼沒有移入新系統；只有舊 email、沒有密碼紀錄的會員，需另行建立密碼或使用已設定的其他登入方式。

錯誤的信箱與密碼使用相同失敗提示。登入會建立網站自己的 HttpOnly session cookie，並以資料庫限制每個來源的登入嘗試次數；不會自動合併 Google 身分。若要停用帳密入口，設定 `AUTH_PASSWORD_ENABLED=false` 後重啟網站。

## 一、準備資料庫

將管理用 `DATABASE_URL` 留在 `.env.local`；網站部署只需要受限的 `APP_DATABASE_URL`。

```sh
npm run db:push -- --dry-run
npm run db:setup-auth
npm run db:check
```

`db:setup-auth` 會套用 migration、建立 `greenthumb_app` 的登入憑證，並把受限連線與隨機 `BETTER_AUTH_SECRET` 寫入被 Git 忽略的 `.env.local`。它會變更現有資料庫的會員外鍵及 RLS 身分來源，應在確認遷移範圍後執行。

`00006_portable_auth.sql` 的變更：

- 建立 `gt_user`、`gt_account`、`gt_session`、`gt_verification`、`gt_rate_limit`。
- 從既有 `auth.users` 複製會員 UUID 與 email，保留文章／專欄／草稿／收藏的歸屬。無 email 的舊會員會阻止整筆遷移，需先處理。
- `profiles.id` 改為參照 `gt_user.id`；原 Supabase Auth 資料保留，不刪除。
- 權限政策與 trigger 的 `auth.uid()` 改為 `public.current_member_id()`，所有資料表維持 RLS。
- 私有登入資料不授權給 `anon`／`authenticated`，只有網站執行角色可存取。
- 後端每次資料操作在交易內切換成 `anon`／`authenticated`，並用 `SET LOCAL` 設定已驗證的會員 UUID；成功或回滾後即清除，避免連線池跨會員污染。
- 執行角色不具有 superuser、BYPASSRLS、建立角色／資料庫等權限，且不繼承群組權限。
- 舊密碼與 Supabase session 不移入；舊帳號不能繼續用舊密碼登入。

舊 email 帳號不會因相同信箱而自動綁定新的 Google 身分。正式搬遷既有會員時，需先規劃已驗證身分綁定或啟用 Email 驗證碼，避免建立重複會員。現階段未提供自動合併帳號。

`db:push` 現在是一般 PostgreSQL migration runner，會辨識既有 Supabase migration history、保留 checksum，並在交易中套用尚未執行的檔案；不執行 reset。新建的一般 PostgreSQL 可重播歷史 migration，完成後移除僅供歷史重播的 Auth 相容結構。

## 二、建立 Google OAuth 憑證

1. 開啟 [Google Cloud Console](https://console.cloud.google.com/)，建立或選擇 GreenThumb 專案。
2. 進入 **Google Auth Platform**，設定 Branding 與 Audience；對一般使用者選 External，填入支援 email 與開發者聯絡信箱。測試期間可維持 Testing，加入實際測試帳號。
3. 基本登入只使用 `openid`、`email`、`profile`，不需要 Gmail 讀信或寄信權限。
4. 在 **Clients → Create client** 建立 **Web application**。
5. 本機 Authorized redirect URI 填：

   ```text
   http://localhost:3000/api/auth/callback/google
   ```

6. 正式環境加入：

   ```text
   https://你的網站網域/api/auth/callback/google
   ```

7. 將取得的值填入 `.env.local`，不要貼進聊天或提交 Git：

   ```dotenv
   BETTER_AUTH_URL=http://localhost:3000
   GOOGLE_CLIENT_ID=
   GOOGLE_CLIENT_SECRET=
   ```

8. 重啟 `npm run dev`，並以 `http://localhost:3000` 開啟網站。`localhost` 與 `127.0.0.1` 的 cookie／Origin 不相同，請與 `BETTER_AUTH_URL` 一致。

使用其他 port 時，`BETTER_AUTH_URL` 與 Google redirect URI 都要同步修改。測試用網址與正式網址可登記在同一個 OAuth client；正式啟用時仍應確認 Audience、網域與品牌資訊。

後端使用授權碼、PKCE、一次性資料庫 state 與安全 cookie，並在回呼驗證 Google ID token 的簽章、issuer、audience 與有效期限。外部身分使用 `(providerId, accountId)` 的 Google `sub` 識別，不以 email 取代 Google 身分。

## 三、驗收會員功能

1. 點「登入」，使用 Google 繼續，完成後設定公開暱稱。
2. 撰寫討論、儲存草稿，重新整理或換裝置登入確認恢復。
3. 發表討論，確認正式發表後對應草稿清除。
4. 收藏、按讚、回應文章與專欄，重新整理確認保存。
5. 使用另一個 Google 帳號，確認無法讀取私人草稿／收藏或修改前一位會員的文章。
6. 登出後確認會員寫入被拒絕。

指定已用 Google 登入的會員為管理員：

```sh
npm run db:admin -- 會員信箱
```

## 四、Gmail SMTP 備援

1. 建立專用 Gmail 寄件帳號，開啟兩步驟驗證。
2. 在 Google 帳號安全設定建立應用程式密碼。不要使用一般登入密碼；部分安全設定或組織帳號不提供此功能。
3. 填入 `.env.local`：

   ```dotenv
   AUTH_EMAIL_ENABLED=false
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_USER=
   SMTP_PASSWORD=
   ```

4. 執行 `npm run mail:check`。此指令只測試連線與帳號驗證，不寄送信件。
5. 要驗收 Email 登入時再改為 `AUTH_EMAIL_ENABLED=true`，重啟網站。登入視窗將出現「Email 驗證碼登入」。

465 使用隱式 TLS，587 使用 STARTTLS，兩者均驗證憑證；程式拒絕其他 port。寄件人固定使用設定的 SMTP 帳號，使用者只能指定自己的收件地址，沒有任意寄信 API。

登入碼六位數、五分鐘有效、雜湊儲存、一次性使用、最多五次錯誤嘗試。寄送與登入亦有持久化資料庫速率限制，畫面提供重寄倒數。SMTP 失敗不會把密碼或驗證碼記入錯誤訊息。

個人 Gmail 的寄信額度與反垃圾郵件限制仍適用。正式開放 Email 登入前，需驗收真實收件、退信／失敗提示、寄送量與額度耗盡處理；目前以 Google 為主要測試入口。

## 五、TLS 與部署

遠端 PostgreSQL 一律驗證伺服器憑證與主機名稱。若供應商使用自己的根憑證，在 `.env.local` 設定其中一種：

```dotenv
DATABASE_CA_FILE=.local/certs/postgres-ca.crt
DATABASE_CA_CERT=
```

部署環境建議使用 `DATABASE_CA_CERT` 填入 PEM 憑證（可用字面 `\n` 分行），不依賴本機檔案路徑。Supabase 根憑證可從 Dashboard 的 Database Settings／SSL Configuration 下載。

Vercel 的 **Project → Settings → Environment Variables** 需設定以下項目，選擇 Production 環境後重新部署；GitHub push 不會把本機 `.env.local` 一起上傳。

| 環境變數 | 設定方式 |
| --- | --- |
| `APP_DATABASE_URL` | 本機初始化產生的受限連線，從 `.env.local` 複製 |
| `BETTER_AUTH_URL` | 網站正式的 HTTPS 網址，與使用者開啟的網域一致 |
| `BETTER_AUTH_SECRET` | 至少 32 字元的隨機密鑰，持續部署時維持相同值 |
| `AUTH_PASSWORD_ENABLED` | `true`，開放既有帳密會員登入 |
| `AUTH_EMAIL_ENABLED` | `false`，Gmail 尚未設定時維持關閉 |
| `DATABASE_CA_CERT` | 供應商的公開 PEM 根憑證；請勿填入本機 `DATABASE_CA_FILE` 路徑 |

先完成以上設定即可驗收帳密登入。Google 入口另需 `GOOGLE_CLIENT_ID`／`GOOGLE_CLIENT_SECRET`；SMTP 設定可等備用入口啟用時補上。管理用 `DATABASE_URL` 與資料庫管理密碼不提供給網站執行環境。

## 驗證指令

```sh
npm run test:auth
npm run test:supabase
npm run test:columns
npm run lint
npm run build
```

`test:supabase` 保留歷史 migration 的回歸測試；新的登入與論壇流程由 `test:auth` 驗證。舊 `scripts/test-cloud-workflows.mjs`／`test-live-supabase.mjs` 專門測試舊 Supabase Auth 架構，不適用於新登入。

## 官方文件

- [Better Auth Google](https://better-auth.com/docs/authentication/google)
- [Better Auth PostgreSQL](https://better-auth.com/docs/adapters/postgresql)
- [Better Auth Next.js](https://better-auth.com/docs/integrations/next)
- [Better Auth Email OTP](https://better-auth.com/docs/plugins/email-otp)
- [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect)
- [Gmail SMTP](https://developers.google.com/workspace/gmail/imap/imap-smtp)
- [Google 應用程式密碼](https://support.google.com/accounts/answer/185833)
- [Gmail 寄信限制](https://support.google.com/mail/answer/22839)
