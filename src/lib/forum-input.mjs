import regions from "./taiwan-regions.json" with { type: "json" };

export const forumBoards = [
  { slug: "foliage", name: "觀葉植物" },
  { slug: "succulents", name: "多肉植物" },
  { slug: "herbs", name: "香草植物" },
  { slug: "flowers", name: "花卉植物" },
];
export class ForumError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
const text = (value) => typeof value === "string" ? value.trim() : "";
export function validateAuth(input, register) {
  const email = text(input.email).toLowerCase();
  const password = typeof input.password === "string" ? input.password : "";
  const name = text(input.name);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !password || password.length > 128) throw new ForumError("請輸入有效的 Email 和密碼。");
  if (register && (!name || name.length > 40 || password.length < 12)) throw new ForumError("請填寫 1–40 字的暱稱，密碼至少 12 字元。");
  return { email, password, name };
}
export function validPostId(id) {
  return typeof id === "string" && /^[1-9]\d{0,18}$/.test(id) && BigInt(id) <= 9223372036854775807n;
}
export function validColumnId(id) {
  return typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
function discussionLocation(input, allowIncomplete = false) {
  const code = input.regionCode;
  if (code !== undefined && code !== null && typeof code !== "string") throw new ForumError("請選擇有效的所在地區。");
  const region = regions.find(item => item.code === code);
  if (code && !region) throw new ForumError("請選擇有效的縣市及鄉鎮市區。");
  const county = input.county === undefined ? region?.county ?? "" : input.county;
  if (typeof county !== "string" || (county && !regions.some(item => item.county === county)) || (region && region.county !== county)) throw new ForumError("縣市與鄉鎮市區不相符，請重新選擇。");
  if (county && !region && !allowIncomplete) throw new ForumError("請選擇鄉鎮市區，或改為不公開位置。");
  return { county, regionCode: region?.code ?? null };
}
export function validatePost(input) {
  const title = text(input.title), body = text(input.body);
  const board = forumBoards.find((item) => item.name === input.category);
  const font = input.font ?? null, fontSize = input.fontSize ?? 16, images = input.images;
  const validImage = (value) => {
    if (typeof value !== "string" || value.length > 2048) return false;
    try { const url = new URL(value); return url.origin === "https://i.ibb.co" && !url.username && !url.password && url.pathname !== "/"; }
    catch { return false; }
  };
  if (!title || title.length > 100 || !body || body.length > 5000 || !board || (font !== null && font !== "sans" && font !== "serif") ||
      ![14, 16, 18].includes(fontSize) || !Array.isArray(images) || images.length > 5 || !images.every(validImage)) throw new ForumError("請檢查標題、內文、分類與圖片連結。");
  if (input.id !== undefined && !validPostId(input.id)) throw new ForumError("文章編號不正確。");
  return { title, body, board, font, fontSize, images, ...discussionLocation(input) };
}
export function validateColumn(input) {
  const title = text(input.title), excerpt = text(input.excerpt), body = text(input.body);
  if (!title || title.length > 100 || !excerpt || excerpt.length > 200 || !body || body.length > 5000) throw new ForumError("請填寫標題、簡介與內文，並確認沒有超過字數上限。");
  const region = regions.find((item) => item.code === input.regionCode);
  if (!region) throw new ForumError("請選擇有效的縣市及鄉鎮市區。");
  if (input.id !== undefined && !validColumnId(input.id)) throw new ForumError("專欄編號不正確。");
  return { title, excerpt, body, regionCode: region.code };
}
export function safeNext(value) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !/[\\\s]/.test(value) ? value : "/";
}

export function validateDraft(kind, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ForumError('草稿格式不正確。');
  const title = typeof input.title === 'string' ? input.title : '';
  const body = typeof input.body === 'string' ? input.body : '';
  if (title.length > 100 || body.length > 5000) throw new ForumError('草稿超過字數上限。');
  if (kind === 'discussion') {
    const location = discussionLocation(input, true);
    const checked = validatePost({ ...input, county: undefined, regionCode: location.regionCode, title: title.trim() || '草稿', body: body.trim() || '草稿', id: undefined });
    return { title, body, category: checked.board.name, images: checked.images, font: checked.font ?? 'sans', fontSize: checked.fontSize, county: location.county, regionCode: location.regionCode ?? '' };
  }
  if (kind === 'column') {
    const excerpt = typeof input.excerpt === 'string' ? input.excerpt : '';
    const regionCode = typeof input.regionCode === 'string' ? input.regionCode : '';
    const region = regions.find(r => r.code === regionCode);
    const county = typeof input.county === 'string' ? input.county : region?.county ?? '';
    if (excerpt.length > 200 || (regionCode && !region) || (county && !regions.some(r=>r.county===county)) || (region && region.county!==county)) throw new ForumError('請檢查草稿的簡介與所在地。');
    return { title, body, excerpt, county, regionCode };
  }
  throw new ForumError('草稿類型不正確。');
}
