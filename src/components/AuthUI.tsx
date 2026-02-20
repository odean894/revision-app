'use client';

import { useState } from 'react';
import { LogIn, LogOut, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

export default function AuthUI() {
  const { user, loading, signIn, signUp, signOut } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      if (mode === 'signin') {
        await signIn(email, password);
        setShowModal(false);
      } else {
        await signUp(email, password);
        setSuccess('Check your email to confirm your account');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  };

  if (loading) return null;

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-ink/70 truncate max-w-[140px]" title={user.email}>
          <User className="w-4 h-4 inline mr-1" />
          {user.email}
        </span>
        <button
          onClick={() => signOut()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg text-ink/70 hover:bg-ink/5 hover:text-ink transition"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => {
          setShowModal(true);
          setMode('signin');
          setError('');
          setSuccess('');
        }}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-accent/50 text-accent hover:bg-accent/10 transition"
      >
        <LogIn className="w-4 h-4" />
        Sign in to sync
      </button>

      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-4"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-cream rounded-xl p-6 w-full max-w-md shadow-xl"
            >
              <h2 className="font-display text-xl text-ink mb-4">
                {mode === 'signin' ? 'Sign in' : 'Create account'}
              </h2>
              <p className="text-sm text-ink/60 mb-4">
                {mode === 'signin'
                  ? 'Sign in to sync your modules and notes across devices.'
                  : 'Create an account to save your data in the cloud and access it from any device.'}
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-lg border border-ink/20 focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-3 rounded-lg border border-ink/20 focus:outline-none focus:ring-2 focus:ring-accent"
                />
                {error && <p className="text-sm text-red-600">{error}</p>}
                {success && <p className="text-sm text-green-600">{success}</p>}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-3 bg-accent text-white rounded-lg hover:bg-accent-dark"
                  >
                    {mode === 'signin' ? 'Sign in' : 'Sign up'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-3 text-ink/70 hover:text-ink"
                  >
                    Cancel
                  </button>
                </div>
              </form>
              <p className="mt-4 text-sm text-ink/60">
                {mode === 'signin' ? (
                  <>
                    No account?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setMode('signup');
                        setError('');
                        setSuccess('');
                      }}
                      className="text-accent hover:underline"
                    >
                      Sign up
                    </button>
                  </>
                ) : (
                  <>
                    Have an account?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setMode('signin');
                        setError('');
                        setSuccess('');
                      }}
                      className="text-accent hover:underline"
                    >
                      Sign in
                    </button>
                  </>
                )}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
