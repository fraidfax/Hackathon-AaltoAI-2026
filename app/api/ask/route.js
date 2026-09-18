import { answerQuestion } from "../../../lib/answer.mjs";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const { question } = await request.json();
  if (!question?.trim()) {
    return Response.json({ error: "Ask a question." }, { status: 400 });
  }

  try {
    return Response.json(await answerQuestion(question.trim()));
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
