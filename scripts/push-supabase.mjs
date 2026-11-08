import { spawn } from "node:child_process";
import { databaseUrl, safeMessage } from "./supabase-env.mjs";

try {
  const url = databaseUrl();
  const args = ["node_modules/supabase/dist/supabase.js", "db", "push", `--remote=${url}`, "--skip-vault", "--yes"];
  if (process.argv.includes("--dry-run")) args.push("--dry-run");
  const child = spawn(process.execPath, args, { stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  for (const stream of [child.stdout, child.stderr]) stream.on("data", chunk => { output += chunk; });
  const code = await new Promise((resolve, reject) => { child.on("error", reject); child.on("close", resolve); });
  console.log(safeMessage({ message: output }));
  process.exitCode = code ?? 1;
} catch (error) { console.error(safeMessage(error)); process.exitCode = 1; }
