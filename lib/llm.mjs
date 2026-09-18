// Provider-swappable LLM access. Keys are read at call time, not import time, so the app
// builds and deploys fine before a key exists.

const EMBED_MODEL = process.env.EMBED_MODEL || "text-embedding-3-small";
const CHAT_MODEL = process.env.CHAT_MODEL || "claude-sonnet-5";

function missingKey(which) {
  return new Error(
    `${which} is not set. Add it to .env.local (local) or the Vercel project settings (deployed).`
  );
}

// Only OpenAI is wired for embeddings — Anthropic does not serve an embeddings endpoint.
// Swap EMBED_BASE_URL to point at any OpenAI-compatible gateway (Azure, local, hackathon-provided).
export async function embedTexts(texts) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw missingKey("OPENAI_API_KEY");
  const base = process.env.EMBED_BASE_URL || "https://api.openai.com/v1";

  const res = await fetch(`${base}/embeddings`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: EMBED_MODEL, input: texts }),
  });
  if (!res.ok) throw new Error(`Embedding failed (${res.status}): ${await res.text()}`);
  const json = await res.json();
  return json.data.map((d) => d.embedding);
}

export async function chat({ system, user }) {
  if (process.env.ANTHROPIC_API_KEY) return chatAnthropic({ system, user });
  if (process.env.OPENAI_API_KEY) return chatOpenAI({ system, user });
  throw missingKey("ANTHROPIC_API_KEY or OPENAI_API_KEY");
}

async function chatAnthropic({ system, user }) {
  const base = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com/v1";
  const res = await fetch(`${base}/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      max_tokens: 2000,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error(`Chat failed (${res.status}): ${await res.text()}`);
  const json = await res.json();
  return json.content.map((c) => c.text || "").join("");
}

async function chatOpenAI({ system, user }) {
  const base = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.CHAT_MODEL || "gpt-4o",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Chat failed (${res.status}): ${await res.text()}`);
  const json = await res.json();
  return json.choices[0].message.content;
}
