import nextEnv from "@next/env";
import nodemailer from "nodemailer";
import { smtpOptions } from "../src/lib/auth/mail.mjs";

nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
let transport;
try {
  transport = nodemailer.createTransport(smtpOptions());
  await transport.verify();
  console.log("SMTP 連線與帳號驗證成功；沒有寄送郵件。");
} catch {
  console.error("SMTP 檢查失敗，請確認主機、連接埠及應用程式密碼。未寄送郵件。");
  process.exitCode = 1;
} finally { transport?.close(); }
