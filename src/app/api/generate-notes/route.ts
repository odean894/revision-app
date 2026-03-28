import { NextRequest, NextResponse } from 'next/server';

// Support both OpenRouter (free, reliable) and Groq - OpenRouter preferred
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
    return {
      url: OPENROUTER_API,
      key: openRouterKey,
      models: OPENROUTER_MODELS,
    };
  }
  const groqKey = process.env.GROQ_API_KEY?.trim();
  if (groqKey && groqKey.startsWith('gsk_')) {
    return {
      url: GROQ_API,
      key: groqKey,
      models: [GROQ_MODEL],
    };
  }
  return null;
}

export async function POST(req: NextRequest) {
  const config = getApiConfig();
  if (!config) {
    const hasOr = !!process.env.OPENROUTER_API_KEY?.trim();
    const hasGroq = !!process.env.GROQ_API_KEY?.trim();
    let hint = 'Add OPENROUTER_API_KEY (starts with sk-or-) or GROQ_API_KEY (starts with gsk_) to env.local.';
    if (hasOr || hasGroq) {
      hint = 'Key format invalid. OpenRouter keys start with sk-or-, Groq keys start with gsk_. Run npm run setup-env and restart the dev server.';
    }
    return NextResponse.json(
      { error: `No valid API key. ${hint} Get a free OpenRouter key at openrouter.ai/keys` },
      { status: 500 }
    );
  }

  try {
    let body: { text?: string; topic?: string; isTutorial?: boolean };
    try {
      const raw = await req.text();
      if (!raw?.trim()) {
        return NextResponse.json({ error: 'Request body is empty' }, { status: 400 });
      }
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    const { text, topic, isTutorial } = body;
    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 });
    }

    const truncated = text.slice(0, 32000);

    let systemPrompt: string;
    let userPrompt: string;

    if (isTutorial) {
      systemPrompt =
        `You are a patient tutor creating exam-ready study notes from tutorial Q&A documents. The answers and numbers MUST come from the document - do not invent or change them. But present everything in a clear, readable format that helps the student understand how to tackle similar questions in an exam.

For each question in the document, structure your output as:

## Question
State the question clearly (from the document).

## Given / Key info (use a table when helpful)
| Variable | Value |
|----------|-------|
| ... | ... |

## Step-by-step solution
Number each step (Step 1, Step 2, ...). For EACH step:
- What to do (the action)
- Why (the concept or rule)
- The result (use the numbers/answers from the document - do not change them)

## Final answer
The answer exactly as in the document (same numbers, same units).

## Exam tip
One sentence on how to approach this type of question in the exam.

FORMATTING: Use markdown ## headings, tables (| col | col |), numbered steps (Step 1, Step 2...), bullet points, bold for key terms. Add blank lines between sections. If the question has parts (a), (b), (c), give separate step-by-step for each part. Keep it readable and well-spaced. Use standard hyphens (-) and avoid special Unicode characters.`;
      userPrompt = `Create clear, exam-ready study notes from this tutorial document. For each question: (1) State the question. (2) Use a table for given values if applicable. (3) Give numbered step-by-step instructions that explain each part - what to do, why, and the result. Use the exact answers and numbers from the document. (4) End with the final answer from the document. (5) Add a brief exam tip. Make it readable and easy to follow.\n\n---\n\nDocument content:\n\n${truncated}`;
    } else {
      systemPrompt =
        'You are an expert university tutor. Create clear, comprehensive revision notes from the provided content. Use markdown formatting: headings (##, ###), bullet points (-), tables (| Term | Definition |), bold for key terms (**term**). Use standard hyphens (-) and avoid special Unicode characters. Format definitions in tables where helpful.';
      userPrompt = topic
        ? `Create detailed revision notes from this ${topic} content. Structure with clear headings, bullet points, key definitions, and important concepts. Make it easy to study and remember for exams.\n\n---\n\nContent:\n\n${truncated}`
        : `Create detailed revision notes from this lecture/tutorial content. Structure with clear headings, bullet points, key definitions, formulas (if any), and important concepts. Make it comprehensive and exam-ready.\n\n---\n\nContent:\n\n${truncated}`;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.key}`,
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'Revision Hub',
    };

    const payload = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: isTutorial ? 0.2 : 0.4,
    };

    let lastError = '';
    for (const model of config.models) {
      const res = await fetch(config.url, {
        method: 'POST',
        headers,
        cache: 'no-store',
        body: JSON.stringify({ ...payload, model }),
      });

      if (res.ok) {
        const data = await res.json();
        const notes = data.choices?.[0]?.message?.content || '';
        return NextResponse.json({ notes });
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
      errMsg += ' All free models are busy. Wait a minute and try again, or use a shorter PDF.';
    }
    return NextResponse.json({ error: errMsg }, { status: 500 });
  } catch (err: unknown) {
    console.error('Generate notes error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
