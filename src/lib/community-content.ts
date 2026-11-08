export const topics = ["全部植物", "觀葉植物", "多肉植物", "香草植物", "花卉植物"];

export const maxDraftImages = 5;

export function isImgBBImage(value: unknown): value is string {
  if (typeof value !== "string") return false;

  try {
    const url = new URL(value);
    return url.origin === "https://i.ibb.co" && !url.username && !url.password && url.pathname !== "/";
  } catch {
    return false;
  }
}
