import { NextRequest, NextResponse } from 'next/server';

const OPENROUTER_API = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_MODELS = [
  'openai/gpt-oss-20b:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'meta-llama/llama-3.2-3b-instruct:free',
  'arcee-ai/trinity-large-preview:free',
  'stepfun/step-3.5-flash:free',
];
const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.1-8b-instant';

function getApiConfig() {
  const openRouterKey = process.env.OPENROUTER_API_KEY?.trim();
  if (openRouterKey && openRouterKey.startsWith('sk-or-')) {
    return { url: OPENROUTER_API, key: openRouterKey, models: OPENROUTER_MODELS };
  }
  const groqKey = process.env.GROQ_API_KEY?.trim();
  if (groqKey && groqKey.startsWith('gsk_')) {
    return { url: GROQ_API, key: groqKey, models: [GROQ_MODEL] };
  }
  return null;
}

export async function POST(req: NextRequest) {
  const config = getApiConfig();
  if (!config) {
    return NextResponse.json(
      { error: 'No valid API key. Add OPENROUTER_API_KEY or GROQ_API_KEY to env.local.' },
      { status: 500 }
    );
  }

  try {
    let body: {
      noteContent?: string;
      noteTopic?: string;
      sourceDocuments?: { text: string; label?: string }[];
      messages?: { role: 'user' | 'assistant'; content: string }[];
      question?: string;
    };
    try {
      const raw = await req.text();
      if (!raw?.trim()) {
        return NextResponse.json({ error: 'Request body is empty' }, { status: 400 });
      }
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const { noteContent, noteTopic, sourceDocuments, messages = [], question } = body;
    const hasSourceDocs = Array.isArray(sourceDocuments) && sourceDocuments.length > 0;
    const hasNoteContent = noteContent && typeof noteContent === 'string';
    if (!hasSourceDocs && !hasNoteContent) {
      return NextResponse.json({ error: 'Missing noteContent or sourceDocuments' }, { status: 400 });
    }
    if (!question || typeof question !== 'string' || !question.trim()) {
      return NextResponse.json({ error: 'Missing question' }, { status: 400 });
    }

    const truncate = (s: string, max = 12000) => s.slice(0, max);
    let contextBlock: string;
    if (hasSourceDocs) {
      const parts = sourceDocuments!.map((doc, i) => {
        const label = doc.label || `Document ${i + 1}`;
        const text = truncate(doc.text, 8000);
        return `### ${label}\n${text}`;
      });
      contextBlock = parts.join('\n\n---\n\n');
    } else {
      contextBlock = truncate(noteContent!);
    }
    const systemContent = hasSourceDocs
      ? `You are a patient tutor helping a student with their tutorial/past paper materials. The student is studying: "${noteTopic || 'their materials'}".

The OFFICIAL DOCUMENTS (tutorial Q&A, past paper solutions, etc.) - these are the ONLY source of correct answers:
---
${contextBlock}
---

RULES:
1. Use ONLY the questions and answers from the documents - same numbers, formulas, and conclusions. Do not invent answers.
2. Present in a clear, readable format. Use tables for given values, results, or comparisons.
3. Give numbered step-by-step instructions. For each step: what to do, why (the concept), and the result. This helps the student understand how to tackle the question in an exam.
4. If the question is not in the documents, say so. Do not make up an answer.

FORMATTING: Use ## Question, then ## Given (table: | Variable | Value |), then ## Step-by-step solution with Step 1, Step 2... (for each step: what to do, why, result), then ## Final answer (from document), then ## Exam tip. Add blank lines between sections. If the question has parts (a), (b), (c), address each part with its own steps. Use tables for any values or comparisons. Keep it readable and well-spaced. Use standard hyphens (-) and avoid special Unicode characters.`
      : `You are a patient, expert university tutor helping a student understand their materials. The student is studying: "${noteTopic || 'their revision notes'}".

The SOURCE MATERIAL the student is asking about:
---
${contextBlock}
---

Answer the student's questions clearly and helpfully based on the source material above. Explain step by step when needed. Reference specific parts of the documents when relevant. Be encouraging. Use markdown: headings (##), bullet points (-), bold for key terms (**term**). Use standard hyphens (-) and avoid special Unicode characters.`;

    const chatMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: systemContent },
      ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user', content: question.trim() },
    ];

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.key}`,
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'Revision Hub',
    };

    let lastError = '';
    for (const model of config.models) {
      const res = await fetch(config.url, {
        method: 'POST',
        headers,
        cache: 'no-store',
        body: JSON.stringify({
          messages: chatMessages,
          temperature: hasSourceDocs ? 0.2 : 0.5,
          model,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const reply = data.choices?.[0]?.message?.content || '';
        return NextResponse.json({ reply });
      }

      const errText = await res.text();
      try {
        const errJson = JSON.parse(errText);
        lastError = errJson.error?.message || errJson.message || errText;
      } catch {
        lastError = errText;
      }
      const isRateLimit =
        lastError.toLowerCase().includes('rate') ||
        lastError.toLowerCase().includes('temporarily') ||
        lastError.toLowerCase().includes('provider');
      if (!isRateLimit) break;
    }

    let errMsg = lastError || 'API request failed';
    if (errMsg.toLowerCase().includes('rate') || errMsg.toLowerCase().includes('provider')) {
      errMsg += ' Try again in a minute.';
    }
    return NextResponse.json({ error: errMsg }, { status: 500 });
  } catch (err: unknown) {
    console.error('Chat with note error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
