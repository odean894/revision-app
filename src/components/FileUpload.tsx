'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Sparkles, Loader2 } from 'lucide-react';
import { addFile, addNote } from '@/lib/data';
import type { UploadedFile } from '@/lib/db';
import { extractTextFromPDF } from '@/lib/pdf';
import { generateNotes } from '@/lib/api';

type FileType = 'slides' | 'tutorial' | 'pastpaper';

interface Props {
  moduleId: string;
  moduleName: string;
  files: UploadedFile[];
  onRefresh: () => void;
  onNotesRefresh: () => void;
  userId: string | null;
}

const LABELS: Record<FileType, string> = {
  slides: 'Lecture slides',
  tutorial: 'Tutorial Q&A',
  pastpaper: 'Past paper',
};

export default function FileUpload({ moduleId, moduleName, files, onRefresh, onNotesRefresh, userId }: Props) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);
  const [generateStatus, setGenerateStatus] = useState('');
  const [fileType, setFileType] = useState<FileType>('slides');

  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      alert('Please upload PDF files only.');
      return;
    }
    setUploading(true);
    try {
      const text = await extractTextFromPDF(file);
      const id = crypto.randomUUID();
      const uploaded: UploadedFile = {
        id,
        moduleId,
        type: fileType,
        name: file.name,
        content: text,
        uploadedAt: Date.now(),
      };
      await addFile(uploaded, userId);
      onRefresh();
    } catch (err) {
      console.error(err);
      alert('Failed to extract text from PDF. Make sure it is not scanned/image-based.');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const generateNote = async (file: UploadedFile) => {
    setGenerating(file.id);
    const steps = [
      'Reading your content...',
      'Sending to AI...',
      'Analysing key concepts...',
      'Creating headings & structure...',
      'Adding definitions & bullet points...',
      'Writing exam-focused notes...',
      'Almost there...',
      'Finalising your notes...',
    ];
    let stepIndex = 0;
    setGenerateStatus(steps[0]);
    const statusInterval = setInterval(() => {
      stepIndex = (stepIndex + 1) % steps.length;
      setGenerateStatus(steps[stepIndex]);
    }, 4000);
    try {
      const notes = await generateNotes(file.content, LABELS[file.type]);
      setGenerateStatus('Saving to your notes...');
      const noteId = crypto.randomUUID();
      await addNote(
        {
          id: noteId,
          moduleId,
          sourceFileId: file.id,
          topic: file.name.replace(/\.pdf$/i, ''),
          content: notes,
          createdAt: Date.now(),
        },
        userId
      );
      onNotesRefresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to generate notes');
    } finally {
      clearInterval(statusInterval);
      setGenerating(null);
      setGenerateStatus('');
    }
  };

  const grouped = files.reduce<Record<FileType, UploadedFile[]>>(
    (acc, f) => {
      acc[f.type].push(f);
      return acc;
    },
    { slides: [], tutorial: [], pastpaper: [] }
  );

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-xl text-ink mb-4">Upload content</h2>
        <div className="flex gap-2 mb-4 flex-wrap">
          {(['slides', 'tutorial', 'pastpaper'] as FileType[]).map((t) => (
            <button
              key={t}
              onClick={() => setFileType(t)}
              className={`px-4 py-2 rounded-lg border transition ${
                fileType === t
                  ? 'border-accent bg-accent/10 text-accent-dark'
                  : 'border-ink/20 text-ink/70 hover:border-ink/40'
              }`}
            >
              {LABELS[t]}
            </button>
          ))}
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-10 text-center transition ${
            dragging ? 'border-accent bg-accent/5' : 'border-sage/30 bg-parchment/30'
          } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
        >
          <input
            type="file"
            accept=".pdf"
            onChange={handleInput}
            className="hidden"
            id="file-input"
          />
          <label htmlFor="file-input" className="cursor-pointer block">
            {uploading ? (
              <Loader2 className="w-12 h-12 mx-auto text-sage animate-spin mb-3" />
            ) : (
              <FileText className="w-12 h-12 mx-auto text-sage/70 mb-3" />
            )}
            <p className="text-ink font-medium mb-1">
              {uploading ? 'Processing PDF...' : `Drop a PDF or click to upload (${LABELS[fileType]})`}
            </p>
            <p className="text-sm text-ink/50">PDF files only • Text will be extracted for AI notes</p>
          </label>
        </div>
      </div>

      <div>
        <h2 className="font-display text-xl text-ink mb-4">Your uploaded files</h2>
        {files.length === 0 ? (
          <p className="text-ink/50 py-6">No files uploaded yet. Upload lecture slides, tutorial Q&A, or past papers above.</p>
        ) : (
          <div className="space-y-4">
            {(['slides', 'tutorial', 'pastpaper'] as FileType[]).map((type) =>
              grouped[type].length > 0 ? (
                <div key={type}>
                  <h3 className="text-sm font-medium text-ink/60 mb-2">{LABELS[type]}</h3>
                  <div className="space-y-2">
                    {grouped[type].map((file) => (
                      <motion.div
                        key={file.id}
                        layout
                        className="flex items-center justify-between p-4 rounded-lg bg-white border border-ink/10"
                      >
                        <FileText className="w-5 h-5 text-sage shrink-0 mr-3" />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-ink truncate">{file.name}</p>
                          <p className="text-xs text-ink/50">
                            {Math.ceil(file.content.length / 1000)}k chars extracted
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <button
                            onClick={() => generateNote(file)}
                            disabled={!!generating}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white hover:bg-accent-dark disabled:opacity-50"
                          >
                            {generating === file.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Sparkles className="w-4 h-4" />
                            )}
                            {generating === file.id ? 'Generating...' : 'Generate notes'}
                          </button>
                          {generating === file.id && generateStatus && (
                            <span className="text-xs text-ink/50">{generateStatus}</span>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              ) : null
            )}
          </div>
        )}
      </div>
    </div>
  );
}
