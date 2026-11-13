import nodemailer from "nodemailer";

export function smtpOptions(env = process.env) {
  const port = Number(env.SMTP_PORT || "465");
  if (![465, 587].includes(port)) throw new Error("SMTP_PORT 必須是 465 或 587。");
  if (!env.SMTP_USER || !env.SMTP_PASSWORD) throw new Error("尚未設定 SMTP 寄信服務。");
  return {
    host: env.SMTP_HOST || "smtp.gmail.com",
    port,
    secure: port === 465,
    requireTLS: true,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
    disableFileAccess: true,
    disableUrlAccess: true,
  };
}

export function verificationMessage(to, otp, env = process.env) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || /[\r\n]/.test(to) || !/^\d{6}$/.test(otp)) throw new Error("驗證信資料不正確。");
  return {
    from: { name: "GreenThumb 綠手指", address: env.SMTP_USER },
    to,
    subject: "GreenThumb 登入驗證碼",
    text: `你的 GreenThumb 登入驗證碼是：${otp}\n\n驗證碼將在 5 分鐘後失效，只能使用一次。請勿將驗證碼提供給其他人。\n若你沒有要求登入，請忽略這封信。`,
    html: `<div lang="zh-Hant"><h2>登入 GreenThumb</h2><p>你的登入驗證碼：</p><p style="font-size:28px;letter-spacing:6px">${otp}</p><p>驗證碼將在 5 分鐘後失效，只能使用一次。請勿將驗證碼提供給其他人。</p><p>若你沒有要求登入，請忽略這封信。</p></div>`,
  };
}

export async function sendVerificationCode(email, otp) {
  const transporter = nodemailer.createTransport(smtpOptions());
  try {
    await transporter.sendMail(verificationMessage(email, otp));
  } catch {
    // Never expose SMTP credentials, the recipient, or the OTP in errors/logs.
    throw new Error("驗證信暫時無法寄送，請稍後再試。");
  } finally { transporter.close(); }
}
