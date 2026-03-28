import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const SANDBOX_DIR = path.join(process.cwd(), 'sandbox');
const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 60;
const BODY_SIZE = 11;
const H2_SIZE = 14;
const H3_SIZE = 12;
const TITLE_SIZE = 18;
const LINE_HEIGHT = 1.35;
const PARA_SPACING = 8;
const HEADING_SPACING = 12;

function safeFolderName(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, '_').trim() || 'Unnamed';
}

function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._\s-]/g, '_').replace(/\s+/g, ' ').trim() || 'notes';
}

const SUBSCRIPT_MAP: Record<string, string> = {
  '\u2080': '0', '\u2081': '1', '\u2082': '2', '\u2083': '3', '\u2084': '4',
  '\u2085': '5', '\u2086': '6', '\u2087': '7', '\u2088': '8', '\u2089': '9',
};
const SUPERSCRIPT_MAP: Record<string, string> = {
  '\u2070': '0', '\u00B9': '1', '\u00B2': '2', '\u00B3': '3', '\u2074': '4',
  '\u2075': '5', '\u2076': '6', '\u2077': '7', '\u2078': '8', '\u2079': '9',
};
const SYMBOL_MAP: Record<string, string> = {
  '\u00D7': 'x', '\u00F7': '/', '\u2260': '!=', '\u2248': '~', '\u2264': '<=', '\u2265': '>=',
  '\u03B1': 'alpha', '\u03B2': 'beta', '\u03BC': 'mu', '\u03C3': 'sigma', '\u03B4': 'delta',
  '\u2013': '-', '\u2014': '-', '\u2011': '-', '\u00AD': '', '\u2010': '-',
  '\u201C': '"', '\u201D': '"', '\u2018': "'", '\u2019': "'",
  '\u00A0': ' ', '\u202F': ' ', '\u2009': ' ', '\u200B': '', '\u200C': '', '\uFEFF': '',
};

function toWinAnsiSafe(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const code = text.charCodeAt(i);
    if (SUBSCRIPT_MAP[c] !== undefined) out += SUBSCRIPT_MAP[c];
    else if (SUPERSCRIPT_MAP[c] !== undefined) out += SUPERSCRIPT_MAP[c];
    else if (SYMBOL_MAP[c] !== undefined) out += SYMBOL_MAP[c];
    else if (code >= 32 && code <= 126) out += c;
    else if (code >= 160 && code <= 255) out += c;
    else if (c === '\n' || c === '\r' || c === '\t') out += c;
    else out += '?';
  }
  return out;
}

function cleanContentForReadability(text: string): string {
  return text
    .replace(/^---+\s*$/gm, '')
    .replace(/^===+\s*$/gm, '')
    .replace(/^___+\s*$/gm, '')
    .replace(/([a-zA-Z])\?([a-zA-Z0-9])/g, '$1 $2')
    .replace(/([a-zA-Z0-9])\?(\d)/g, '$1 $2')
    .replace(/(\d)\?(%)/g, '$1$2')
    .replace(/([a-zA-Z0-9])\?\s/g, '$1 ')
    .replace(/([.<>=])\?(\d)/g, '$1$2')
    .replace(/\s+\?\s+/g, ' ')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function parseTableRow(line: string): string[] | null {
  const t = line.trim();
  if (!t.startsWith('|') || !t.endsWith('|')) return null;
  const cells = t
    .slice(1, -1)
    .split('|')
    .map((c) => c.trim().replace(/\s+/g, ' '));
  return cells;
}

function isTableSeparator(cells: string[]): boolean {
  return cells.every((c) => /^[-:\s]+$/.test(c));
}

type Block = { type: 'title'; text: string } | { type: 'h2'; text: string } | { type: 'h3'; text: string } | { type: 'para'; text: string } | { type: 'bullet'; text: string } | { type: 'definition'; term: string; def: string };

function parseMarkdownBlocks(content: string): Block[] {
  const blocks: Block[] = [];
  const raw = cleanContentForReadability(content);
  const lines = raw.split(/\n/);

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    const tableCells = parseTableRow(line);
    if (tableCells) {
      if (isTableSeparator(tableCells)) {
        i++;
        continue;
      }
      if (tableCells.length >= 2 && tableCells[0].length > 0 && tableCells[1].length > 0) {
        const term = tableCells[0];
        const def = tableCells.slice(1).join(' ');
        if (!/^[-:\s]+$/.test(term)) {
          blocks.push({ type: 'definition', term, def });
        }
      }
      i++;
      continue;
    }

    if (trimmed.startsWith('> ')) {
      blocks.push({ type: 'para', text: trimmed.slice(2) });
      i++;
      continue;
    }

    if (trimmed.startsWith('## ')) {
      blocks.push({ type: 'h2', text: trimmed.slice(3).trim() });
      i++;
    } else if (trimmed.startsWith('### ')) {
      blocks.push({ type: 'h3', text: trimmed.slice(4).trim() });
      i++;
    } else if (trimmed.startsWith('# ')) {
      blocks.push({ type: 'h2', text: trimmed.slice(2).trim() });
      i++;
    } else if (/^\s*[-*]\s+/.test(line)) {
      blocks.push({ type: 'bullet', text: trimmed.replace(/^\s*[-*]\s+/, '') });
      i++;
    } else if (/^\s*\d+\.\s+/.test(line)) {
      blocks.push({ type: 'bullet', text: trimmed });
      i++;
    } else {
      let para = trimmed.replace(/#{1,6}\s*/g, '');
      while (i + 1 < lines.length && lines[i + 1].trim() && !lines[i + 1].trim().startsWith('#') && !/^\s*[-*]\s+/.test(lines[i + 1]) && !/^\s*\d+\.\s+/.test(lines[i + 1]) && !parseTableRow(lines[i + 1])) {
        i++;
        para += ' ' + lines[i].trim().replace(/#{1,6}\s*/g, '');
      }
      blocks.push({ type: 'para', text: para });
      i++;
    }
  }

  return blocks;
}

function breakIntoLines(
  text: string,
  font: { widthOfTextAtSize: (t: string, s: number) => number },
  fontSize: number,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    const width = font.widthOfTextAtSize(test, fontSize);
    if (width <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function POST(req: NextRequest) {
  try {
    let body: {
      modules: { id: string; name: string }[];
      notes: { id: string; moduleId: string; week?: number; topic: string; content: string }[];
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

    const { modules, notes } = body;
    if (!Array.isArray(modules) || !Array.isArray(notes)) {
      return NextResponse.json({ error: 'Missing modules or notes array' }, { status: 400 });
    }

    const moduleMap = new Map(modules.map((m) => [m.id, m.name]));
    let exported = 0;

    for (const note of notes) {
      const moduleName = moduleMap.get(note.moduleId);
      if (!moduleName || !note.content) continue;

      const folderName = safeFolderName(moduleName);
      const week = note.week ?? 1;
      const dir = path.join(SANDBOX_DIR, folderName, `Week ${week}`);
      await mkdir(dir, { recursive: true });

      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      let y = PAGE_HEIGHT - MARGIN;
      const maxWidth = PAGE_WIDTH - MARGIN * 2;

      const blocks: Block[] = [
        { type: 'title', text: note.topic },
        ...parseMarkdownBlocks(note.content),
      ];

      for (const block of blocks) {
        let fontSize: number;
        let useFont: { widthOfTextAtSize: (t: string, s: number) => number };
        let spacingAfter: number;
        let indent = 0;
        let wrapped: string[];
        let color = rgb(0.15, 0.15, 0.15);

        if (block.type === 'definition') {
          const safeTerm = toWinAnsiSafe(block.term);
          const safeDef = toWinAnsiSafe(block.def);
          if (!safeTerm.trim()) continue;
          fontSize = BODY_SIZE;
          useFont = font;
          indent = 0;
          spacingAfter = 6;
          const combined = `${safeTerm}: ${safeDef}`;
          wrapped = breakIntoLines(combined, useFont, fontSize, maxWidth);
        } else {
          const safeText = toWinAnsiSafe(block.text);
          if (!safeText.trim()) continue;

          switch (block.type) {
            case 'title':
              fontSize = TITLE_SIZE;
              useFont = boldFont;
              spacingAfter = 20;
              break;
            case 'h2':
              fontSize = H2_SIZE;
              useFont = boldFont;
              spacingAfter = HEADING_SPACING;
              color = rgb(0.15, 0.25, 0.4);
              break;
            case 'h3':
              fontSize = H3_SIZE;
              useFont = boldFont;
              spacingAfter = 8;
              color = rgb(0.15, 0.25, 0.4);
              break;
            case 'bullet':
              fontSize = BODY_SIZE;
              useFont = font;
              indent = 15;
              spacingAfter = 4;
              break;
            default:
              fontSize = BODY_SIZE;
              useFont = font;
              spacingAfter = PARA_SPACING;
          }

          const lineHeight = fontSize * LINE_HEIGHT;
          const isNumbered = /^\d+\.\s+/.test(safeText);
          const textToWrap = block.type === 'bullet' ? (isNumbered ? `    ${safeText}` : `  -  ${safeText}`) : safeText;
          wrapped = breakIntoLines(textToWrap, useFont, fontSize, maxWidth - indent);
        }

        const lineHeight = fontSize * LINE_HEIGHT;

        for (const wline of wrapped) {
          if (y < MARGIN + lineHeight) {
            page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
            y = PAGE_HEIGHT - MARGIN;
          }
          const drawFont = block.type === 'title' || block.type === 'h2' || block.type === 'h3' ? boldFont : font;
          page.drawText(wline, {
            x: MARGIN + indent,
            y,
            size: fontSize,
            font: drawFont,
            color,
          });
          y -= lineHeight;
        }
        y -= spacingAfter;
      }

      const pdfBytes = await pdfDoc.save();
      const fileName = `${safeFileName(note.topic)}.pdf`;
      const filePath = path.join(dir, fileName);
      await writeFile(filePath, pdfBytes);
      exported++;
    }

    return NextResponse.json({ ok: true, exported });
  } catch (err) {
    console.error('Export to sandbox error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
