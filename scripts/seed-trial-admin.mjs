import { randomBytes } from "node:crypto";
import { createTrialUser, getTrialDatabase } from "../src/lib/trial-forum-db.mjs";

const email = "admin@greenthumb.test";
if (getTrialDatabase().prepare("select 1 from users where email = ?").get(email)) {
  throw new Error("預設管理員帳號已存在。");
}

const password = randomBytes(20).toString("base64url");
createTrialUser(email, "GreenThumb 管理員", password, "admin");
console.log(JSON.stringify({ email, password }));
