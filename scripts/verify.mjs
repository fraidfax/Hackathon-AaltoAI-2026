// Proves retrieval and deletion work, without spending an API call. Fake vectors are fine
// here: cosine search and person-erasure are pure data operations, and deletion is 20% of
// the score. Run: node scripts/verify.mjs
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const PERSON = "Kwame Boateng";
const real = readFileSync("data/chunks.json", "utf8");

// store.mjs resolves data/ from cwd at import time, so set up the sandbox and chdir first.
const sandbox = mkdtempSync(join(tmpdir(), "receipt-verify-"));
mkdirSync(join(sandbox, "data"));
copyFileSync("data/chunks.json", join(sandbox, "data", "chunks.json"));

const chunks = JSON.parse(real);
const DIMS = 32;
writeFileSync(
  join(sandbox, "data", "embeddings.json"),
  JSON.stringify(chunks.map((c) => ({ id: c.id, vector: Array.from({ length: DIMS }, Math.random) })))
);

process.chdir(sandbox);
const { forgetPerson, loadChunks, loadEmbeddings } = await import("../lib/store.mjs");
const { search, archiveStats } = await import("../lib/retrieve.mjs");

let failures = 0;
const check = (label, pass, detail = "") => {
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`);
  if (!pass) failures++;
};

const before = archiveStats();
check("archive loads", before.chunks === chunks.length, `${before.chunks} chunks, ${before.documents} docs`);
check("every chunk is embedded", before.chunks === before.embedded);

const hits = search(Array.from({ length: DIMS }, Math.random), 8);
check("search returns ranked results", hits.length === 8 && hits[0].score >= hits[7].score);

const mentioning = chunks.filter((c) =>
  [c.author, ...(c.participants || []), ...(c.peopleMentioned || [])].filter(Boolean)
    .some((p) => p.toLowerCase() === PERSON.toLowerCase()) ||
  c.text.toLowerCase().includes(PERSON.toLowerCase())
).length;
check(`${PERSON} is present before deletion`, mentioning > 0, `${mentioning} chunks`);

const receipt = forgetPerson(PERSON);
check("deletion returns a receipt", receipt.chunksRemoved === mentioning,
  `removed ${receipt.chunksRemoved} across ${receipt.documentsAffected.length} documents`);

const after = loadChunks();
const stillThere = after.filter((c) => c.text.toLowerCase().includes(PERSON.toLowerCase()));
check("no surviving chunk mentions them", stillThere.length === 0,
  stillThere.length ? stillThere.map((c) => c.id).join(", ") : `${after.length} chunks remain`);

const survivingIds = new Set(after.map((c) => c.id));
const orphanVectors = loadEmbeddings().filter((e) => !survivingIds.has(e.id));
check("embeddings erased alongside chunks", orphanVectors.length === 0,
  `${loadEmbeddings().length} vectors remain`);

const post = search(Array.from({ length: DIMS }, Math.random), 8);
check("still answering after deletion", post.length === 8);
check("deleted content cannot be retrieved",
  post.every((h) => !h.chunk.text.toLowerCase().includes(PERSON.toLowerCase())));

process.chdir("..");
rmSync(sandbox, { recursive: true, force: true });

console.log(`\n${failures === 0 ? "all checks passed" : `${failures} FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
