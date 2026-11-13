import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { hashPassword } from "better-auth/crypto";
import { createMemberAuth } from "../src/lib/auth/create.mjs";
import { handleAuthRequest } from "../src/lib/auth/http.mjs";
import { authAvailability } from "../src/lib/auth/config.mjs";
import { smtpOptions, verificationMessage } from "../src/lib/auth/mail.mjs";
import { withMemberDatabase } from "../src/lib/db/pool.mjs";
import { currentUser, savePost, getPost, saveColumn } from "../src/lib/db/forum.ts";
import { writeMemberData, readDraft, bookmarkIds } from "../src/lib/db/member-data.ts";
import { articleTarget, interact, getInteractions } from "../src/lib/db/article-interactions.ts";

const baseURL = "http://localhost:3109";
const env = { BETTER_AUTH_URL: baseURL, BETTER_AUTH_SECRET: "test-only-" + "x".repeat(48),
  GOOGLE_CLIENT_ID: "test-google-client", GOOGLE_CLIENT_SECRET: "test-google-secret",
  APP_DATABASE_URL: "configured", AUTH_EMAIL_ENABLED: "true", SMTP_USER: "sender@example.test", SMTP_PASSWORD: "test-only" };

function poolFor(db) {
  let queue = Promise.resolve();
  return {
    options: {},
    async connect() {
      const previous = queue;
      let unlock;
      queue = new Promise(resolve => { unlock = resolve; });
      await previous;
      await db.exec("set role greenthumb_app");
      return { processID: 123, async query(text, args = []) {
        const result = await db.query(text, args);
        return { ...result, rowCount: result.affectedRows ?? result.rows.length, command: /^\s*(\w+)/.exec(text)?.[1].toUpperCase() };
      }, release() { unlock(); } };
    },
    async end() {},
  };
}

async function fixture(t, legacy = false) {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`create schema auth;
    create table auth.users (id uuid primary key,raw_user_meta_data jsonb default '{}',email text,email_confirmed_at timestamptz,created_at timestamptz default now());
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
    create role anon; create role authenticated; grant usage on schema auth to anon,authenticated;`);
  for (const name of ["00001_init.sql", "00002_live_forum.sql", "00003_cloud_content.sql", "00004_article_interactions.sql", "00005_optional_post_location.sql", "00006_portable_auth.sql"]) {
    if (legacy && name === "00006_portable_auth.sql") {
      await db.query("insert into auth.users (id,email,email_confirmed_at) values ('11111111-1111-4111-8111-111111111111','legacy@example.test',now())");
      await db.query("insert into public.posts (board_id,author_id,title,body) values (1,'11111111-1111-4111-8111-111111111111','保留舊文章','原始內容')");
    }
    await db.exec(readFileSync(`supabase/migrations/${name}`, "utf8"));
  }
  await db.exec("drop table auth.users; drop function auth.uid(); drop schema auth");
  const pool = poolFor(db);
  const admin = async (text, args = []) => { await db.exec("reset role"); return db.query(text, args); };
  return { db, pool, admin };
}

function cookies(response, previous = "") {
  const jar = new Map(previous.split("; ").filter(Boolean).map(pair => [pair.slice(0, pair.indexOf("=")), pair]));
  for (const header of response.headers.getSetCookie()) {
    const pair = header.split(";")[0];
    jar.set(pair.slice(0, pair.indexOf("=")), pair);
  }
  return [...jar.values()].join("; ");
}
const location = response => new URL(response.headers.get("location") || "/", baseURL).href;
function request(auth, path, body, cookie = "", ip = "192.0.2.10") {
  return handleAuthRequest(auth, new Request(baseURL + "/api/auth" + path, {
    method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", Origin: baseURL, cookie, "x-forwarded-for": ip },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }), env);
}

test("Google OAuth creates a portable member and preserves RLS across forum workflows", async t => {
  const { pool, admin } = await fixture(t);
  const auth = createMemberAuth(pool, env, async () => {});
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: "jwk" }), kid: "fixture-key", alg: "RS256", use: "sig" };
  let identity = { sub: "google-member-a", email: "member-a@example.test", aud: env.GOOGLE_CLIENT_ID };
  let expectedChallenge;
  t.mock.method(globalThis, "fetch", async (input, options) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url === "https://www.googleapis.com/oauth2/v3/certs") return Response.json({ keys: [jwk] });
    assert.equal(url, "https://oauth2.googleapis.com/token", "tests never contact a real Google service");
    const parameters = new URLSearchParams(options.body);
    assert.equal(createHash("sha256").update(parameters.get("code_verifier")).digest("base64url"), expectedChallenge);
    const now = Math.floor(Date.now() / 1000);
    const payload = { iss: "https://accounts.google.com", iat: now, exp: now + 3600, name: "Private Google Name", email_verified: true, ...identity };
    const data = Buffer.from(JSON.stringify({ alg: "RS256", kid: jwk.kid })).toString("base64url") + "." + Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = sign("RSA-SHA256", Buffer.from(data), privateKey);
    if (identity.signatureInvalid) signature[0] ^= 1;
    const idToken = data + "." + signature.toString("base64url");
    return Response.json({ access_token: "fixture-access", token_type: "Bearer", expires_in: 3600, id_token: idToken });
  });
  async function login() {
    const start = await request(auth, "/sign-in/social", { provider: "google", callbackURL: "/auth/complete", disableRedirect: true });
    assert.equal(start.status, 200, await start.clone().text());
    const url = new URL((await start.json()).url);
    assert.equal(url.origin, "https://accounts.google.com");
    assert.equal(url.searchParams.get("redirect_uri"), baseURL + "/api/auth/callback/google");
    assert.equal(url.searchParams.get("code_challenge_method"), "S256");
    assert.deepEqual(new Set(url.searchParams.get("scope").split(" ")), new Set(["openid", "email", "profile"]));
    expectedChallenge = url.searchParams.get("code_challenge");
    const stateCookie = cookies(start);
    const callbackPath = "/callback/google?code=fixture-code&state=" + url.searchParams.get("state");
    const callback = await request(auth, callbackPath, null, stateCookie);
    assert.equal(callback.status, 302);
    return { cookie: cookies(callback, stateCookie), callback, callbackPath, stateCookie };
  }
  const first = await login();
  assert.equal(location(first.callback), baseURL + "/auth/complete");
  assert.match(first.callback.headers.get("set-cookie"), /HttpOnly/i);
  const session = await (await request(auth, "/get-session", null, first.cookie)).json();
  assert.ok(session.user.id);
  const a = session.user.id;
  let dbFor = id => ({ userId: id, query: (sql, args) => withMemberDatabase(pool, id, connection => connection.query(sql, args)) });
  const aDB = dbFor(a), guestDB = dbFor(null);
  const aUser = await currentUser(aDB);
  assert.equal(aUser.name, "新會員", "Google's real name is never made public automatically");
  assert.equal(aUser.role, "member");
  const another = await login();
  const again = await (await request(auth, "/get-session", null, another.cookie)).json();
  assert.equal(again.user.id, a, "same Google sub returns the same local UUID");

  identity = { ...identity, sub: "google-member-b", email: "member-b@example.test" };
  const second = await login();
  const b = (await (await request(auth, "/get-session", null, second.cookie)).json()).user.id;
  const bDB = dbFor(b), bUser = await currentUser(bDB);
  await writeMemberData(aDB, a, { action: "profile", name: "陽台種植者", role: "admin" });
  assert.equal((await currentUser(aDB)).role, "member");
  await writeMemberData(aDB, a, { action: "saveDraft", kind: "discussion", payload: { title: "草稿", body: "", category: "觀葉植物", images: [], font: "sans", fontSize: 16 } });
  assert.ok(await readDraft(aDB, a, "discussion"));
  assert.equal(await readDraft(bDB, a, "discussion"), null);
  const post = await savePost(aDB, aUser, { title: "陽台經驗", body: "**植物**", category: "觀葉植物", images: [], regionCode: "63000030" });
  assert.equal(await readDraft(aDB, a, "discussion"), null);
  assert.ok(await getPost(guestDB, post.id));
  await assert.rejects(savePost(guestDB, null, { title: "訪客" }));
  await assert.rejects(savePost(bDB, bUser, { id: post.id, title: "篡改", body: "內容", category: "觀葉植物", images: [] }));
  await writeMemberData(aDB, a, { action: "bookmark", postId: post.id, saved: true });
  assert.deepEqual(await bookmarkIds(aDB), [post.id]);
  assert.deepEqual(await bookmarkIds(bDB), []);
  const target = articleTarget("post", post.id);
  await interact(bDB, bUser, target, { action: "reply", body: "另一位會員回應" });
  await interact(bDB, bUser, target, { action: "like", liked: true });
  await interact(bDB, bUser, target, { action: "like", liked: true });
  const interactions = await getInteractions(bDB, bUser, target);
  assert.equal(interactions.likeCount, 1); assert.equal(interactions.replyCount, 1); assert.equal(interactions.liked, true);
  const column = await saveColumn(aDB, aUser, { title: "在地經驗", excerpt: "簡介", body: "內容", regionCode: "63000030" });
  await interact(bDB, bUser, articleTarget("column", column.id), { action: "reply", body: "專欄回應" });
  assert.equal((await getInteractions(guestDB, null, articleTarget("column", column.id))).replyCount, 1);
  await assert.rejects(aDB.query("select * from public.gt_session"));
  await assert.rejects(aDB.query("update public.profiles set role='admin' where id=$1", [a]));
  await assert.rejects(withMemberDatabase(pool, a, async connection => { await connection.query("select 1/0"); }));
  assert.equal((await guestDB.query("select public.current_member_id() as id")).rows[0].id, null);

  const forged = await request(auth, "/callback/google?code=fixture&state=forged");
  assert.notEqual(location(forged), baseURL + "/auth/complete");
  identity = { sub: "bad-audience", email: "bad@example.test", aud: "another-client" };
  const bad = await login();
  assert.notEqual(location(bad.callback), baseURL + "/auth/complete");
  for (const invalid of [{ iss: "https://evil.example" }, { exp: Math.floor(Date.now() / 1000) - 3600 }, { signatureInvalid: true }]) {
    identity = { sub: "invalid-claims", email: "invalid@example.test", aud: env.GOOGLE_CLIENT_ID, ...invalid };
    assert.notEqual(location((await login()).callback), baseURL + "/auth/complete");
  }
  assert.equal((await admin("select count(*)::int as n from public.gt_user")).rows[0].n, 2);
  const replay = await request(auth, first.callbackPath, null, first.stateCookie);
  assert.notEqual(location(replay), baseURL + "/auth/complete");
  const untrusted = await handleAuthRequest(auth, new Request(baseURL + "/api/auth/sign-in/social", { method: "POST", headers: { "content-type": "application/json", origin: "https://evil.example" }, body: JSON.stringify({ provider: "google" }) }), env);
  assert.equal(untrusted.status, 403);
  assert.equal((await request(auth, "/sign-in/social", { provider: "google", scopes: ["https://www.googleapis.com/auth/gmail.readonly"] })).status, 400);
  assert.equal((await request(auth, "/sign-in/social", { provider: "google", padding: "x".repeat(9000) })).status, 413);
  const signOut = await request(auth, "/sign-out", {}, first.cookie);
  assert.equal(signOut.status, 200);
  assert.equal(await (await request(auth, "/get-session", null, first.cookie)).json(), null);
  assert.equal((await admin("select count(*)::int as n from pg_class where relnamespace='public'::regnamespace and relkind='r' and not relrowsecurity")).rows[0].n, 0);
});

test("SMTP OTP login stores hashes, expires, rejects replay, and limits sends", async t => {
  const { pool, admin } = await fixture(t);
  const mail = [];
  const auth = createMemberAuth(pool, env, async (email, otp) => { mail.push({ email, otp }); });
  const email = "mail-member@example.test";
  assert.equal((await request(auth, "/email-otp/send-verification-otp", { email, type: "sign-in" })).status, 200);
  assert.equal(mail.length, 1);
  const stored = (await admin("select value from public.gt_verification where identifier like '%mail-member%'")).rows[0].value;
  assert.ok(!stored.includes(mail[0].otp));
  const login = await request(auth, "/sign-in/email-otp", { email, otp: mail[0].otp });
  assert.equal(login.status, 200, await login.clone().text());
  assert.ok((await (await request(auth, "/get-session", null, cookies(login))).json()).user.id);
  assert.notEqual((await request(auth, "/sign-in/email-otp", { email, otp: mail[0].otp })).status, 200);
  const expiredEmail = "expired@example.test";
  await request(auth, "/email-otp/send-verification-otp", { email: expiredEmail, type: "sign-in" }, "", "192.0.2.11");
  await admin("update public.gt_verification set \"expiresAt\"=now()-interval '1 minute'");
  assert.notEqual((await request(auth, "/sign-in/email-otp", { email: expiredEmail, otp: mail.at(-1).otp }, "", "192.0.2.11")).status, 200);
  for (let i = 0; i < 3; i++) assert.equal((await request(auth, "/email-otp/send-verification-otp", { email: "limited@example.test", type: "sign-in" }, "", "192.0.2.12")).status, 200);
  assert.equal((await request(auth, "/email-otp/send-verification-otp", { email: "limited@example.test", type: "sign-in" }, "", "192.0.2.12")).status, 429);
  const off = createMemberAuth(pool, { ...env, AUTH_EMAIL_ENABLED: "false" });
  assert.equal((await request(off, "/sign-in/email-otp", { email, otp: "123456" })).status, 404);
});

test("configuration and SMTP are explicit and secure by default", () => {
  assert.deepEqual(authAvailability({}), { google: false, email: false, password: false });
  assert.deepEqual(authAvailability({ ...env, AUTH_EMAIL_ENABLED: "false" }), { google: true, email: false, password: true });
  assert.equal(authAvailability({ ...env, AUTH_PASSWORD_ENABLED: "false" }).password, false);
  assert.equal(smtpOptions(env).secure, true);
  assert.equal(smtpOptions({ ...env, SMTP_PORT: "587" }).requireTLS, true);
  assert.throws(() => smtpOptions({ ...env, SMTP_PORT: "25" }));
  assert.throws(() => verificationMessage("injected\r\nBcc: x@example.test", "123456", env));
  assert.throws(() => verificationMessage("x@example.test", "<script>", env));
  assert.match(verificationMessage("x@example.test", "123456", env).text, /5 分鐘/);
});

test("password login validates stored credentials, creates a member session, and keeps sign-up closed", async t => {
  const { pool, admin } = await fixture(t);
  const password = "test-only-password!A1";
  const hash = await hashPassword(password);
  const { rows: [user] } = await admin('insert into public.gt_user (name,email,"emailVerified") values ($1,$2,false) returning id', ["密碼測試會員", "password-member@example.test"]);
  await admin('insert into public.gt_account ("accountId","userId","providerId",password) values ($1,$2,\'credential\',$3)', [user.id, user.id, hash]);
  const auth = createMemberAuth(pool, env, async () => {});
  assert.equal((await request(auth, "/sign-in/email", { email: "password-member@example.test", password: "wrong-password" })).status, 401);
  assert.equal((await request(auth, "/sign-in/email", { email: "missing@example.test", password })).status, 401);
  const loginRequest = new Request(baseURL + "/api/auth/sign-in/email", {
    method: "POST", headers: { origin: baseURL, "content-type": "application/json", "x-forwarded-for": "192.0.2.10" },
    body: JSON.stringify({ email: " PASSWORD-MEMBER@example.test ", password }),
  });
  // Cache Components wraps NextRequest; cloning that Proxy fails Undici's private-field check.
  const wrappedRequest = new Proxy(loginRequest, { get(target, key) {
    const value = Reflect.get(target, key, target);
    return typeof value === "function" ? value.bind(target) : value;
  } });
  const login = await handleAuthRequest(auth, wrappedRequest, env);
  assert.equal(login.status, 200, await login.clone().text());
  assert.match(login.headers.get("set-cookie"), /HttpOnly/i);
  const cookie = cookies(login);
  const session = await (await request(auth, "/get-session", null, cookie)).json();
  assert.equal(session.user.id, user.id);
  const db = { userId: session.user.id, query: (sql, args) => withMemberDatabase(pool, session.user.id, connection => connection.query(sql, args)) };
  assert.equal((await currentUser(db)).role, "member");
  assert.equal((await request(auth, "/sign-up/email", { email: "signup@example.test", name: "未開放註冊", password })).status, 404);
  assert.equal((await request(auth, "/sign-in/email", { email: "password-member@example.test", password, role: "admin" })).status, 400);
  const disabledEnv = { ...env, AUTH_PASSWORD_ENABLED: "false" };
  const disabled = createMemberAuth(pool, disabledEnv, async () => {});
  const offRequest = new Request(baseURL + "/api/auth/sign-in/email", { method: "POST", headers: { origin: baseURL, "content-type": "application/json" }, body: JSON.stringify({ email: "password-member@example.test", password }) });
  assert.equal((await handleAuthRequest(disabled, offRequest, disabledEnv)).status, 404);
  for (let attempt = 0; attempt < 5; attempt++) {
    assert.equal((await request(auth, "/sign-in/email", { email: "password-member@example.test", password: "wrong-password" }, "", "192.0.2.21")).status, 401);
  }
  assert.equal((await request(auth, "/sign-in/email", { email: "password-member@example.test", password }, "", "192.0.2.21")).status, 429);
  assert.equal((await request(auth, "/sign-out", {}, cookie)).status, 200);
  assert.equal(await (await request(auth, "/get-session", null, cookie)).json(), null);
});

test("migration preserves legacy member UUIDs and posts without Supabase Auth dependencies", async t => {
  const { admin, pool } = await fixture(t, true);
  const id = "11111111-1111-4111-8111-111111111111";
  assert.equal((await admin("select id from public.gt_user where email='legacy@example.test'")).rows[0].id, id);
  assert.equal((await admin("select author_id from public.posts")).rows[0].author_id, id);
  const { rows } = await withMemberDatabase(pool, id, connection => connection.query("select id,body from public.posts"));
  assert.equal(rows[0].body, "原始內容");
  assert.equal((await admin("select to_regclass('auth.users') as users")).rows[0].users, null);
});
