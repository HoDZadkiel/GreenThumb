import "server-only";
import { headers } from "next/headers";
import type { PoolClient } from "pg";
import { getAuth } from "@/lib/auth/server";
import { databasePool, withMemberDatabase } from "./pool.mjs";

export type Database = { query: <T extends import("pg").QueryResultRow = import("pg").QueryResultRow>(text: string, values?: unknown[]) => Promise<import("pg").QueryResult<T>>; userId: string | null };

export async function createClient(): Promise<Database> {
  const requestHeaders = await headers();
  const hasSession = /(?:^|;\s*)(?:__Secure-)?greenthumb\.session_token=/.test(requestHeaders.get("cookie") ?? "");
  const session = hasSession ? await getAuth().api.getSession({ headers: requestHeaders }) : null;
  const userId = session?.user.id ?? null;
  return {
    userId,
    query: (text, values = []) => withMemberDatabase(databasePool(), userId, (connection: PoolClient) => connection.query(text, values)),
  };
}
