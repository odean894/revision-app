'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, ChevronDown, ChevronUp, Trash2, Pencil, Check, X } from 'lucide-react';
import { marked } from 'marked';
import { deleteNote, updateNoteTopic, updateNoteWeek } from '@/lib/data';
import type { GeneratedNote, UploadedFile } from '@/lib/db';
import NoteChatPanel from './NoteChatPanel';

interface Props {
  notes: GeneratedNote[];
  files: UploadedFile[];
  onRefresh: () => void;
  userId: string | null;
}

export default function NotesView({ notes, files, onRefresh, userId }: Props) {
  const [expanded, setExpanded] = useState<string | null>(notes[0]?.id ?? null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [movingNoteId, setMovingNoteId] = useState<string | null>(null);

  const WEEKS = Array.from({ length: 11 }, (_, i) => i + 1);

  const handleDelete = async (note: GeneratedNote, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete notes for "${note.topic}"?`)) return;
    await deleteNote(note.id, userId);
    onRefresh();
    if (expanded === note.id) setExpanded(null);
  };

  const startRename = (note: GeneratedNote, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(note.id);
    setEditName(note.topic);
  };

  const saveRename = async () => {
    if (!editingId || !editName.trim()) {
      setEditingId(null);
      return;
    }
    await updateNoteTopic(editingId, editName.trim(), userId);
    onRefresh();
    setEditingId(null);
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditName('');
  };

  const handleMoveNote = async (note: GeneratedNote, newWeek: number) => {
    const currentWeek = note.week ?? 1;
    if (newWeek === currentWeek) return;
    setMovingNoteId(note.id);
    try {
      await updateNoteWeek(note.id, newWeek, userId);
      onRefresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to move');
    } finally {
      setMovingNoteId(null);
    }
  };

  const notesByWeek = notes.reduce<Record<number, GeneratedNote[]>>((acc, n) => {
    const w = n.week ?? 1;
    if (!acc[w]) acc[w] = [];
    acc[w].push(n);
    return acc;
  }, {});
  const weeks = Object.keys(notesByWeek)
    .map(Number)
    .sort((a, b) => a - b);
  const typeOrder = { slides: 0, tutorial: 1, pastpaper: 2 } as const;

  if (notes.length === 0) {
    return (
      <div className="text-center py-16 rounded-xl border-2 border-dashed border-sage/30 bg-parchment/30">
        <FileText className="w-16 h-16 mx-auto text-sage/50 mb-4" />
        <p className="text-ink/70 text-lg mb-2">No notes yet</p>
        <p className="text-ink/50">Upload files by week in the Upload tab, then generate notes separately for lectures, tutorials, and past papers.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="font-display text-xl text-ink mb-4">Your revision notes by week</h2>
      {weeks.map((week) => (
        <div key={week}>
          <h3 className="text-sm font-medium text-ink/60 mb-3">Week {week}</h3>
          <div className="space-y-4">
            {[...notesByWeek[week]]
              .sort((a, b) => (typeOrder[a.noteType ?? 'slides'] ?? 0) - (typeOrder[b.noteType ?? 'slides'] ?? 0))
              .map((note) => (
        <motion.div
          key={note.id}
          layout
          className="rounded-xl bg-white border border-ink/10 overflow-hidden"
        >
          <div
            onClick={() => setExpanded(expanded === note.id ? null : note.id)}
            className="w-full flex items-center justify-between p-5 text-left hover:bg-parchment/30 transition cursor-pointer"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <FileText className="w-5 h-5 text-sage shrink-0" />
              <div className="min-w-0 flex-1">
                {editingId === note.id ? (
                  <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveRename()}
                      className="flex-1 px-2 py-1 rounded border border-accent/50 text-ink font-display text-lg focus:outline-none focus:ring-1 focus:ring-accent"
                      autoFocus
                    />
                    <button onClick={saveRename} className="p-1.5 text-green-600 hover:bg-green-50 rounded">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={cancelRename} className="p-1.5 text-ink/60 hover:bg-ink/10 rounded">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <h3 className="font-display text-lg text-ink truncate">{note.topic}</h3>
                )}
                <p className="text-sm text-ink/50">
                  {new Date(note.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {editingId !== note.id && (
                <>
                  <select
                    value={note.week ?? 1}
                    onChange={(e) => handleMoveNote(note, Number(e.target.value))}
                    onClick={(e) => e.stopPropagation()}
                    disabled={movingNoteId === note.id}
                    className="text-xs px-2 py-1 rounded border border-ink/20 bg-white text-ink"
                    title="Move to week"
                  >
                    {WEEKS.map((w) => (
                      <option key={w} value={w}>Week {w}</option>
                    ))}
                  </select>
                  <button
                    onClick={(e) => startRename(note, e)}
                    className="p-2 text-ink/50 hover:text-accent hover:bg-parchment/50 rounded-lg transition"
                    title="Rename"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => handleDelete(note, e)}
                    className="p-2 text-ink/50 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
              {expanded === note.id ? (
                <ChevronUp className="w-5 h-5 text-ink/50" />
              ) : (
                <ChevronDown className="w-5 h-5 text-ink/50" />
              )}
            </div>
          </div>
          <AnimatePresence>
            {expanded === note.id && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="border-t border-ink/10"
              >
                <div
                  className="note-content p-6 prose prose-slate max-w-none"
                  dangerouslySetInnerHTML={{ __html: marked(note.content) as string }}
                />
                <NoteChatPanel
                  note={note}
                  sourceFiles={files.filter(
                    (f) =>
                      f.moduleId === note.moduleId &&
                      (f.week ?? 1) === (note.week ?? 1) &&
                      f.type === (note.noteType ?? 'slides')
                  )}
                  userId={userId}
                  onNoteUpdated={onRefresh}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
