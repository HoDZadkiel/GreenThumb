import regionData from "./taiwan-regions.json";

export const taiwanRegions = regionData;
export const taiwanCounties = ["基隆市", "臺北市", "新北市", "桃園市", "新竹市", "新竹縣", "苗栗縣", "臺中市", "彰化縣", "南投縣", "雲林縣", "嘉義市", "嘉義縣", "臺南市", "高雄市", "屏東縣", "宜蘭縣", "花蓮縣", "臺東縣", "澎湖縣", "金門縣", "連江縣"];
export type TaiwanRegion = (typeof taiwanRegions)[number];
export type ExpertColumnSummary = {
  id: string;
  authorId: string;
  author: string;
  title: string;
  excerpt: string;
  regionCode: string;
  createdAt: string;
  updatedAt: string;
};
export type ExpertColumn = ExpertColumnSummary & { body: string };
export type ArticlePin = {
  id: string;
  kind: "column" | "post";
  title: string;
  author: string;
  regionCode: string;
  href: string;
  createdAt: string;
};
export function getRegion(code: string) {
  return taiwanRegions.find((region) => region.code === code);
}
