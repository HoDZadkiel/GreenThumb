"use client";

import { createContext, useContext } from "react";

export type ForumUser = { id: string; name: string; role: "member" | "moderator" | "admin" };
type CommunitySession = { user: ForumUser | null; loading: boolean; requestLogin: () => void };
export const CommunitySessionContext = createContext<CommunitySession | null>(null);

export function useCommunitySession() {
  const session = useContext(CommunitySessionContext);
  if (!session) throw new Error("Community session is missing");
  return session;
}
