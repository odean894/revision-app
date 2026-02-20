'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { HelpCircle, FileText, Lightbulb, Target } from 'lucide-react';
import type { UploadedFile } from '@/lib/db';

interface Props {
  moduleId: string;
  moduleName: string;
  files: UploadedFile[];
}

const EXAM_TIPS = [
  'Start past papers early – identify recurring question types and mark schemes.',
  'Time yourself: practice under exam conditions to build stamina.',
  'Focus on learning from mistakes: review every wrong answer thoroughly.',
  'Create a “key formulas / definitions” sheet and test yourself on it.',
  'Cramming isn’t enough – space out revision over at least 2 weeks.',
  'Past papers often repeat themes – prioritise topics that appear most.',
  'Check the exam format (MCQ, essays, calculations) and practice accordingly.',
];

export default function ExamHelp({ moduleName, files }: Props) {
  const [tipIndex, setTipIndex] = useState(0);
  const pastPapers = files.filter((f) => f.type === 'pastpaper');

  return (
    <div className="space-y-8">
      <h2 className="font-display text-xl text-ink">Exam preparation</h2>

      <div className="grid md:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 rounded-xl bg-white border border-ink/10"
        >
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="w-6 h-6 text-accent" />
            <h3 className="font-display text-lg text-ink">Quick tips</h3>
          </div>
          <p className="text-ink/80 mb-4">{EXAM_TIPS[tipIndex]}</p>
          <button
            onClick={() => setTipIndex((i) => (i + 1) % EXAM_TIPS.length)}
            className="text-sm text-accent hover:underline"
          >
            Next tip →
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-6 rounded-xl bg-white border border-ink/10"
        >
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-6 h-6 text-sage" />
            <h3 className="font-display text-lg text-ink">Your resources</h3>
          </div>
          <p className="text-ink/70 text-sm mb-2">
            Upload past papers in the Upload tab to extract content and generate notes & quiz questions.
          </p>
          {pastPapers.length > 0 ? (
            <ul className="space-y-1">
              {pastPapers.map((f) => (
                <li key={f.id} className="flex items-center gap-2 text-sm">
                  <FileText className="w-4 h-4 text-sage shrink-0" />
                  {f.name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink/50 text-sm italic">No past papers uploaded yet</p>
          )}
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="p-6 rounded-xl bg-parchment/50 border border-sage/30"
      >
        <h3 className="font-display text-lg text-ink mb-3 flex items-center gap-2">
          <HelpCircle className="w-5 h-5" />
          Catch-up plan for {moduleName}
        </h3>
        <ol className="list-decimal list-inside space-y-2 text-ink/80">
          <li>Upload all lecture slides and tutorial Q&A for Weeks 1–6</li>
          <li>Generate notes for each upload – work through one topic at a time</li>
          <li>Use the Quiz tab to test yourself after each topic</li>
          <li>Upload past papers and generate notes + quiz questions from them</li>
          <li>Focus on high-weight topics and any that appear in multiple years</li>
          <li>Do timed past paper attempts before midterms and finals</li>
        </ol>
      </motion.div>
    </div>
  );
}
