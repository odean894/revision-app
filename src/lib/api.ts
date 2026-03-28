'use client';

const MAX_TEXT_LENGTH = 32000;
const MAX_PER_DOC = 8000;

export async function generateNotes(
  text: string,
  topic?: string,
  options?: { isTutorial?: boolean }
): Promise<string>;
export async function generateNotes(
  documents: { text: string; label: string }[],
  topic?: string,
  options?: { isTutorial?: boolean }
): Promise<string>;
export async function generateNotes(
  textOrDocs: string | { text: string; label: string }[],
  topic?: string,
  options?: { isTutorial?: boolean }
): Promise<string> {
  let text: string;
  let topicParam: string | undefined;
  if (typeof textOrDocs === 'string') {
    text = textOrDocs.slice(0, MAX_TEXT_LENGTH);
    topicParam = topic;
  } else {
    const combined = textOrDocs
      .map((d) => `## ${d.label}\n\n${d.text.slice(0, MAX_PER_DOC)}`)
      .join('\n\n---\n\n');
    text = combined.slice(0, MAX_TEXT_LENGTH);
    topicParam = topic ?? (textOrDocs.length > 0 ? 'combined week materials' : undefined);
  }
  const res = await fetch('/api/generate-notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, topic: topicParam, isTutorial: options?.isTutorial }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to generate notes');
  }
  const data = await res.json();
  return data.notes;
}

export async function generateQuiz(text: string, count = 5): Promise<{
  questions: { question: string; options: string[]; correctIndex: number; explanation?: string }[];
}> {
  const truncated = text.slice(0, 8000);
  const res = await fetch('/api/generate-quiz', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: truncated, count }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to generate quiz');
  }
  return res.json();
}
