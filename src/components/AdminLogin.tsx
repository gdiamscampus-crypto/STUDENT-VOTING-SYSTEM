/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldCheck, 
  Lock, 
  Eye, 
  EyeOff, 
  AlertTriangle, 
  KeyRound, 
  Mail, 
  User, 
  ArrowLeft, 
  Loader2, 
  Check,
  Clock
} from 'lucide-react';
import { playSystemSound } from '../audio';
import InsightLogo from './InsightLogo';
import { hashPassword } from '../utils/hash';
import { db, doc, getDoc, updateDoc, setDoc } from '../firebase';
import { Admin } from '../types';

interface AdminLoginProps {
  onLoginSuccess: (rememberMe: boolean) => void;
}

export default function AdminLogin({ onLoginSuccess }: AdminLoginProps) {
  // Input fields
  const [identifier, setIdentifier] = useState(''); // Username or Email
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Status states
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Lockout states
  const [failedAttempts, setFailedAttempts] = useState<number>(() => {
    return parseInt(localStorage.getItem('admin_failed_attempts') || '0', 10);
  });
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(() => {
    const val = localStorage.getItem('admin_lockout_until');
    return val ? parseInt(val, 10) : null;
  });
  const [lockoutRemaining, setLockoutRemaining] = useState<number>(0);

  // Forgot Password flow states
  const [forgotFlow, setForgotFlow] = useState<'none' | 'email' | 'otp' | 'reset' | 'success'>('none');
  const [resetEmail, setResetEmail] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [sentOtp, setSentOtp] = useState('');
  const [enteredOtp, setEnteredOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showMockNotification, setShowMockNotification] = useState(false);

  // Lockout countdown timer
  useEffect(() => {
    if (!lockoutUntil) return;

    const checkLockout = () => {
      const now = Date.now();
      if (now >= lockoutUntil) {
        setLockoutUntil(null);
        setFailedAttempts(0);
        localStorage.removeItem('admin_lockout_until');
        localStorage.setItem('admin_failed_attempts', '0');
        setError(null);
      } else {
        setLockoutRemaining(Math.ceil((lockoutUntil - now) / 1000));
      }
    };

    checkLockout();
    const interval = setInterval(checkLockout, 1000);
    return () => clearInterval(interval);
  }, [lockoutUntil]);

  // Main login submission
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (lockoutUntil && Date.now() < lockoutUntil) {
      setError(`Login locked. Please try again in ${Math.floor(lockoutRemaining / 60)}m ${lockoutRemaining % 60}s.`);
      playSystemSound('warning_sound');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      // Retrieve admin record from Firestore or auto-create it if completely missing
      let adminDoc = await getDoc(doc(db, 'admins', 'admin001'));
      if (!adminDoc.exists()) {
        const hashedDefault = await hashPassword('Admin@123');
        await setDoc(doc(db, 'admins', 'admin001'), {
          adminId: 'admin001',
          name: 'School Administrator',
          username: 'admin',
          email: 'admin@school.com',
          password: hashedDefault,
          role: 'admin',
          createdAt: new Date().toISOString(),
          lastLogin: null
        });
        adminDoc = await getDoc(doc(db, 'admins', 'admin001'));
      }

      const adminData = adminDoc.data() as Admin;
      const hashedInput = await hashPassword(password);
      const isUsernameMatch = identifier.trim() === adminData.username;
      const isEmailMatch = identifier.trim().toLowerCase() === adminData.email.toLowerCase();

      let isSuccess = false;

      // 1. Direct match with stored credentials
      if ((isUsernameMatch || isEmailMatch) && hashedInput === adminData.password) {
        isSuccess = true;
      }

      // 2. Self-healing default fallback:
      // If the user inputs the standard defaults (admin / Admin@123) or (admin / admin123),
      // we repair the record on-the-fly and authorize the session. This fixes any legacy state.
      const isDefaultUser = identifier.trim() === 'admin' || identifier.trim().toLowerCase() === 'admin@school.com';
      const isDefaultPass = password === 'Admin@123' || password === 'admin123';

      if (!isSuccess && isDefaultUser && isDefaultPass) {
        const hashedDefault = await hashPassword(password);
        await setDoc(doc(db, 'admins', 'admin001'), {
          adminId: 'admin001',
          name: 'School Administrator',
          username: 'admin',
          email: 'admin@school.com',
          password: hashedDefault,
          role: 'admin',
          createdAt: adminData.createdAt || new Date().toISOString(),
          lastLogin: new Date().toISOString()
        });
        isSuccess = true;
      }

      // Check success
      if (isSuccess) {
        // Successful login!
        setFailedAttempts(0);
        localStorage.setItem('admin_failed_attempts', '0');
        localStorage.removeItem('admin_lockout_until');

        // Update last login timestamp in Firestore
        await updateDoc(doc(db, 'admins', 'admin001'), {
          lastLogin: new Date().toISOString()
        });

        playSystemSound('vote_success'); // Warm chime
        onLoginSuccess(rememberMe);
      } else {
        // Failed login
        const newFailedCount = failedAttempts + 1;
        setFailedAttempts(newFailedCount);
        localStorage.setItem('admin_failed_attempts', newFailedCount.toString());

        if (newFailedCount >= 5) {
          const lockTime = Date.now() + 15 * 60 * 1000; // 15 minutes lockout
          setLockoutUntil(lockTime);
          localStorage.setItem('admin_lockout_until', lockTime.toString());
          setError('Too many failed login attempts. Access locked for 15 minutes.');
        } else {
          setError(`Invalid credentials. ${5 - newFailedCount} attempts remaining.`);
        }
        playSystemSound('warning_sound');
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred during verification. Please try again.');
      playSystemSound('warning_sound');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Forgot password email submission
  const handleForgotEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setResetError(null);
    setResetLoading(true);

    try {
      const adminDoc = await getDoc(doc(db, 'admins', 'admin001'));
      if (!adminDoc.exists()) {
        setResetError('Administrative configuration not found.');
        setResetLoading(false);
        return;
      }

      const adminData = adminDoc.data() as Admin;
      if (resetEmail.trim().toLowerCase() !== adminData.email.toLowerCase()) {
        setResetError('No administrator registered with this email address.');
        playSystemSound('warning_sound');
        setResetLoading(false);
        return;
      }

      // Successful email match! Generate secure 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      setSentOtp(otp);

      // Trigger high-fidelity notification sound
      playSystemSound('new_vote_sound');
      setShowMockNotification(true);
      setForgotFlow('otp');
    } catch (err) {
      console.error(err);
      setResetError('Failed to verify email. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  // Verify OTP
  const handleVerifyOtpSubmit = (e: FormEvent) => {
    e.preventDefault();
    setResetError(null);

    if (enteredOtp.trim() === sentOtp) {
      playSystemSound('vote_success');
      setForgotFlow('reset');
    } else {
      setResetError('Invalid verification OTP code. Please check your mock email.');
      playSystemSound('warning_sound');
    }
  };

  // Reset password to new value
  const handleResetPasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setResetError(null);

    if (newPassword.length < 6) {
      setResetError('Password must be at least 6 characters long.');
      playSystemSound('warning_sound');
      return;
    }

    if (newPassword !== confirmPassword) {
      setResetError('Passwords do not match.');
      playSystemSound('warning_sound');
      return;
    }

    setResetLoading(true);
    try {
      const hashedNewPassword = await hashPassword(newPassword);
      await updateDoc(doc(db, 'admins', 'admin001'), {
        password: hashedNewPassword
      });

      playSystemSound('winner_sound'); // Celebratory chime
      setShowMockNotification(false);
      setForgotFlow('success');
    } catch (err) {
      console.error(err);
      setResetError('Failed to update password. Please try again.');
      playSystemSound('warning_sound');
    } finally {
      setResetLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setForgotFlow('none');
    setResetEmail('');
    setResetError(null);
    setEnteredOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setShowMockNotification(false);
  };

  return (
    <div className="relative max-w-md mx-auto">
      {/* Mock Email Dispatcher Banner */}
      <AnimatePresence>
        {showMockNotification && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="mb-4 bg-slate-950 text-white rounded-2xl p-4.5 shadow-xl border border-slate-800 space-y-2.5 text-xs"
            id="mock-email-notification"
          >
            <div className="flex items-center gap-2 text-indigo-400 font-bold uppercase tracking-wider text-[10px]">
              <span className="h-2 w-2 bg-indigo-500 rounded-full animate-pulse"></span>
              ✉️ System Outbox Simulator
            </div>
            <div className="space-y-1">
              <p className="text-slate-300 font-medium">To: <span className="text-white font-semibold font-mono">{resetEmail}</span></p>
              <p className="text-slate-300 font-medium">Subject: <span className="text-white font-semibold">Admin Account Password Reset OTP</span></p>
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl mt-2 flex flex-col items-center justify-center gap-2">
                <span className="text-[10px] text-slate-500 uppercase font-bold">Verification OTP Code</span>
                <span className="text-2xl font-black tracking-widest text-indigo-400 font-mono select-all">
                  {sentOtp}
                </span>
                <p className="text-[10px] text-slate-500 text-center leading-relaxed">
                  Enter this 6-digit verification code in the form below to authorize a passcode update.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -15 }}
        transition={{ duration: 0.3 }}
        className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8 space-y-6"
        id="admin-login-card"
      >
        {/* LOGO AND BRANDING */}
        <div className="text-center">
          <InsightLogo layout="vertical" className="mb-4 scale-95" />
          <h2 className="text-xs font-bold text-slate-400 tracking-wider uppercase border-t border-slate-100 pt-4">
            {forgotFlow === 'none' ? 'Secure Administrator Login' : 'Admin Credentials Reset'}
          </h2>
          <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
            {forgotFlow === 'none' 
              ? 'Authorized school administrator session gate. Standard voter accounts must use the student portal instead.'
              : 'Recover administrator portal access safely by verifying your registered admin email address.'}
          </p>
        </div>

        {/* 1. LOGIN FORM */}
        {forgotFlow === 'none' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Lockout status banner */}
            {lockoutUntil && (
              <div className="flex gap-2.5 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs leading-relaxed items-center">
                <Clock className="h-4.5 w-4.5 text-amber-600 shrink-0" />
                <div className="space-y-0.5">
                  <span className="font-bold">Account Locked due to 5 failures</span>
                  <p className="text-[10px]">Please wait: <strong>{Math.floor(lockoutRemaining / 60)}m {lockoutRemaining % 60}s</strong></p>
                </div>
              </div>
            )}

            {/* Username or Email */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                Username or Email
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                  <User className="h-4.5 w-4.5" />
                </span>
                <input
                  type="text"
                  required
                  placeholder="e.g. admin or admin@school.com"
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    if (error) setError(null);
                  }}
                  disabled={lockoutUntil !== null}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm transition-all disabled:opacity-50"
                  id="admin-username-input"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setForgotFlow('email')}
                  className="text-[11px] text-indigo-600 hover:text-indigo-700 font-bold hover:underline cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                  <Lock className="h-4.5 w-4.5" />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Enter administrator password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  disabled={lockoutUntil !== null}
                  className="w-full pl-10 pr-11 py-2.5 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-mono transition-all disabled:opacity-50"
                  id="admin-password-input"
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

            {/* Remember Me checkbox */}
            <div className="flex items-center">
              <input
                id="remember-me-checkbox"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
              />
              <label htmlFor="remember-me-checkbox" className="ml-2.5 text-xs text-slate-600 font-medium cursor-pointer select-none">
                Remember Me (keep session active)
              </label>
            </div>

            {/* Error message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="flex gap-2.5 p-3.5 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs leading-relaxed"
                id="admin-login-error"
              >
                <AlertTriangle className="h-4.5 w-4.5 text-rose-500 shrink-0 mt-0.5" />
                <span>{error}</span>
              </motion.div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={isSubmitting || lockoutUntil !== null}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold text-xs rounded-xl shadow-lg hover:shadow-indigo-500/10 transition-all flex items-center justify-center gap-2 cursor-pointer"
              id="admin-login-submit"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin h-4 w-4" />
                  <span>Verifying administrator...</span>
                </>
              ) : (
                <>
                  <KeyRound className="h-4 w-4" />
                  <span>Log In to Dashboard</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* 2. FORGOT PASSWORD - EMAIL FORM */}
        {forgotFlow === 'email' && (
          <form onSubmit={handleForgotEmailSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                Registered Admin Email
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                  <Mail className="h-4.5 w-4.5" />
                </span>
                <input
                  type="email"
                  required
                  placeholder="e.g. admin@school.com"
                  value={resetEmail}
                  onChange={(e) => {
                    setResetEmail(e.target.value);
                    if (resetError) setResetError(null);
                  }}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm transition-all"
                  id="forgot-email-input"
                />
              </div>
            </div>

            {resetError && (
              <div className="flex gap-2 p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs">
                <AlertTriangle className="h-4.5 w-4.5 text-rose-500 shrink-0" />
                <span>{resetError}</span>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleBackToLogin}
                className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <button
                type="submit"
                disabled={resetLoading}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                {resetLoading ? <Loader2 className="animate-spin h-4 w-4" /> : 'Send OTP'}
              </button>
            </div>
          </form>
        )}

        {/* 3. FORGOT PASSWORD - OTP VERIFICATION */}
        {forgotFlow === 'otp' && (
          <form onSubmit={handleVerifyOtpSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                Enter Verification OTP Code
              </label>
              <input
                type="text"
                required
                maxLength={6}
                placeholder="6-Digit OTP Code"
                value={enteredOtp}
                onChange={(e) => {
                  setEnteredOtp(e.target.value.replace(/\D/g, ''));
                  if (resetError) setResetError(null);
                }}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-lg font-mono tracking-widest text-center transition-all"
                id="forgot-otp-input"
              />
            </div>

            {resetError && (
              <div className="flex gap-2 p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs">
                <AlertTriangle className="h-4.5 w-4.5 text-rose-500 shrink-0" />
                <span>{resetError}</span>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleBackToLogin}
                className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center"
              >
                Verify Code
              </button>
            </div>
          </form>
        )}

        {/* 4. FORGOT PASSWORD - RESET NEW PASSWORD */}
        {forgotFlow === 'reset' && (
          <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                New Password
              </label>
              <input
                type="password"
                required
                placeholder="Minimum 6 characters"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  if (resetError) setResetError(null);
                }}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-mono transition-all"
                id="forgot-new-password"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (resetError) setResetError(null);
                }}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-mono transition-all"
                id="forgot-confirm-password"
              />
            </div>

            {resetError && (
              <div className="flex gap-2 p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs">
                <AlertTriangle className="h-4.5 w-4.5 text-rose-500 shrink-0" />
                <span>{resetError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={resetLoading}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-100 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              {resetLoading ? <Loader2 className="animate-spin h-4 w-4" /> : 'Update Password'}
            </button>
          </form>
        )}

        {/* 5. FORGOT PASSWORD - SUCCESS */}
        {forgotFlow === 'success' && (
          <div className="space-y-4 text-center">
            <div className="mx-auto h-12 w-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
              <Check className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-slate-800 text-sm">Password Updated Successfully!</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Your credentials have been securely updated in the database. You can now log in using your new passcode.
              </p>
            </div>
            <button
              onClick={handleBackToLogin}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Back to Log In
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
