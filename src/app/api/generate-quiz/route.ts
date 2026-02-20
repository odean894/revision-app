import { NextRequest, NextResponse } from 'next/server';

const OPENROUTER_API = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_MODELS = [
  'openai/gpt-oss-20b:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'meta-llama/llama-3.2-3b-instruct:free',
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
      {
        error:
          'No API key configured. Add OPENROUTER_API_KEY or GROQ_API_KEY to env.local. Get a free OpenRouter key at openrouter.ai/keys',
      },
      { status: 500 }
    );
  }

  try {
    let body: { text?: string; count?: number };
    try {
      const raw = await req.text();
      if (!raw?.trim()) {
        return NextResponse.json({ error: 'Request body is empty' }, { status: 400 });
      }
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    const { text, count = 5 } = body;
    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 });
    }

    const truncated = text.slice(0, 6000);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.key}`,
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'Revision Hub',
    };

    const payload = {
      messages: [
        {
          role: 'system',
          content: `You are an exam prep assistant. Generate exactly ${count} multiple choice questions from the content.
Return ONLY valid JSON in this exact format:
{"questions":[{"question":"...","options":["A","B","C","D"],"correctIndex":0,"explanation":"..."}]}
correctIndex is 0-3 for the correct option. Make questions challenging and exam-relevant.`,
        },
        { role: 'user', content: truncated },
      ],
      temperature: 0.6,
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
        const content = data.choices?.[0]?.message?.content || '{}';
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { questions: [] };

        if (!Array.isArray(parsed.questions)) {
          return NextResponse.json({ error: 'Invalid quiz format' }, { status: 500 });
        }

        return NextResponse.json({
          questions: parsed.questions.slice(0, count).map((q: { question: string; options: string[]; correctIndex: number; explanation?: string }) => ({
            question: q.question,
            options: Array.isArray(q.options) ? q.options : [],
            correctIndex: typeof q.correctIndex === 'number' ? q.correctIndex : 0,
            explanation: q.explanation || '',
          })),
        });
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
      errMsg += ' All free models busy. Wait a minute and try again.';
    }
    return NextResponse.json({ error: errMsg }, { status: 500 });
  } catch (err: unknown) {
    console.error('Generate quiz error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
