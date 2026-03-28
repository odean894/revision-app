'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Upload, FileText, HelpCircle, ClipboardList } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getModules, getFiles, getNotes } from '@/lib/data';
import type { Module, UploadedFile, GeneratedNote } from '@/lib/db';
import FileUpload from '@/components/FileUpload';
import NotesView from '@/components/NotesView';
import QuizView from '@/components/QuizView';
import ExamHelp from '@/components/ExamHelp';

type Tab = 'files' | 'notes' | 'quiz' | 'exam';

export default function ModulePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const id = params.id as string;
  const [module, setModule] = useState<Module | null>(null);
  const [tab, setTab] = useState<Tab>('files');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [notes, setNotes] = useState<GeneratedNote[]>([]);

  const loadData = () => {
    const userId = user?.id ?? null;
    getModules(userId).then((mods) => {
      const mod = mods.find((m) => m.id === id);
      if (!mod) {
        router.push('/');
        return;
      }
      setModule(mod);
    });
    getFiles(id, user?.id ?? null).then(setFiles);
    getNotes(id, user?.id ?? null).then(setNotes);
  };

  useEffect(() => {
    loadData();
  }, [id, user?.id, router]);

  useEffect(() => {
    const onMigrated = () => loadData();
    window.addEventListener('revision_app_data_migrated', onMigrated);
    return () => window.removeEventListener('revision_app_data_migrated', onMigrated);
  }, [id, user?.id, router]);

  const refreshFiles = () => getFiles(id, user?.id ?? null).then(setFiles);
  const refreshNotes = () => getNotes(id, user?.id ?? null).then(setNotes);

  if (!module) return null;

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'files', label: 'Upload & content', icon: <Upload className="w-4 h-4" /> },
    { key: 'notes', label: 'Notes', icon: <FileText className="w-4 h-4" /> },
    { key: 'quiz', label: 'Quiz', icon: <ClipboardList className="w-4 h-4" /> },
    { key: 'exam', label: 'Exam help', icon: <HelpCircle className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-ink/10 bg-parchment/80 backdrop-blur">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <Link href="/" className="inline-flex items-center gap-2 text-ink/70 hover:text-ink mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to modules
          </Link>
          <div className="flex items-center gap-3">
            <div
              className="w-5 h-5 rounded-full shrink-0"
              style={{ backgroundColor: module.color }}
            />
            <h1 className="font-display text-2xl text-ink">{module.name}</h1>
          </div>
        </div>
      </header>

      <nav className="border-b border-ink/10 bg-white/50">
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex gap-1 overflow-x-auto py-2">
            {tabs.map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex items-center gap-2 px-4 py-3 rounded-lg whitespace-nowrap transition ${
                  tab === key
                    ? 'bg-accent text-white'
                    : 'text-ink/70 hover:bg-parchment hover:text-ink'
                }`}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {tab === 'files' && (
          <FileUpload
            moduleId={id}
            moduleName={module.name}
            files={files}
            onRefresh={refreshFiles}
            onNotesRefresh={refreshNotes}
            userId={user?.id ?? null}
          />
        )}
        {tab === 'notes' && (
          <NotesView
            notes={notes}
            files={files}
            onRefresh={refreshNotes}
            userId={user?.id ?? null}
          />
        )}
        {tab === 'quiz' && (
          <QuizView moduleId={id} files={files} userId={user?.id ?? null} />
        )}
        {tab === 'exam' && <ExamHelp moduleId={id} moduleName={module.name} files={files} />}
      </main>
    </div>
  );
}
