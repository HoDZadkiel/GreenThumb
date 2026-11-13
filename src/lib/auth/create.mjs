import { betterAuth } from "better-auth";
import { emailOTP } from "better-auth/plugins";
import { google } from "better-auth/social-providers";
import { verifyProviderIdToken } from "better-auth/oauth2";
import { authSettings } from "./config.mjs";
import { sendVerificationCode } from "./mail.mjs";

export function createMemberAuth(pool, env = process.env, sendCode = sendVerificationCode) {
  const settings = authSettings(env);
  if (!settings.baseURL || settings.secret.length < 32) throw new Error("請設定 BETTER_AUTH_URL 與至少 32 字元的 BETTER_AUTH_SECRET。");
  const googleOptions = { clientId: settings.googleClientId, clientSecret: settings.googleClientSecret, prompt: "select_account" };
  const googleProvider = google(googleOptions);
  return betterAuth({
    appName: "GreenThumb",
    baseURL: settings.baseURL,
    secret: settings.secret,
    database: pool,
    user: { modelName: "gt_user" },
    account: { modelName: "gt_account", accountLinking: { enabled: false }, encryptOAuthTokens: true, storeStateStrategy: "database" },
    session: { modelName: "gt_session", expiresIn: 60 * 60 * 24 * 7, cookieCache: { enabled: false } },
    verification: { modelName: "gt_verification" },
    emailAndPassword: { enabled: settings.passwordEnabled, disableSignUp: true, requireEmailVerification: false, minPasswordLength: 12, maxPasswordLength: 128 },
    advanced: { database: { generateId: "uuid" }, cookiePrefix: "greenthumb", defaultCookieAttributes: { httpOnly: true, sameSite: "lax" } },
    socialProviders: settings.googleEnabled ? {
      google: {
        ...googleOptions,
        async getUserInfo(tokens) {
          // Also validate the ID token on the code-exchange path, before using any profile claims.
          if (!tokens.idToken || !await verifyProviderIdToken(googleProvider, tokens.idToken, tokens.expectedIdTokenNonce)) return null;
          return googleProvider.getUserInfo(tokens);
        },
      },
    } : {},
    rateLimit: { enabled: true, storage: "database", modelName: "gt_rate_limit", window: 60, max: 60, customRules: {
      "/email-otp/send-verification-otp": { window: 60, max: 3 },
      "/sign-in/email-otp": { window: 60, max: 5 },
      "/sign-in/social": { window: 60, max: 10 },
      "/sign-in/email": { window: 60, max: 5 },
    } },
    plugins: settings.emailEnabled ? [emailOTP({
      otpLength: 6, expiresIn: 300, allowedAttempts: 5, storeOTP: "hashed",
      async sendVerificationOTP({ email, otp, type }) {
        if (type !== "sign-in") throw new Error("不支援的驗證類型。");
        await sendCode(email, otp);
      },
    })] : [],
    logger: { disabled: true },
  });
}
