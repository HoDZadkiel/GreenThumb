export const topics = ["全部植物", "觀葉植物", "多肉植物", "香草植物", "花卉植物"];
export const posts = [
  { id: 1, title: "龜背芋的新葉一直不開背，是光線不夠嗎？", excerpt: "養了快一年的龜背芋，最近終於冒新葉！但葉片還是完整的，想請教大家的照顧經驗。", category: "觀葉植物", type: "發問", author: "小葉子", region: "北部", time: "25 分鐘前", likes: 18, replies: 12, tags: ["龜背芋", "室內植物"], color: "sage", answer: "可以先觀察植株的成熟度、根系狀態與光照。新葉是否開背也與品種及生長階段有關，歡迎分享窗邊位置與照顧方式，讓討論更有依據。" },
  { id: 2, title: "陽台的迷迭香，終於平安度過第一個夏天", excerpt: "從澆水太勤到學會看土乾濕，記錄這半年踩過的坑，分享給也在台灣種香草的朋友。", category: "香草植物", type: "分享", author: "陽台園丁", region: "中部", time: "1 小時前", likes: 46, replies: 8, tags: ["迷迭香", "陽台種植"], color: "sand", answer: "這篇種植筆記記錄了日照、通風與介質調整的過程。不同陽台環境差異很大，比起固定每幾天澆水，觀察實際乾濕會更有幫助。" },
  { id: 3, title: "新手第一盆多肉，從選對介質開始", excerpt: "顆粒土、泥炭土到底怎麼配？整理我的入門筆記，一起幫多肉建立舒服的家。", category: "多肉植物", type: "教學", author: "慢慢種", region: "南部", time: "2 小時前", likes: 32, replies: 6, tags: ["多肉入門", "介質"], color: "rose", answer: "選介質時需要一起考慮盆器排水、放置位置與澆水習慣。可以先從少量配製開始，觀察乾燥速度，再依自己的種植環境調整。" },
  { id: 4, title: "分享窗邊這一抹紫：非洲菫的開花日常", excerpt: "沒有大陽台也能享受開花的快樂。這個小角落，成了每天早上最期待的風景。", category: "花卉植物", type: "分享", author: "窗邊有花", region: "北部", time: "3 小時前", likes: 27, replies: 5, tags: ["非洲菫", "開花紀錄"], color: "lilac", answer: "小空間也能記錄植物的變化。這則示範分享用來呈現花卉討論的閱讀體驗；正式版本將可附上自己的照片與照護紀錄。" },
];

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
