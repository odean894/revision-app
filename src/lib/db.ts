import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface Module {
  id: string;
  name: string;
  color: string;
  createdAt: number;
}

export interface UploadedFile {
  id: string;
  moduleId: string;
  week?: number; // 1-11, defaults to 1 for backward compat
  type: 'slides' | 'tutorial' | 'pastpaper';
  name: string;
  content: string;
  uploadedAt: number;
}

export interface GeneratedNote {
  id: string;
  moduleId: string;
  week?: number; // 1-11, defaults to 1 for backward compat
  noteType?: 'slides' | 'tutorial' | 'pastpaper'; // which section generated this
  sourceFileId?: string;
  topic: string;
  content: string;
  createdAt: number;
}

export interface QuizQuestion {
  id: string;
  moduleId: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

export interface StudyProgress {
  moduleId: string;
  lastStudied: number;
  quizScore?: number;
}

export interface QuizProgress {
  moduleId: string;
  currentIndex: number;
  score: number;
  selected: number | null;
  showResult: boolean;
  questionCount: number;
  savedAt: number;
}

interface RevisionDB extends DBSchema {
  modules: { key: string; value: Module };
  files: { key: string; value: UploadedFile; indexes: { 'by-module': string } };
  notes: { key: string; value: GeneratedNote; indexes: { 'by-module': string } };
  quizzes: { key: string; value: QuizQuestion; indexes: { 'by-module': string } };
  progress: { key: string; value: StudyProgress };
  quizProgress: { key: string; value: QuizProgress };
}

const DB_NAME = 'revision-app';
const DB_VERSION = 3;

let dbPromise: Promise<IDBPDatabase<RevisionDB>> | null = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<RevisionDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVer) {
        if (oldVer < 1) {
          db.createObjectStore('modules', { keyPath: 'id' });
          const fileStore = db.createObjectStore('files', { keyPath: 'id' });
          fileStore.createIndex('by-module', 'moduleId');
          const noteStore = db.createObjectStore('notes', { keyPath: 'id' });
          noteStore.createIndex('by-module', 'moduleId');
          const quizStore = db.createObjectStore('quizzes', { keyPath: 'id' });
          quizStore.createIndex('by-module', 'moduleId');
          db.createObjectStore('progress', { keyPath: 'moduleId' });
        }
        if (oldVer < 2) {
          db.createObjectStore('quizProgress', { keyPath: 'moduleId' });
        }
        if (oldVer < 3) {
          // Week field added; existing records default to week 1 at read time
        }
      },
    });
  }
  return dbPromise;
}
