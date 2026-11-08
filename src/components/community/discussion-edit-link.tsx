"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { PenLine } from "lucide-react";
import { useCommunitySession } from "./community-session";

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export function DiscussionEditLink({ id, authorId }: { id: string; authorId: string }) {
  const { user } = useCommunitySession();
  const hydrated = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  if (!hydrated || !user || (user.role === "member" && user.id !== authorId)) return null;
  return <Link className="text-link" href={`/discussions/write?edit=${encodeURIComponent(id)}`}><PenLine size={15} />編輯文章</Link>;
}
