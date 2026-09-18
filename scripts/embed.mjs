// Embeds every chunk once. Run after ingest: node scripts/embed.mjs
import { readFileSync, writeFileSync } from "fs";
import { embedTexts } from "../lib/llm.mjs";

const chunks = JSON.parse(readFileSync("data/chunks.json", "utf8"));
const BATCH = 64;
const out = [];

for (let i = 0; i < chunks.length; i += BATCH) {
  const batch = chunks.slice(i, i + BATCH);
  const vectors = await embedTexts(batch.map((c) => `${c.title}\n\n${c.text}`));
  batch.forEach((c, j) => out.push({ id: c.id, vector: vectors[j] }));
  console.log(`embedded ${Math.min(i + BATCH, chunks.length)}/${chunks.length}`);
}

writeFileSync("data/embeddings.json", JSON.stringify(out));
console.log(`wrote data/embeddings.json — ${out.length} vectors, ${out[0].vector.length} dimensions`);
