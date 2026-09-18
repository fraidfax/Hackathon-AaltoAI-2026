// Brute-force cosine search. At ~200 chunks this is sub-millisecond, and it is the reason
// deletion is a filter instead of a fight with a vector database.
import { loadChunks, loadEmbeddings } from "./store.mjs";

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

export function search(queryVector, k = 8) {
  const chunks = loadChunks();
  const byId = new Map(chunks.map((c) => [c.id, c]));

  return loadEmbeddings()
    // A vector whose chunk is gone must never surface. Deletion removes both, so this is
    // belt-and-braces against a half-applied delete.
    .filter((e) => byId.has(e.id))
    .map((e) => ({ chunk: byId.get(e.id), score: cosine(queryVector, e.vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

export const archiveStats = () => {
  const chunks = loadChunks();
  return {
    chunks: chunks.length,
    documents: new Set(chunks.map((c) => c.docId)).size,
    embedded: loadEmbeddings().length,
  };
};
