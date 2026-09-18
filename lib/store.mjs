// The only module that touches storage. Everything else goes through here, so moving off
// the local filesystem (which Vercel does not persist between requests) is a change to this
// file alone.
//
// ponytail: file-backed store. Correct locally and for a single warm instance; it will NOT
// survive across serverless invocations on Vercel. Upgrade path is Vercel KV / Upstash —
// swap the four read/write helpers below, leave every caller untouched.
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const DATA = join(process.cwd(), "data");
const CHUNKS = join(DATA, "chunks.json");
const EMBEDDINGS = join(DATA, "embeddings.json");
const DELETIONS = join(DATA, "deletions.json");

const read = (p, fallback) =>
  existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : fallback;

export const loadChunks = () => read(CHUNKS, []);
export const loadEmbeddings = () => read(EMBEDDINGS, []);
export const loadDeletions = () => read(DELETIONS, []);

const write = (p, data) => writeFileSync(p, JSON.stringify(data, null, 2));

/**
 * Erase a person from the archive. This removes whole chunks they authored or are named in —
 * not a query-time filter, which the challenge brief explicitly rules out.
 *
 * Returns a receipt of exactly what went, so the deletion can be shown rather than claimed.
 */
export function forgetPerson(name) {
  const target = name.trim().toLowerCase();
  const chunks = loadChunks();
  const embeddings = loadEmbeddings();

  const mentions = (c) =>
    [c.author, ...(c.participants || []), ...(c.peopleMentioned || [])]
      .filter(Boolean)
      .some((p) => p.toLowerCase() === target) || c.text.toLowerCase().includes(target);

  const removed = chunks.filter(mentions);
  const kept = chunks.filter((c) => !mentions(c));
  const removedIds = new Set(removed.map((c) => c.id));

  // Surviving chunks keep their vectors — a vector does not change because an unrelated
  // chunk left. Only the removed ones are dropped, so no re-embedding call is needed.
  const keptEmbeddings = embeddings.filter((e) => !removedIds.has(e.id));

  write(CHUNKS, kept);
  write(EMBEDDINGS, keptEmbeddings);

  const receipt = {
    person: name.trim(),
    at: new Date().toISOString(),
    chunksRemoved: removed.length,
    chunksRemaining: kept.length,
    embeddingsRemoved: embeddings.length - keptEmbeddings.length,
    documentsAffected: [...new Set(removed.map((c) => c.docId))],
    removedIds: [...removedIds],
  };

  write(DELETIONS, [...loadDeletions(), receipt]);
  return receipt;
}
