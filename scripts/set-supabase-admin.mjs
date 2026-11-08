import postgres from "postgres";
import { databaseUrl, safeMessage } from "./supabase-env.mjs";
const email = process.argv[2]?.trim().toLowerCase();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("用法：npm run db:admin -- 已註冊並完成驗證的會員信箱");
  process.exit(1);
}
const sql = postgres(databaseUrl(), { ssl: "require", max: 1, prepare: false, connect_timeout: 12 });
try {
  const rows = await sql`update public.profiles p set role='admin' from auth.users u
    where p.id=u.id and lower(u.email)=${email} and u.email_confirmed_at is not null returning p.id`;
  if (rows.length !== 1) throw new Error("找不到已完成信箱驗證的會員，未變更任何權限。");
  console.log("已將指定會員設為管理員，重新登入後生效。");
} catch (error) { console.error(safeMessage(error)); process.exitCode = 1; }
finally { await sql.end({ timeout: 3 }); }
