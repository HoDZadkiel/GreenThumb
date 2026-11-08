"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { PenLine } from "lucide-react";
import { useCommunitySession } from "@/components/community/community-session";

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export function ExpertColumnEditLink({ id, authorId }: { id: string; authorId: string }) {
  const { user } = useCommunitySession();
  // The session may resolve before this streamed article hydrates.
  const hydrated = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  if (!hydrated || !user || (user.id !== authorId && user.role === "member")) return null;
  return <Link className="primary-button" href={`/columns/write?edit=${encodeURIComponent(id)}`}><PenLine size={15} />編輯專欄與所在地</Link>;
}
