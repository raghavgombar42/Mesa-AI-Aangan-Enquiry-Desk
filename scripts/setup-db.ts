// Creates the aangan_ tables. Safe to re-run. Touches nothing from Case 02.
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Set DATABASE_URL in .env.local first");
  const sql = neon(url);
  const schema = readFileSync("db/schema.sql", "utf8")
    .split("\n").map((l) => l.replace(/--.*$/, "")).join("\n"); // drop comments: they may contain ";"
  for (const stmt of schema.split(";").map((s) => s.trim()).filter(Boolean)) await sql.query(stmt);
  const rows = await sql`SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'aangan_%' ORDER BY 1`;
  console.log("Tables ready:", rows.map((r) => r.table_name).join(", "));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
