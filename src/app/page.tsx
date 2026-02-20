'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, BookOpen, ChevronRight, GraduationCap } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getModules, addModule as addModuleData, deleteModule as deleteModuleData } from '@/lib/data';
import AuthUI from '@/components/AuthUI';
import type { Module } from '@/lib/db';

const MODULE_COLORS = [
  '#C27B7B', '#7D8E7B', '#8B9DC3', '#B88B9E', '#7BA3A8', '#A68B6B',
];

export default function HomePage() {
  const { user } = useAuth();
  const [modules, setModules] = useState<Module[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    getModules(user?.id ?? null).then(setModules);
  }, [user?.id]);

  useEffect(() => {
    const onMigrated = () => {
      getModules(user?.id ?? null).then(setModules);
    };
    window.addEventListener('revision_app_data_migrated', onMigrated);
    return () => window.removeEventListener('revision_app_data_migrated', onMigrated);
  }, [user?.id]);

  const addModule = async () => {
    if (!newName.trim()) return;
    const id = crypto.randomUUID();
    const color = MODULE_COLORS[modules.length % MODULE_COLORS.length];
    const module: Module = { id, name: newName.trim(), color, createdAt: Date.now() };
    await addModuleData(module, user?.id ?? null);
    setModules((prev) => [...prev, module]);
    setNewName('');
    setShowAdd(false);
  };

  const deleteModule = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Delete this module and all its content?')) return;
    await deleteModuleData(id, user?.id ?? null);
    setModules((prev) => prev.filter((m) => m.id !== id));
  };

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-ink/10 bg-parchment/80 backdrop-blur">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <GraduationCap className="w-10 h-10 text-accent" strokeWidth={1.5} />
                <h1 className="font-display text-3xl text-ink">Revision Hub</h1>
              </div>
              <p className="text-ink/70 text-lg">University of Exeter · Catch up & prepare for exams</p>
            </div>
            <AuthUI />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <h2 className="font-display text-2xl text-ink">Your Modules</h2>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white hover:bg-accent-dark transition"
          >
            <Plus className="w-5 h-5" />
            Add module
          </button>
        </div>

        <AnimatePresence>
          {showAdd && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 p-6 rounded-xl border-2 border-dashed border-sage/40 bg-white/50"
            >
              <input
                type="text"
                placeholder="e.g. ECON3012 Econometrics"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addModule()}
                className="w-full px-4 py-3 rounded-lg border border-ink/20 mb-3 focus:outline-none focus:ring-2 focus:ring-accent"
                autoFocus
              />
              <div className="flex gap-2">
                <button onClick={addModule} className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-dark">
                  Add
                </button>
                <button onClick={() => { setShowAdd(false); setNewName(''); }} className="px-4 py-2 text-ink/70 hover:text-ink">
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {modules.length === 0 && !showAdd ? (
          <div className="text-center py-16 rounded-xl border-2 border-dashed border-sage/30 bg-parchment/30">
            <BookOpen className="w-16 h-16 mx-auto text-sage/50 mb-4" />
            <p className="text-ink/70 text-lg mb-2">No modules yet</p>
            <p className="text-ink/50 mb-6">Add your first module to start uploading slides and generating notes</p>
            <button onClick={() => setShowAdd(true)} className="px-6 py-3 bg-accent text-white rounded-lg hover:bg-accent-dark">
              Add your first module
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {modules.map((mod) => (
              <motion.div
                key={mod.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                layout
              >
                <Link href={`/module/${mod.id}`}>
                  <div className="group flex items-center justify-between p-5 rounded-xl bg-white border border-ink/10 hover:border-accent/40 hover:shadow-md transition cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div
                        className="w-4 h-4 rounded-full shrink-0"
                        style={{ backgroundColor: mod.color }}
                      />
                      <div>
                        <h3 className="font-display text-xl text-ink group-hover:text-accent-dark transition">{mod.name}</h3>
                        <p className="text-sm text-ink/50">View slides, notes, quizzes & exam help</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => deleteModule(mod.id, e)}
                        className="px-2 py-1 text-sm text-red-600/70 hover:text-red-600 opacity-0 group-hover:opacity-100 transition"
                      >
                        Delete
                      </button>
                      <ChevronRight className="w-5 h-5 text-ink/40 group-hover:text-accent" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
