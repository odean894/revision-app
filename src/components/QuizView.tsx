'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ClipboardList, Sparkles, Loader2, Check, X } from 'lucide-react';
import {
  getQuizzes,
  addQuiz,
  getQuizProgress,
  saveQuizProgress,
  deleteQuizProgress,
} from '@/lib/data';
import type { UploadedFile, QuizQuestion } from '@/lib/db';
import { generateQuiz } from '@/lib/api';

interface Props {
  moduleId: string;
  files: UploadedFile[];
  userId: string | null;
}

export default function QuizView({ moduleId, files, userId }: Props) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateStatus, setGenerateStatus] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const hasRestored = useRef(false);

  useEffect(() => {
    hasRestored.current = false;
    getQuizzes(moduleId, userId).then(setQuestions);
  }, [moduleId, userId]);

  const saveProgress = useCallback(async () => {
    if (questions.length === 0 || !hasRestored.current) return;
    await saveQuizProgress(
      {
        moduleId,
        currentIndex,
        score,
        selected,
        showResult,
        questionCount: questions.length,
        savedAt: Date.now(),
      },
      userId
    );
  }, [moduleId, questions.length, currentIndex, score, selected, showResult, userId]);

  useEffect(() => {
    if (questions.length === 0) return;
    getQuizProgress(moduleId, userId).then((saved) => {
      if (saved && saved.questionCount === questions.length) {
        setCurrentIndex(saved.currentIndex);
        setScore(saved.score);
        setSelected(saved.selected);
        setShowResult(saved.showResult);
      }
      hasRestored.current = true;
    });
  }, [moduleId, questions.length, userId]);

  useEffect(() => {
    if (questions.length === 0 || !hasRestored.current) return;
    saveProgress();
  }, [currentIndex, score, selected, showResult, questions.length, saveProgress]);

  useEffect(() => {
    if (questions.length > 0 && currentIndex >= questions.length) {
      deleteQuizProgress(moduleId, userId);
    }
  }, [moduleId, questions.length, currentIndex, userId]);

  const generateFromFiles = async () => {
    const combined = files.map((f) => `${f.name}\n\n${f.content}`).join('\n\n---\n\n');
    if (!combined.trim()) {
      alert('Upload some files first to generate quiz questions.');
      return;
    }
    setGenerating(true);
    const steps = [
      'Preparing your content...',
      'Sending to AI...',
      'Generating questions...',
      'Creating options & explanations...',
      'Almost there...',
      'Just a few more seconds...',
      'Finalising your quiz...',
    ];
    let stepIndex = 0;
    setGenerateStatus(steps[0]);
    const statusInterval = setInterval(() => {
      stepIndex = (stepIndex + 1) % steps.length;
      setGenerateStatus(steps[stepIndex]);
    }, 4000);
    try {
      const { questions: newQs } = await generateQuiz(combined, 10);
      for (const q of newQs) {
        if (q.options.length >= 2 && q.question) {
          const quizId = crypto.randomUUID();
          await addQuiz(
            {
              id: quizId,
              moduleId,
              question: q.question,
              options: q.options,
              correctIndex: Math.min(q.correctIndex, q.options.length - 1),
              explanation: q.explanation,
            },
            userId
          );
        }
      }
      const updated = await getQuizzes(moduleId, userId);
      setQuestions(updated);
      await deleteQuizProgress(moduleId, userId);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to generate quiz');
    } finally {
      setGenerating(false);
    }
  };

  const q = questions[currentIndex];
  const isCorrect = selected !== null && selected === q?.correctIndex;

  const handleSelect = (idx: number) => {
    if (showResult) return;
    setSelected(idx);
    setShowResult(true);
    if (idx === q?.correctIndex) setScore((s) => s + 1);
  };

  const nextQuestion = () => {
    setSelected(null);
    setShowResult(false);
    setCurrentIndex((i) => Math.min(i + 1, questions.length - 1));
  };

  const restart = async () => {
    setCurrentIndex(0);
    setSelected(null);
    setShowResult(false);
    setScore(0);
    await deleteQuizProgress(moduleId, userId);
  };

  if (questions.length === 0) {
    return (
      <div className="space-y-6">
        <h2 className="font-display text-xl text-ink">Practice quiz</h2>
        <div className="text-center py-16 rounded-xl border-2 border-dashed border-sage/30 bg-parchment/30">
          <ClipboardList className="w-16 h-16 mx-auto text-sage/50 mb-4" />
          <p className="text-ink/70 text-lg mb-2">No quiz questions yet</p>
          <p className="text-ink/50 mb-6">
            {files.length > 0
              ? 'Generate quiz questions from your uploaded content'
              : 'Upload files first, then generate quiz questions'}
          </p>
          <button
            onClick={generateFromFiles}
            disabled={generating || files.length === 0}
            className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-lg hover:bg-accent-dark disabled:opacity-50"
          >
            {generating ? <Loader2 className="w-5 h-5 animate-spin shrink-0" /> : <Sparkles className="w-5 h-5 shrink-0" />}
            {generating ? 'Generating...' : 'Generate quiz'}
          </button>
          {generating && generateStatus && (
            <p className="mt-4 text-ink/60 text-sm">{generateStatus}</p>
          )}
        </div>
      </div>
    );
  }

  if (currentIndex >= questions.length) {
    return (
      <div className="text-center py-16 rounded-xl bg-white border border-ink/10">
        <h2 className="font-display text-2xl text-ink mb-4">Quiz complete!</h2>
        <p className="text-2xl text-accent font-display mb-6">
          Score: {score} / {questions.length}
        </p>
        <button
          onClick={() => restart().then(() => {})}
          className="px-6 py-3 bg-accent text-white rounded-lg hover:bg-accent-dark"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-display text-xl text-ink">Practice quiz</h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-ink/60">
              Question {currentIndex + 1} of {questions.length} · Score: {score}
            </span>
            <button
              onClick={generateFromFiles}
              disabled={generating}
              className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border border-accent text-accent hover:bg-accent/10"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <Sparkles className="w-4 h-4 shrink-0" />}
              {generating ? 'Generating...' : 'More questions'}
            </button>
          </div>
        </div>
        {generating && generateStatus && (
          <p className="mt-2 text-sm text-ink/50">{generateStatus}</p>
        )}
      </div>

      <motion.div
        key={currentIndex}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="p-6 rounded-xl bg-white border border-ink/10"
      >
        <p className="text-lg text-ink mb-6 font-medium">{q.question}</p>
        <div className="space-y-3">
          {q.options.map((opt, idx) => (
            <button
              key={idx}
              onClick={() => handleSelect(idx)}
              disabled={showResult}
              className={`w-full text-left p-4 rounded-lg border-2 transition ${
                !showResult
                  ? 'border-ink/20 hover:border-accent/50 hover:bg-parchment/30'
                  : idx === q.correctIndex
                  ? 'border-green-500 bg-green-50'
                  : idx === selected
                  ? 'border-red-400 bg-red-50'
                  : 'border-ink/10 opacity-60'
              }`}
            >
              <span className="flex items-center gap-2">
                {showResult && idx === q.correctIndex && <Check className="w-5 h-5 text-green-600" />}
                {showResult && idx === selected && idx !== q.correctIndex && <X className="w-5 h-5 text-red-600" />}
                {opt}
              </span>
            </button>
          ))}
        </div>
        <AnimatePresence>
          {showResult && q.explanation && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-6 p-4 rounded-lg bg-sage/10 text-ink/80 text-sm"
            >
              <strong>Explanation:</strong> {q.explanation}
            </motion.p>
          )}
        </AnimatePresence>
        {showResult && (
          <button
            onClick={nextQuestion}
            className="mt-6 w-full py-3 bg-accent text-white rounded-lg hover:bg-accent-dark"
          >
            {currentIndex < questions.length - 1 ? 'Next question' : 'See results'}
          </button>
        )}
      </motion.div>
    </div>
  );
}
