"use client";

import { useState } from "react";

const C = {
  dim: "#9aa3ad",
  faint: "#6b7280",
  line: "#1f242b",
  panel: "#12161b",
  accent: "#7cc4ff",
  warn: "#ffb86b",
};

export default function Home() {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState({});

  async function ask(e) {
    e.preventDefault();
    if (!question.trim()) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const json = await res.json();
      if (json.error) setError(json.error);
      else setResult(json);
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: "56px 24px 96px" }}>
      <h1 style={{ fontSize: 28, margin: 0 }}>Memory With a Receipt</h1>
      <p style={{ color: C.dim, marginTop: 8, lineHeight: 1.6 }}>
        Answers from the Acme Org archive — 45 documents, March 2024 to July 2026. Every claim
        carries the excerpt it came from.
      </p>

      <form onSubmit={ask} style={{ marginTop: 28, display: "flex", gap: 8 }}>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="What service levels were agreed for ordering?"
          style={{
            flex: 1, padding: "12px 14px", borderRadius: 8, fontSize: 15,
            background: C.panel, border: `1px solid ${C.line}`, color: "inherit",
          }}
        />
        <button
          disabled={busy}
          style={{
            padding: "12px 20px", borderRadius: 8, fontSize: 15, cursor: "pointer",
            background: busy ? C.line : C.accent, color: busy ? C.dim : "#06223a",
            border: "none", fontWeight: 600,
          }}
        >
          {busy ? "Reading…" : "Ask"}
        </button>
      </form>

      {error && (
        <p style={{ marginTop: 20, color: C.warn }}>
          {error}
        </p>
      )}

      {result && (
        <section style={{ marginTop: 32 }}>
          {result.insufficientEvidence && (
            <div
              style={{
                padding: "10px 14px", borderRadius: 8, marginBottom: 16,
                background: "#2a1f0f", border: `1px solid ${C.warn}`, color: C.warn, fontSize: 14,
              }}
            >
              The archive does not fully answer this.
            </div>
          )}

          <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7, fontSize: 15.5 }}>
            {result.answer}
          </div>

          {result.caveats?.length > 0 && (
            <ul style={{ marginTop: 20, color: C.warn, fontSize: 14, lineHeight: 1.6 }}>
              {result.caveats.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          )}

          <h2 style={{ fontSize: 13, letterSpacing: 0.8, textTransform: "uppercase", color: C.faint, marginTop: 36 }}>
            Receipts ({result.citations.length})
          </h2>

          {result.citations.map((c) => (
            <div
              key={c.id}
              style={{ border: `1px solid ${C.line}`, borderRadius: 8, padding: 14, marginTop: 10, background: C.panel }}
            >
              <div style={{ fontSize: 13, color: C.accent, fontFamily: "ui-monospace, monospace" }}>
                {c.docId}
              </div>
              <div style={{ fontSize: 13, color: C.faint, marginTop: 4 }}>
                {c.position} · {c.date}
                {c.speakerAmbiguous
                  ? " · speaker unidentified"
                  : c.author ? ` · ${c.author}` : ""}
              </div>
              {c.supports && (
                <div style={{ fontSize: 14, marginTop: 8, color: C.dim }}>{c.supports}</div>
              )}
              <button
                onClick={() => setOpen((o) => ({ ...o, [c.id]: !o[c.id] }))}
                style={{
                  marginTop: 10, fontSize: 12, background: "none", cursor: "pointer",
                  border: `1px solid ${C.line}`, borderRadius: 6, padding: "4px 10px", color: C.dim,
                }}
              >
                {open[c.id] ? "Hide source" : "Show source"}
              </button>
              {open[c.id] && (
                <pre
                  style={{
                    marginTop: 10, marginBottom: 0, whiteSpace: "pre-wrap", fontSize: 13,
                    lineHeight: 1.6, color: C.dim, maxHeight: 320, overflow: "auto",
                  }}
                >
                  {c.text}
                </pre>
              )}
            </div>
          ))}

          {result.hallucinatedCitations?.length > 0 && (
            <p style={{ marginTop: 16, fontSize: 13, color: C.warn }}>
              {result.hallucinatedCitations.length} citation(s) referenced excerpts that were
              never retrieved, and were dropped rather than shown.
            </p>
          )}
        </section>
      )}
    </main>
  );
}
