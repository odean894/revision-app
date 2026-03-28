import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

const SANDBOX_DIR = path.join(process.cwd(), 'sandbox');

function safeFolderName(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, '_').trim() || 'Unnamed';
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const fileId = formData.get('fileId') as string | null;
    const moduleName = formData.get('moduleName') as string | null;
    const fileName = formData.get('fileName') as string | null;
    const week = formData.get('week') as string | null;

    if (!file || !fileId || !moduleName || !fileName || typeof file === 'string') {
      return NextResponse.json({ error: 'Missing file, fileId, moduleName, or fileName' }, { status: 400 });
    }

    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const folderName = safeFolderName(moduleName);
    const dir = week
      ? path.join(SANDBOX_DIR, folderName, `Week ${week}`)
      : path.join(SANDBOX_DIR, folderName);
    await mkdir(dir, { recursive: true });

    const filePath = path.join(dir, `${fileId}_${safeName}`);
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    return NextResponse.json({ ok: true, path: filePath });
  } catch (err) {
    console.error('Save sandbox file error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
