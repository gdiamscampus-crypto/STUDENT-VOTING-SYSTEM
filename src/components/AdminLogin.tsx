/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, FormEvent } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, Lock, Eye, EyeOff, AlertTriangle, KeyRound } from 'lucide-react';
import { playSystemSound } from '../audio';

interface AdminLoginProps {
  correctPasswordHash: string; // The hashed/stored admin password
  onLoginSuccess: () => void;
}

export default function AdminLogin({ correctPasswordHash, onLoginSuccess }: AdminLoginProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    // Simulate validation with a tiny loading delay for high craft feel
    setTimeout(() => {
      if (password.trim() === correctPasswordHash) {
        playSystemSound('vote_success'); // Warm chime
        onLoginSuccess();
      } else {
        playSystemSound('warning_sound'); // Low warning beep
        setError('Incorrect Administrative Passcode. Access Denied.');
      }
      setIsSubmitting(false);
    }, 450);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3 }}
      className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8 max-w-md mx-auto space-y-6"
      id="admin-login-card"
    >
      <div className="text-center">
        <div className="inline-flex items-center justify-center p-3 bg-indigo-50 rounded-2xl text-indigo-600 mb-3 animate-pulse">
          <ShieldCheck className="h-7 w-7" id="login-shield-icon" />
        </div>
        <h2 className="text-xl font-black text-slate-900 tracking-tight">Admin Authorization</h2>
        <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
          Accessing candidate lists, voter rolls, custom synthesized chimes, and election configurations requires a secret passcode.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
            Administrative Passcode
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
              <Lock className="h-4.5 w-4.5" />
            </span>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              placeholder="Enter passcode (Default: admin123)"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              className="w-full pl-10 pr-11 py-2.5 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-mono transition-all"
              id="admin-passcode-input"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            >
              {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
            </button>
          </div>
        </div>

        {/* Quick Fill Helper */}
        <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-3 text-xs text-slate-600">
          <div className="flex gap-2">
            <span className="font-bold text-slate-500 text-[11px] uppercase tracking-wide">Developer Quickfill:</span>
            <button
              type="button"
              onClick={() => {
                setPassword(correctPasswordHash);
                setError(null);
              }}
              className="text-indigo-600 hover:text-indigo-700 font-bold underline text-[11px] cursor-pointer"
            >
              Autofill Default passcode
            </button>
          </div>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="flex gap-2.5 p-3.5 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs leading-relaxed"
            id="admin-login-error"
          >
            <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
            <span>{error}</span>
          </motion.div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !password}
          className="w-full py-3 px-4 bg-slate-950 hover:bg-slate-900 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center justify-center gap-2 cursor-pointer"
          id="admin-login-submit"
        >
          {isSubmitting ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Verifying authorization...</span>
            </>
          ) : (
            <>
              <KeyRound className="h-4 w-4" />
              <span>Unlock Admin Controls</span>
            </>
          )}
        </button>
      </form>
    </motion.div>
  );
}
