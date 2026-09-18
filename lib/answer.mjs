import { embedTexts, chat } from "./llm.mjs";
import { search } from "./retrieve.mjs";

const SYSTEM = `You answer questions about the Acme Org archive: a year and a half of meeting
transcripts, email threads and status reports from a software rollout. You will be scored by
the people who wrote the archive, and they check every citation by hand.

You are given numbered EXCERPTS. They are the only thing you know. You have no other memory
of this project.

RULES, in order of how much they cost you when broken.

1. CITE EVERYTHING. Every factual claim carries the id of the excerpt it came from. A claim
   with no citation is treated as a guess. Never cite an id that is not in the excerpts below.

2. NEVER INVENT. If the excerpts do not answer the question, say plainly that the archive does
   not say, and state what you would need in order to answer. This scores better than a
   plausible answer. The archive contains places where a speaker begins a number and is cut
   off mid-sentence — if you complete that number you have fabricated a source. Quote the
   fragment and say it is incomplete.

3. SUGGESTION IS NOT AGREEMENT. Distinguish, every time, between: someone proposed something,
   someone agreed to it, and nobody ever did. A consultant floating an idea is not the
   customer committing to it. If a thing was proposed and you cannot find anyone agreeing,
   say exactly that.

4. STALE IS NOT WRONG. Two different failures live here. A value that was true and was later
   superseded is STALE — give the current value, and say what it replaced and when. A value
   that was recorded and was never true is WRONG — say it was never correct, and do not
   repeat it as if it were once valid. Sorting by date finds the first kind only. When a
   figure appears more than once, list every occurrence with its date and source, then say
   which one stands today.

5. SOME SPEAKERS ARE UNIDENTIFIABLE. Excerpts marked SPEAKER UNIDENTIFIED come from meetings
   recorded on a laptop, labelled only "Me" and "Them", with three people present. You cannot
   tell who spoke. Never attribute those words to a named person. Attribute them to the
   meeting.

Answer in this JSON shape and nothing else:

{
  "answer": "prose, with excerpt ids in square brackets after each claim, e.g. [emails/07_op-id-field-exclusion#m2]",
  "citations": [{"id": "<excerpt id>", "supports": "<the specific claim it backs>"}],
  "insufficientEvidence": <true if the archive does not answer the question>,
  "caveats": ["anything the reader should distrust about this answer"]
}`;

const renderExcerpt = ({ chunk }) => {
  const head = [
    `id: ${chunk.id}`,
    `document: ${chunk.docId} (${chunk.docType})`,
    `title: ${chunk.title}`,
    `date: ${chunk.date || "unknown"}`,
    `position: ${chunk.position}`,
    chunk.author ? `author: ${chunk.author}` : null,
    chunk.speakerAmbiguous ? `SPEAKER UNIDENTIFIED — do not attribute to a name` : null,
  ]
    .filter(Boolean)
    .join("\n");
  return `--- EXCERPT ---\n${head}\n\n${chunk.text}`;
};

function parseJson(raw) {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : raw;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error(`Model did not return JSON: ${raw.slice(0, 200)}`);
  return JSON.parse(body.slice(start, end + 1));
}

export async function answerQuestion(question, { k = 8 } = {}) {
  const [queryVector] = await embedTexts([question]);
  const hits = search(queryVector, k);

  if (!hits.length) {
    return {
      answer: "The archive is empty — nothing has been indexed, or everything has been deleted.",
      citations: [],
      insufficientEvidence: true,
      caveats: [],
      retrieved: [],
    };
  }

  const raw = await chat({
    system: SYSTEM,
    user: `QUESTION: ${question}\n\n${hits.map(renderExcerpt).join("\n\n")}`,
  });

  const parsed = parseJson(raw);

  // The model can cite an id that was never in front of it. Verify every citation against
  // what was actually retrieved and drop the rest — an unverifiable citation is the one thing
  // the judges check by hand.
  const available = new Map(hits.map((h) => [h.chunk.id, h.chunk]));
  const citations = [];
  const dropped = [];
  for (const c of parsed.citations || []) {
    const chunk = available.get(c.id);
    if (!chunk) {
      dropped.push(c.id);
      continue;
    }
    citations.push({
      id: c.id,
      supports: c.supports,
      docId: chunk.docId,
      title: chunk.title,
      date: chunk.date,
      position: chunk.position,
      author: chunk.author,
      speakerAmbiguous: !!chunk.speakerAmbiguous,
      text: chunk.text,
    });
  }

  return {
    answer: parsed.answer,
    citations,
    insufficientEvidence: !!parsed.insufficientEvidence,
    caveats: parsed.caveats || [],
    hallucinatedCitations: dropped,
    retrieved: hits.map((h) => ({ id: h.chunk.id, score: Number(h.score.toFixed(4)) })),
  };
}
