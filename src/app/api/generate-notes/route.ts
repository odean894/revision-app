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
    let body: { text?: string; topic?: string };
    try {
      const raw = await req.text();
      if (!raw?.trim()) {
        return NextResponse.json({ error: 'Request body is empty' }, { status: 400 });
      }
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    const { text, topic } = body;
    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 });
    }

    const truncated = text.slice(0, 8000);
    const prompt = topic
      ? `Create detailed revision notes from this ${topic} content. Structure with clear headings, bullet points, key definitions, and important concepts. Make it easy to study and remember for exams.`
      : `Create detailed revision notes from this lecture/tutorial content. Structure with clear headings, bullet points, key definitions, formulas (if any), and important concepts. Make it comprehensive and exam-ready.`;

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
          content:
            'You are an expert university tutor. Create clear, comprehensive revision notes from the provided content. Use markdown formatting with headings (##), bullet points, bold for key terms.',
        },
        {
          role: 'user',
          content: `${prompt}\n\n---\n\nContent:\n\n${truncated}`,
        },
      ],
      temperature: 0.4,
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
