// Regenerates lib/knowledge-text.ts from knowledge/*.md so Nikhil's documents ship
// inside the server bundle (no runtime file reads on Vercel).
import { readFileSync, writeFileSync } from "node:fs";

const FILES = [
  ["SERVICES_MD", "services.md"],
  ["PRICING_MD", "pricing.md"],
  ["QUALIFIED_MD", "qualified.md"],
] as const;

const lines = [
  "// GENERATED from knowledge/*.md by scripts/build-knowledge.ts - edit the .md files, then run: npm run knowledge",
  "// Nikhil's own documents, given verbatim to the AI steps as context.",
  "",
];
for (const [name, file] of FILES) {
  lines.push(`export const ${name} = ${JSON.stringify(readFileSync(`knowledge/${file}`, "utf8"))};`, "");
}
writeFileSync("lib/knowledge-text.ts", lines.join("\n"));
console.log("lib/knowledge-text.ts written");
