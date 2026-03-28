'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Sparkles, Loader2, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { addFile, addNote, deleteFile, deleteNotesForWeekAndType, updateFileWeek } from '@/lib/data';
import type { UploadedFile } from '@/lib/db';
import { extractTextFromPDF } from '@/lib/pdf';
import { generateNotes } from '@/lib/api';

type FileType = 'slides' | 'tutorial' | 'pastpaper';

const LABELS: Record<FileType, string> = {
  slides: 'Lecture slides',
  tutorial: 'Tutorial Q&A',
  pastpaper: 'Past paper',
};

const WEEKS = Array.from({ length: 11 }, (_, i) => i + 1);

interface Props {
  moduleId: string;
  moduleName: string;
  files: UploadedFile[];
  onRefresh: () => void;
  onNotesRefresh: () => void;
  userId: string | null;
}

export default function FileUpload({ moduleId, moduleName, files, onRefresh, onNotesRefresh, userId }: Props) {
  const [expandedWeek, setExpandedWeek] = useState<number | null>(1);
  const [fileType, setFileType] = useState<FileType>('slides');
  const [uploadingWeek, setUploadingWeek] = useState<number | null>(null);
  const [generatingKey, setGeneratingKey] = useState<string | null>(null);
  const [generateStatus, setGenerateStatus] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [moving, setMoving] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filesByWeek = WEEKS.reduce<Record<number, UploadedFile[]>>((acc, w) => {
    acc[w] = files.filter((f) => (f.week ?? 1) === w);
    return acc;
  }, {});

  const triggerUpload = (week: number) => {
    setExpandedWeek(week);
    setUploadingWeek(week);
    fileInputRef.current?.click();
  };

  const handleFile = async (file: File, week: number) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      alert('Please upload PDF files only.');
      setUploadingWeek(null);
      return;
    }
    try {
      const text = await extractTextFromPDF(file);
      const id = crypto.randomUUID();
      const uploaded: UploadedFile = {
        id,
        moduleId,
        week,
        type: fileType,
        name: file.name,
        content: text,
        uploadedAt: Date.now(),
      };
      await addFile(uploaded, userId);
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('fileId', id);
        formData.append('moduleName', moduleName);
        formData.append('week', String(week));
        formData.append('fileName', file.name);
        await fetch('/api/save-sandbox-file', {
          method: 'POST',
          body: formData,
        });
      } catch {
        /* sandbox save optional */
      }
      onRefresh();
    } catch (err) {
      console.error(err);
      alert('Failed to extract text from PDF. Make sure it is not scanned/image-based.');
    } finally {
      setUploadingWeek(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const week = uploadingWeek ?? 1;
    if (file) handleFile(file, week);
    e.target.value = '';
  };

  const generateNotesForWeekAndType = async (week: number, fileType: FileType) => {
    const weekFiles = (filesByWeek[week] ?? []).filter((f) => f.type === fileType);
    if (weekFiles.length === 0) {
      alert(`Upload at least one ${LABELS[fileType]} document for this week first.`);
      return;
    }
    const key = `${week}-${fileType}`;
    setGeneratingKey(key);
    const steps =
      fileType === 'tutorial'
        ? [
            'Reading Q&A content...',
            'Identifying questions and answers...',
            'Building step-by-step solutions...',
            'Explaining each step...',
            'Adding key takeaways...',
            'Finalising your study guide...',
          ]
        : [
            'Reading your documents...',
            'Combining content...',
            'Sending to AI...',
            'Analysing key concepts...',
            'Creating headings & structure...',
            'Writing exam-focused notes...',
            'Finalising...',
          ];
    let stepIndex = 0;
    setGenerateStatus(steps[0]);
    const statusInterval = setInterval(() => {
      stepIndex = (stepIndex + 1) % steps.length;
      setGenerateStatus(steps[stepIndex]);
    }, 4000);
    try {
      const documents = weekFiles.map((f) => ({
        text: f.content,
        label: f.name.replace(/\.pdf$/i, ''),
      }));
      const notes = await generateNotes(documents, LABELS[fileType], {
        isTutorial: fileType === 'tutorial',
      });
      setGenerateStatus('Saving...');
      await deleteNotesForWeekAndType(moduleId, week, fileType, userId);
      const noteId = crypto.randomUUID();
      await addNote(
        {
          id: noteId,
          moduleId,
          week,
          noteType: fileType,
          topic: `Week ${week} - ${LABELS[fileType]}`,
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
      setGeneratingKey(null);
      setGenerateStatus('');
    }
  };

  const handleMoveToWeek = async (file: UploadedFile, newWeek: number) => {
    const currentWeek = file.week ?? 1;
    if (newWeek === currentWeek) return;
    setMoving(file.id);
    try {
      await updateFileWeek(file.id, file.moduleId, newWeek, userId);
      try {
        await fetch('/api/move-sandbox-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileId: file.id,
            moduleName,
            fileName: file.name,
            fromWeek: currentWeek,
            toWeek: newWeek,
          }),
        });
      } catch {
        /* sandbox move optional */
      }
      onRefresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to move file');
    } finally {
      setMoving(null);
    }
  };

  const handleDelete = async (file: UploadedFile) => {
    if (!confirm(`Delete "${file.name}"? This cannot be undone.`)) return;
    setDeleting(file.id);
    try {
      await deleteFile(file.id, file.moduleId, file.name, userId);
      try {
        await fetch('/api/delete-sandbox-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileId: file.id,
            moduleName,
            fileName: file.name,
            week: file.week ?? 1,
          }),
        });
      } catch {
        /* sandbox delete optional */
      }
      onRefresh();
      onNotesRefresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete file');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        onChange={handleInput}
        className="hidden"
      />

      <h2 className="font-display text-xl text-ink mb-4">Upload by week</h2>
      <p className="text-ink/60 mb-6">
        Upload multiple documents per week. Generate notes separately for lectures, tutorials, and past papers so each stays distinct.
      </p>

      {WEEKS.map((week) => {
        const weekFiles = filesByWeek[week] ?? [];
        const isExpanded = expandedWeek === week;
        const isUploading = uploadingWeek === week;

        return (
          <motion.div
            key={week}
            layout
            className="rounded-xl bg-white border border-ink/10 overflow-hidden"
          >
            <button
              onClick={() => setExpandedWeek(isExpanded ? null : week)}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-parchment/30 transition"
            >
              <div className="flex items-center gap-3">
                <span className="font-display font-medium text-ink">Week {week}</span>
                {weekFiles.length > 0 && (
                  <span className="text-sm text-ink/50">
                    {weekFiles.length} file{weekFiles.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              {isExpanded ? (
                <ChevronUp className="w-5 h-5 text-ink/50" />
              ) : (
                <ChevronDown className="w-5 h-5 text-ink/50" />
              )}
            </button>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-t border-ink/10"
                >
                  <div className="p-4 space-y-4">
                    <div>
                      <p className="text-sm font-medium text-ink/70 mb-2">File type</p>
                      <div className="flex gap-2 flex-wrap">
                        {(['slides', 'tutorial', 'pastpaper'] as FileType[]).map((t) => (
                          <button
                            key={t}
                            onClick={() => setFileType(t)}
                            className={`px-3 py-2 rounded-lg text-sm border transition ${
                              fileType === t
                                ? 'border-accent bg-accent/10 text-accent-dark'
                                : 'border-ink/20 text-ink/70 hover:border-ink/40'
                            }`}
                          >
                            {LABELS[t]}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div
                      onClick={() => triggerUpload(week)}
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const file = e.dataTransfer.files[0];
                        if (file) {
                          setUploadingWeek(week);
                          handleFile(file, week);
                        }
                      }}
                      className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition ${
                        isUploading ? 'border-accent bg-accent/5 pointer-events-none' : 'border-sage/30 bg-parchment/30 hover:border-sage/50'
                      }`}
                    >
                      {isUploading ? (
                        <Loader2 className="w-10 h-10 mx-auto text-sage animate-spin mb-2" />
                      ) : (
                        <FileText className="w-10 h-10 mx-auto text-sage/70 mb-2" />
                      )}
                      <p className="text-sm font-medium text-ink">
                        {isUploading ? 'Processing PDF...' : `Drop or click to upload (${LABELS[fileType]})`}
                      </p>
                    </div>

                    {weekFiles.length > 0 && (
                      <div className="space-y-6">
                        {(['slides', 'tutorial', 'pastpaper'] as FileType[]).map((type) => {
                          const typeFiles = weekFiles.filter((f) => f.type === type);
                          if (typeFiles.length === 0) return null;
                          const key = `${week}-${type}`;
                          const isGenerating = generatingKey === key;
                          return (
                            <div key={type}>
                              <p className="text-sm font-medium text-ink/70 mb-2">{LABELS[type]}</p>
                              <div className="space-y-2 mb-3">
                                {typeFiles.map((file) => (
                                  <div
                                    key={file.id}
                                    className="flex items-center justify-between gap-3 p-3 rounded-lg bg-parchment/30 border border-ink/5"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <p className="font-medium text-ink truncate text-sm">{file.name}</p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <select
                                        value={file.week ?? 1}
                                        onChange={(e) => handleMoveToWeek(file, Number(e.target.value))}
                                        disabled={moving === file.id}
                                        className="text-xs px-2 py-1.5 rounded border border-ink/20 bg-white text-ink disabled:opacity-50"
                                        title="Move to week"
                                      >
                                        {WEEKS.map((w) => (
                                          <option key={w} value={w}>
                                            Week {w}
                                          </option>
                                        ))}
                                      </select>
                                      <button
                                        onClick={() => handleDelete(file)}
                                        disabled={!!deleting}
                                        className="p-2 rounded-lg text-red-600/70 hover:bg-red-50 disabled:opacity-50"
                                        title="Delete"
                                      >
                                        {deleting === file.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <button
                                onClick={() => generateNotesForWeekAndType(week, type)}
                                disabled={!!generatingKey}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent text-white hover:bg-accent-dark disabled:opacity-50 text-sm"
                              >
                                {isGenerating ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    {generateStatus}
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="w-4 h-4" />
                                    Generate {LABELS[type]} notes
                                  </>
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}
