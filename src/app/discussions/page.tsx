import type { Metadata } from "next";
import { CommunityHome } from "@/components/community/community-home";

export const metadata: Metadata = {
  title: "植物討論區 — GreenThumb",
  description: "按植物分類和地區探索種植問答、分享與教學。",
};

export default function DiscussionsPage() {
  return <CommunityHome view="discussions" />;
}
