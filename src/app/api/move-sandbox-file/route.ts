import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, unlink, mkdir } from 'fs/promises';
import path from 'path';

const SANDBOX_DIR = path.join(process.cwd(), 'sandbox');

function safeFolderName(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, '_').trim() || 'Unnamed';
}

export async function POST(req: NextRequest) {
  try {
    let body: { fileId?: string; moduleName?: string; fileName?: string; fromWeek?: number; toWeek?: number };
    try {
      const raw = await req.text();
      if (!raw?.trim()) {
        return NextResponse.json({ error: 'Request body is empty' }, { status: 400 });
      }
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const { fileId, moduleName, fileName, fromWeek, toWeek } = body;
    if (!fileId || !moduleName || !fileName) {
      return NextResponse.json({ error: 'Missing fileId, moduleName, or fileName' }, { status: 400 });
    }

    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const folderName = safeFolderName(moduleName);

    const fromDir =
      fromWeek != null ? path.join(SANDBOX_DIR, folderName, `Week ${fromWeek}`) : path.join(SANDBOX_DIR, folderName);
    const toDir =
      toWeek != null ? path.join(SANDBOX_DIR, folderName, `Week ${toWeek}`) : path.join(SANDBOX_DIR, folderName);

    const fromPath = path.join(fromDir, `${fileId}_${safeName}`);
    const toPath = path.join(toDir, `${fileId}_${safeName}`);

    if (fromPath === toPath) return NextResponse.json({ ok: true });

    try {
      const buffer = await readFile(fromPath);
      await mkdir(toDir, { recursive: true });
      await writeFile(toPath, buffer);
      await unlink(fromPath);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code === 'ENOENT') return NextResponse.json({ ok: true });
      throw err;
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Move sandbox file error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
