import { NextRequest, NextResponse } from 'next/server';
import { unlink } from 'fs/promises';
import path from 'path';

const SANDBOX_DIR = path.join(process.cwd(), 'sandbox');

function safeFolderName(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, '_').trim() || 'Unnamed';
}

export async function POST(req: NextRequest) {
  try {
    let body: { fileId?: string; moduleName?: string; fileName?: string; week?: number };
    try {
      const raw = await req.text();
      if (!raw?.trim()) {
        return NextResponse.json({ error: 'Request body is empty' }, { status: 400 });
      }
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const { fileId, moduleName, fileName, week } = body;
    if (!fileId || !moduleName || !fileName) {
      return NextResponse.json({ error: 'Missing fileId, moduleName, or fileName' }, { status: 400 });
    }

    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const folderName = safeFolderName(moduleName);
    const filePath = week
      ? path.join(SANDBOX_DIR, folderName, `Week ${week}`, `${fileId}_${safeName}`)
      : path.join(SANDBOX_DIR, folderName, `${fileId}_${safeName}`);

    await unlink(filePath);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === 'ENOENT') {
      return NextResponse.json({ ok: true });
    }
    console.error('Delete sandbox file error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
