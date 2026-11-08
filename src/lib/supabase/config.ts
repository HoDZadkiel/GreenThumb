export function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("請設定 Supabase URL 與公開金鑰。");
  if (key.startsWith("sb_secret_")) throw new Error("前端設定必須使用 Supabase 公開金鑰。");
  return { url, key };
}
