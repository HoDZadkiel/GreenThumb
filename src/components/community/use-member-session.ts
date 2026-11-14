'use client';

import { createContext, createElement, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createMemberSessionStore } from '@/lib/member-session-store.mjs';
import type { ForumUser } from './community-session';
import type { LoginMethods } from './member-access';

function useMemberSessionState() {
  const [store] = useState(() => createMemberSessionStore());
  const session = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot) as {
    user: ForumUser | null; auth: LoginMethods; loading: boolean; error: string; editorVersion: number;
  };
  useEffect(() => store.connect(window, document), [store]);
  return { ...session, changeUser: store.changeUser as (user: ForumUser | null) => void, refreshSession: store.refresh, isCurrentUser: store.isCurrentUser as (id: string) => boolean };
}

const MemberSessionContext = createContext<ReturnType<typeof useMemberSessionState> | null>(null);

// Keep the session connection above cached pages so hidden/back-forward pages
// receive the same identity and editor reset version when they become visible.
export function MemberSessionProvider({ children }: { children: ReactNode }) {
  const session = useMemberSessionState();
  return createElement(MemberSessionContext.Provider, { value: session }, children);
}

export function useMemberSession() {
  const session = useContext(MemberSessionContext);
  if (!session) throw new Error('Member session provider is missing');
  return session;
}
