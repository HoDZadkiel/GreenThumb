"use client";

import { useSearchParams } from "next/navigation";
import { CommunityHome } from "./community-home";

export function WriteDiscussion() {
  const editId = useSearchParams().get("edit");
  return <CommunityHome key={editId ?? "new"} view="write" editId={editId} />;
}
