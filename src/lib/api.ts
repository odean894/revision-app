'use client';

const MAX_TEXT_LENGTH = 8000;

export async function generateNotes(text: string, topic?: string): Promise<string> {
  const truncated = text.slice(0, MAX_TEXT_LENGTH);
  const res = await fetch('/api/generate-notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: truncated, topic }),
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
