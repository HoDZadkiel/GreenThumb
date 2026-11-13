export function authSettings(env = process.env) {
  const baseURL = env.BETTER_AUTH_URL || (env.NODE_ENV === "production" ? "" : "http://localhost:3000");
  let origin = "";
  if (baseURL) {
    const url = new URL(baseURL);
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash ||
        (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))) {
      throw new Error("BETTER_AUTH_URL 必須是網站的 HTTPS 網址；本機開發可使用 HTTP。");
    }
    origin = url.origin;
  }
  return {
    baseURL: origin,
    secret: env.BETTER_AUTH_SECRET || "",
    googleClientId: env.GOOGLE_CLIENT_ID || "",
    googleClientSecret: env.GOOGLE_CLIENT_SECRET || "",
    googleEnabled: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    emailEnabled: env.AUTH_EMAIL_ENABLED === "true" && Boolean(env.SMTP_USER && env.SMTP_PASSWORD),
    passwordEnabled: env.AUTH_PASSWORD_ENABLED !== "false",
  };
}

export function authAvailability(env = process.env) {
  try {
    const settings = authSettings(env);
    const ready = Boolean(settings.baseURL && settings.secret.length >= 32 && env.APP_DATABASE_URL);
    return { google: ready && settings.googleEnabled, email: ready && settings.emailEnabled, password: ready && settings.passwordEnabled };
  } catch { return { google: false, email: false, password: false }; }
}
