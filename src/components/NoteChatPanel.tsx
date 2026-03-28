'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, Loader2, Plus } from 'lucide-react';
import { marked } from 'marked';
import { updateNoteContent } from '@/lib/data';
import type { GeneratedNote, UploadedFile } from '@/lib/db';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  note: GeneratedNote;
  sourceFiles: UploadedFile[];
  userId: string | null;
  onNoteUpdated: () => void;
}

export default function NoteChatPanel({ note, sourceFiles, userId, onNoteUpdated }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [addingToNotes, setAddingToNotes] = useState<number | null>(null);
  const [addedToNotes, setAddedToNotes] = useState<Set<number>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const q = input.trim();
    if (!q || loading) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: q }]);
    setLoading(true);
    try {
      const sourceDocuments = sourceFiles.map((f) => ({
        text: f.content,
        label: f.name.replace(/\.pdf$/i, ''),
      }));
      const res = await fetch('/api/chat-with-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noteContent: note.content,
          noteTopic: note.topic,
          sourceDocuments: sourceDocuments.length > 0 ? sourceDocuments : undefined,
          messages: messages.slice(-10),
          question: q,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to get reply');
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Chat failed');
    } finally {
      setLoading(false);
    }
  };

  const addToNotes = async (userMsg: string, assistantMsg: string, index: number) => {
    if (addedToNotes.has(index)) return;
    setAddingToNotes(index);
    try {
      const block = `

---
## Q&A (added from chat)

**Your question:** ${userMsg.replace(/\n/g, ' ')}

**Answer:** ${assistantMsg}
`;
      const updatedContent = note.content + block;
      await updateNoteContent(note.id, updatedContent, userId);
      setAddedToNotes((prev) => new Set(prev).add(index));
      onNoteUpdated();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add to notes');
    } finally {
      setAddingToNotes(null);
    }
  };

  return (
    <div className="border-t border-ink/10 bg-parchment/20">
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <MessageCircle className="w-5 h-5 text-sage" />
          <h4 className="font-medium text-ink">
            {sourceFiles.length > 0 ? 'Ask about the uploaded documents' : 'Ask about this note'}
          </h4>
        </div>
        <p className="text-sm text-ink/60 mb-4">
          {sourceFiles.length > 0
            ? 'Questions are answered using the original uploaded documents (tutorial Q&A, lecture slides, etc.), not the AI-generated notes.'
            : 'Ask questions on anything you don\'t understand. Add helpful answers to your notes.'}
        </p>

        <div className="rounded-lg border border-ink/10 bg-white overflow-hidden">
          <div className="max-h-64 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
            {messages.length === 0 && !loading && (
              <p className="text-ink/50 text-sm">
                {sourceFiles.length > 0
                  ? 'Ask a question about the uploaded documents...'
                  : 'Ask a question about the content above...'}
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-4 py-2 ${
                    m.role === 'user'
                      ? 'bg-accent text-white'
                      : 'bg-parchment/50 border border-ink/10'
                  }`}
                >
                  {m.role === 'assistant' ? (
                    <div>
                      <div
                        className="note-content prose prose-slate prose-sm max-w-none"
                        dangerouslySetInnerHTML={{
                          __html: marked(m.content) as string,
                        }}
                      />
                      <button
                        onClick={() => addToNotes(messages[i - 1]?.content ?? '', m.content, i)}
                        disabled={!!addingToNotes || addedToNotes.has(i)}
                        className="mt-2 flex items-center gap-1.5 text-xs text-sage hover:text-accent-dark disabled:opacity-50 disabled:cursor-default"
                      >
                        {addingToNotes === i ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : addedToNotes.has(i) ? (
                          '✓ Added to notes'
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            Add to notes
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm">{m.content}</p>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-parchment/50 border border-ink/10 rounded-lg px-4 py-2">
                  <Loader2 className="w-5 h-5 animate-spin text-sage" />
                </div>
              </div>
            )}
          </div>
          <div className="p-3 border-t border-ink/10 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Ask a question..."
              className="flex-1 px-3 py-2 rounded-lg border border-ink/20 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              disabled={loading}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="px-4 py-2 rounded-lg bg-accent text-white hover:bg-accent-dark disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
