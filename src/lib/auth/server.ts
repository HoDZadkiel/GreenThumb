import "server-only";
import { databasePool } from "@/lib/db/pool.mjs";
import { createMemberAuth } from "./create.mjs";

let instance: ReturnType<typeof createMemberAuth> | undefined;
export function getAuth() {
  if (!instance) instance = createMemberAuth(databasePool());
  return instance;
}
