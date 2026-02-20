'use client';

import { createClient } from '@/lib/supabase/client';
import { getDB } from '@/lib/db';
import type {
  Module,
  UploadedFile,
  GeneratedNote,
  QuizQuestion,
  QuizProgress,
} from '@/lib/db';

export type { Module, UploadedFile, GeneratedNote, QuizQuestion };

export async function getModules(userId: string | null): Promise<Module[]> {
  if (userId) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('modules')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data || []).map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color,
      createdAt: r.created_at,
    }));
  }
  const db = await getDB();
  return db.getAll('modules');
}

export async function addModule(
  module: Module,
  userId: string | null
): Promise<void> {
  if (userId) {
    const supabase = createClient();
    const { error } = await supabase.from('modules').insert({
      id: module.id,
      user_id: userId,
      name: module.name,
      color: module.color,
      created_at: module.createdAt,
    });
    if (error) throw error;
  } else {
    const db = await getDB();
    await db.put('modules', module);
  }
}

export async function deleteModule(
  id: string,
  userId: string | null
): Promise<void> {
  if (userId) {
    const supabase = createClient();
    await supabase.from('quizzes').delete().eq('module_id', id);
    await supabase.from('notes').delete().eq('module_id', id);
    await supabase.from('files').delete().eq('module_id', id);
    await supabase.from('quiz_progress').delete().eq('module_id', id);
    const { error } = await supabase.from('modules').delete().eq('id', id);
    if (error) throw error;
  } else {
    const db = await getDB();
    await db.delete('modules', id);
    const files = await db.getAllFromIndex('files', 'by-module', id);
    for (const f of files) await db.delete('files', f.id);
    const notes = await db.getAllFromIndex('notes', 'by-module', id);
    for (const n of notes) await db.delete('notes', n.id);
    const quizzes = await db.getAllFromIndex('quizzes', 'by-module', id);
    for (const q of quizzes) await db.delete('quizzes', q.id);
    try {
      await db.delete('quizProgress', id);
    } catch {}
  }
}

export async function getFiles(
  moduleId: string,
  userId: string | null
): Promise<UploadedFile[]> {
  if (userId) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('files')
      .select('*')
      .eq('module_id', moduleId);
    if (error) throw error;
    return (data || []).map((r) => ({
      id: r.id,
      moduleId: r.module_id,
      type: r.type as 'slides' | 'tutorial' | 'pastpaper',
      name: r.name,
      content: r.content,
      uploadedAt: r.uploaded_at,
    }));
  }
  const db = await getDB();
  return db.getAllFromIndex('files', 'by-module', moduleId);
}

export async function addFile(
  file: UploadedFile,
  userId: string | null
): Promise<void> {
  if (userId) {
    const supabase = createClient();
    const { error } = await supabase.from('files').insert({
      id: file.id,
      user_id: userId,
      module_id: file.moduleId,
      type: file.type,
      name: file.name,
      content: file.content,
      uploaded_at: file.uploadedAt,
    });
    if (error) throw error;
  } else {
    const db = await getDB();
    await db.put('files', file);
  }
}

export async function getNotes(
  moduleId: string,
  userId: string | null
): Promise<GeneratedNote[]> {
  if (userId) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('module_id', moduleId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data || []).map((r) => ({
      id: r.id,
      moduleId: r.module_id,
      sourceFileId: r.source_file_id,
      topic: r.topic,
      content: r.content,
      createdAt: r.created_at,
    }));
  }
  const db = await getDB();
  return db.getAllFromIndex('notes', 'by-module', moduleId);
}

export async function addNote(
  note: GeneratedNote,
  userId: string | null
): Promise<void> {
  if (userId) {
    const supabase = createClient();
    const { error } = await supabase.from('notes').insert({
      id: note.id,
      user_id: userId,
      module_id: note.moduleId,
      source_file_id: note.sourceFileId || null,
      topic: note.topic,
      content: note.content,
      created_at: note.createdAt,
    });
    if (error) throw error;
  } else {
    const db = await getDB();
    await db.put('notes', note);
  }
}

export async function deleteNote(
  id: string,
  userId: string | null
): Promise<void> {
  if (userId) {
    const supabase = createClient();
    const { error } = await supabase.from('notes').delete().eq('id', id);
    if (error) throw error;
  } else {
    const db = await getDB();
    await db.delete('notes', id);
  }
}

export async function updateNoteTopic(
  id: string,
  topic: string,
  userId: string | null
): Promise<void> {
  if (userId) {
    const supabase = createClient();
    const { error } = await supabase
      .from('notes')
      .update({ topic })
      .eq('id', id);
    if (error) throw error;
  } else {
    const db = await getDB();
    const note = await db.get('notes', id);
    if (note) {
      note.topic = topic;
      await db.put('notes', note);
    }
  }
}

export async function getQuizzes(
  moduleId: string,
  userId: string | null
): Promise<QuizQuestion[]> {
  if (userId) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('quizzes')
      .select('*')
      .eq('module_id', moduleId);
    if (error) throw error;
    return (data || []).map((r) => ({
      id: r.id,
      moduleId: r.module_id,
      question: r.question,
      options: r.options as string[],
      correctIndex: r.correct_index,
      explanation: r.explanation,
    }));
  }
  const db = await getDB();
  return db.getAllFromIndex('quizzes', 'by-module', moduleId);
}

export async function addQuiz(
  quiz: QuizQuestion,
  userId: string | null
): Promise<void> {
  if (userId) {
    const supabase = createClient();
    const { error } = await supabase.from('quizzes').insert({
      id: quiz.id,
      user_id: userId,
      module_id: quiz.moduleId,
      question: quiz.question,
      options: quiz.options,
      correct_index: quiz.correctIndex,
      explanation: quiz.explanation || null,
    });
    if (error) throw error;
  } else {
    const db = await getDB();
    await db.put('quizzes', quiz);
  }
}

export async function getQuizProgress(
  moduleId: string,
  userId: string | null
): Promise<QuizProgress | null> {
  if (userId) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('quiz_progress')
      .select('*')
      .eq('module_id', moduleId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      moduleId: data.module_id,
      currentIndex: data.current_index,
      score: data.score,
      selected: data.selected,
      showResult: data.show_result,
      questionCount: data.question_count,
      savedAt: data.saved_at,
    };
  }
  const db = await getDB();
  const saved = await db.get('quizProgress', moduleId);
  return saved ?? null;
}

export async function saveQuizProgress(
  progress: QuizProgress,
  userId: string | null
): Promise<void> {
  if (userId) {
    const supabase = createClient();
    const { error } = await supabase.from('quiz_progress').upsert({
      user_id: userId,
      module_id: progress.moduleId,
      current_index: progress.currentIndex,
      score: progress.score,
      selected: progress.selected,
      show_result: progress.showResult,
      question_count: progress.questionCount,
      saved_at: progress.savedAt,
    });
    if (error) throw error;
  } else {
    const db = await getDB();
    await db.put('quizProgress', progress);
  }
}

export async function deleteQuizProgress(
  moduleId: string,
  userId: string | null
): Promise<void> {
  if (userId) {
    const supabase = createClient();
    await supabase
      .from('quiz_progress')
      .delete()
      .eq('module_id', moduleId);
  } else {
    const db = await getDB();
    try {
      await db.delete('quizProgress', moduleId);
    } catch {}
  }
}

/**
 * Migrate local IndexedDB data to Supabase when user signs in.
 * Only runs if the user has no cloud data yet (avoids overwriting).
 */
export async function migrateLocalDataToSupabase(
  userId: string
): Promise<boolean> {
  const MIGRATED_KEY = `revision_app_migrated_${userId}`;
  if (typeof window === 'undefined') return false;
  if (localStorage.getItem(MIGRATED_KEY) === 'true') return false;

  const supabase = createClient();
  const { data: cloudModules } = await supabase
    .from('modules')
    .select('id')
    .limit(1);
  if (cloudModules && cloudModules.length > 0) return false;

  const db = await getDB();
  const localModules = await db.getAll('modules');
  if (localModules.length === 0) return false;

  try {
    for (const mod of localModules) {
      await supabase.from('modules').insert({
        id: mod.id,
        user_id: userId,
        name: mod.name,
        color: mod.color,
        created_at: mod.createdAt,
      });
    }
    for (const mod of localModules) {
      const files = await db.getAllFromIndex('files', 'by-module', mod.id);
      for (const f of files) {
        await supabase.from('files').insert({
          id: f.id,
          user_id: userId,
          module_id: f.moduleId,
          type: f.type,
          name: f.name,
          content: f.content,
          uploaded_at: f.uploadedAt,
        });
      }
      const notes = await db.getAllFromIndex('notes', 'by-module', mod.id);
      for (const n of notes) {
        await supabase.from('notes').insert({
          id: n.id,
          user_id: userId,
          module_id: n.moduleId,
          source_file_id: n.sourceFileId || null,
          topic: n.topic,
          content: n.content,
          created_at: n.createdAt,
        });
      }
      const quizzes = await db.getAllFromIndex('quizzes', 'by-module', mod.id);
      for (const q of quizzes) {
        await supabase.from('quizzes').insert({
          id: q.id,
          user_id: userId,
          module_id: q.moduleId,
          question: q.question,
          options: q.options,
          correct_index: q.correctIndex,
          explanation: q.explanation || null,
        });
      }
      try {
        const prog = await db.get('quizProgress', mod.id);
        if (prog) {
          await supabase.from('quiz_progress').insert({
            user_id: userId,
            module_id: prog.moduleId,
            current_index: prog.currentIndex,
            score: prog.score,
            selected: prog.selected,
            show_result: prog.showResult,
            question_count: prog.questionCount,
            saved_at: prog.savedAt,
          });
        }
      } catch {
        /* ignore missing quiz progress */
      }
    }
    await db.clear('quizProgress');
    await db.clear('quizzes');
    await db.clear('notes');
    await db.clear('files');
    await db.clear('modules');
    localStorage.setItem(MIGRATED_KEY, 'true');
    return true;
  } catch (err) {
    console.error('Migration failed:', err);
    return false;
  }
}
