import { forgetPerson, loadDeletions } from "../../../lib/store.mjs";
import { archiveStats } from "../../../lib/retrieve.mjs";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ deletions: loadDeletions(), archive: archiveStats() });
}

export async function POST(request) {
  const { person } = await request.json();
  if (!person?.trim()) {
    return Response.json({ error: "Name a person to erase." }, { status: 400 });
  }

  try {
    const receipt = forgetPerson(person);
    return Response.json({ receipt, archive: archiveStats() });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
