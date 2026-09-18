// Parses the Acme archive into citable chunks. Run: node scripts/ingest.mjs
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "fs";
import { join } from "path";

const CORPUS = "corpus/acme";
const OUT = "data/chunks.json";

// From corpus/acme/00_README.md. Used for mention detection and deletion targets.
const ROSTER = [
  "Lena Fischer", "Robert Kahn", "Sofia Almeida", "Priya Nair", "Jonas Weiss",
  "Katarina Voss", "Marco Rossi", "Ana Duarte", "Nadia Haddad", "Tomas Lindholm",
  "Kwame Boateng", "Charlotte Meyer", "Henrik Sørensen", "Ivan Petrov", "Ruth Oyelaran",
];

// The README warns these appear in several forms, including Swedish. Matching one is a trap.
const IMAGE_PLACEHOLDER =
  /\[Image removed by sender\]|\[cid:[^\]]+\]|Bild borttagen av avsändaren|^\s*Image\s*$/gim;

const BANNER =
  /^This email originated from outside of RELEX\..*$/gim;

const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

const iso = (y, m, d) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

// Header dates read "Monday, November 24, 2025 17:55"; in-body update markers read "06-04-2026".
function parseDate(s) {
  if (!s) return null;
  const named = s.match(/([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/);
  if (named && MONTHS[named[1].toLowerCase()]) {
    return iso(named[3], MONTHS[named[1].toLowerCase()], named[2]);
  }
  const dmy = s.match(/\b(\d{2})-(\d{2})-(\d{4})\b/);
  if (dmy) return iso(dmy[3], dmy[2], dmy[1]);
  const already = s.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (already) return already[0];
  return null;
}

const clean = (t) =>
  t.replace(IMAGE_PLACEHOLDER, "").replace(BANNER, "")
    .replace(/\n{3,}/g, "\n\n").trim();

const namesIn = (text, extra = []) => {
  const found = new Set(extra.filter(Boolean));
  for (const n of ROSTER) if (text.includes(n)) found.add(n);
  return [...found];
};

// "Priya Nair <priya.nair@acme-org.example>; Lena Fischer <...>" -> ["Priya Nair", "Lena Fischer"]
const people = (field) =>
  !field ? [] : field.split(";").map((p) => p.replace(/<[^>]*>/g, "").trim()).filter(Boolean);

function stripSynthetic(raw) {
  return raw.replace(/\r\n/g, "\n").split("\n").filter((l) => !l.startsWith("***")).join("\n").trim();
}

// emails/ and reports/ share one Outlook format: newest message on top, each earlier
// message quoted beneath behind a "From:/Sent:" header. Splitting them apart is what keeps
// quoted text from being duplicated and attributed to the wrong sender.
function parseThread(raw, docId, docType, path) {
  const body = stripSynthetic(raw);
  const head = {};
  for (const k of ["Subject", "From", "Date", "To", "Cc"]) {
    const m = body.match(new RegExp(`^${k}:\\s*(.+)$`, "m"));
    if (m) head[k] = m[1].trim();
  }
  const title = (head.Subject || docId).replace(/^(Re|Fwd):\s*/i, "");

  const starts = [...body.matchAll(/^From:\s*(.+)$\n^Sent:\s*(.+)$/gm)];
  const firstEnd = starts.length ? starts[0].index : body.length;
  const headerEnd = body.search(/^Messages in thread:.*$/m);
  const firstBody = body.slice(
    headerEnd >= 0 ? body.indexOf("\n", headerEnd) : 0,
    firstEnd
  );

  const messages = [
    { from: head.From, date: head.Date, to: head.To, cc: head.Cc, text: firstBody },
  ];
  starts.forEach((m, i) => {
    const seg = body.slice(m.index, i + 1 < starts.length ? starts[i + 1].index : body.length);
    const f = (k) => (seg.match(new RegExp(`^${k}:\\s*(.+)$`, "m")) || [])[1];
    const afterHeaders = seg.replace(/^(From|Sent|To|Cc|Subject):.*$/gm, "");
    messages.push({ from: f("From"), date: f("Sent"), to: f("To"), cc: f("Cc"), text: afterHeaders });
  });

  const total = messages.length;
  return messages
    .map((msg, i) => {
      const text = clean(msg.text);
      if (!text) return null;
      const author = people(msg.from)[0] || null;
      const participants = [...people(msg.to), ...people(msg.cc)];
      return {
        id: `${docId}#m${total - i}`,
        docId, docType, path, title,
        date: parseDate(msg.date),
        // Newest is on top, so the oldest message is number 1 to a human reading the thread.
        position: `message ${total - i} of ${total}`,
        author,
        participants,
        peopleMentioned: namesIn(text, [author, ...participants]),
        text,
      };
    })
    .filter(Boolean);
}

// Teams export. Each utterance ends with a "Name 2 minutes 35 seconds" marker line,
// preceded by three lines of chrome (name, doubled timestamp, initials) belonging to it.
const MARKER = /^(.+?) ((?:\d+ hours? )?(?:\d+ minutes? )?\d+ seconds?)$/gm;

function parseTranscript(raw, docId, docType, path) {
  const body = stripSynthetic(raw);
  const field = (k) => (body.match(new RegExp(`^${k}:\\s*(.+)$`, "m")) || [])[1]?.trim();
  const title = field("Meeting") || docId;
  const date = parseDate(field("Date"));
  const attendees = (field("Attendees") || "")
    .split(",").map((a) => a.replace(/\(.*?\)/g, "").trim()).filter(Boolean);

  const marks = [...body.matchAll(MARKER)];
  // The three INTERNAL meetings were recorded on a laptop, not Teams: "Me:"/"Them:" labels,
  // no timestamps. Three people attended but only two labels exist, so which named person
  // said any given line is genuinely unrecoverable. Flagged so the answer layer never
  // attributes a quote from these to a name.
  if (!marks.length) return parseLaptopTranscript(body, docId, docType, path, title, date, attendees);

  const utterances = [];
  marks.forEach((m, i) => {
    const start = m.index + m[0].length;
    const nextMark = i + 1 < marks.length ? marks[i + 1].index : body.length;
    // The next utterance's name/timestamp/initials sit just above its marker — drop them.
    const raw3 = body.slice(start, nextMark).split("\n");
    const text = (i + 1 < marks.length ? raw3.slice(0, -3) : raw3).join("\n").trim();
    if (text) utterances.push({ speaker: m[1].trim(), time: m[2].trim(), text });
  });

  // Utterances are fragmented mid-sentence, so single ones are useless out of context.
  // Group into ~1200-char windows and cite the time range.
  const chunks = [];
  let buf = [];
  const flush = () => {
    if (!buf.length) return;
    const text = buf.map((u) => `${u.speaker}: ${u.text}`).join("\n");
    const speakers = [...new Set(buf.map((u) => u.speaker))];
    chunks.push({
      id: `${docId}#t${chunks.length + 1}`,
      docId, docType, path, title, date,
      position: `${buf[0].time} – ${buf[buf.length - 1].time}`,
      author: speakers.length === 1 ? speakers[0] : null,
      participants: attendees,
      peopleMentioned: namesIn(text, [...speakers, ...attendees]),
      text,
    });
    buf = [];
  };
  for (const u of utterances) {
    buf.push(u);
    if (buf.map((b) => b.text).join(" ").length > 1200) flush();
  }
  flush();
  return chunks;
}

function parseLaptopTranscript(body, docId, docType, path, title, date, attendees) {
  const turns = [...body.matchAll(/^(Me|Them):\s*(.+)$/gm)].map((m) => ({
    label: m[1],
    text: m[2].trim(),
  }));

  const chunks = [];
  let buf = [];
  let startTurn = 1;
  const flush = () => {
    if (!buf.length) return;
    const text = buf.map((t) => `${t.label}: ${t.text}`).join("\n");
    const endTurn = startTurn + buf.length - 1;
    chunks.push({
      id: `${docId}#t${chunks.length + 1}`,
      docId, docType, path, title, date,
      position: `turns ${startTurn}–${endTurn}`,
      author: null,
      participants: attendees,
      peopleMentioned: namesIn(text, attendees),
      speakerAmbiguous: true,
      text,
    });
    startTurn = endTurn + 1;
    buf = [];
  };
  for (const t of turns) {
    buf.push(t);
    if (buf.map((b) => b.text).join(" ").length > 1200) flush();
  }
  flush();
  return chunks;
}

const files = [];
for (const dir of ["transcripts", "emails", "reports"]) {
  for (const f of readdirSync(join(CORPUS, dir)).filter((f) => f.endsWith(".txt"))) {
    files.push({ dir, path: join(CORPUS, dir, f), docId: `${dir}/${f.replace(/\.txt$/, "")}` });
  }
}

const chunks = files.flatMap(({ dir, path, docId }) => {
  const raw = readFileSync(path, "utf8");
  const type = dir === "transcripts" ? "transcript" : dir === "reports" ? "report" : "email";
  return type === "transcript"
    ? parseTranscript(raw, docId, type, path)
    : parseThread(raw, docId, type, path);
});

mkdirSync("data", { recursive: true });
writeFileSync(OUT, JSON.stringify(chunks, null, 2));

const undated = chunks.filter((c) => !c.date).length;
console.log(`${files.length} files -> ${chunks.length} chunks`);
for (const t of ["transcript", "email", "report"]) {
  const s = chunks.filter((c) => c.docType === t);
  console.log(`  ${t}: ${s.length} chunks, ${new Set(s.map((c) => c.docId)).size} docs`);
}
console.log(`undated chunks: ${undated}`);
console.log(`chunks with no author: ${chunks.filter((c) => !c.author).length}`);
