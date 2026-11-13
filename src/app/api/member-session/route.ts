import { createClient } from "@/lib/db/server";
import { currentUser } from "@/lib/db/forum";
import { authAvailability } from "@/lib/auth/config.mjs";
import { failure, json } from "@/lib/forum-http";

export async function GET() {
  try { return json({ user: await currentUser(await createClient()), auth: authAvailability() }); }
  catch (error) { return failure(error); }
}
