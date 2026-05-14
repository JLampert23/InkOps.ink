import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase-client';
import { Lock, Loader2, CheckCircle2, XCircle, Eye, EyeOff } from 'lucide-react';

// 2026-05-14 — closes Phase 3.1 T1-D (Inkops branded password reset).
//
// Flow: admin clicks "Forgot password" on EnhancedAuthScreen → Supabase
// emails them a link → link lands on /reset-password with a recovery
// token in the URL hash → supabase-js auto-processes the hash, fires
// onAuthStateChange with event='PASSWORD_RECOVERY' and creates a
// time-limited session → this page accepts a new password via
// supabase.auth.updateUser({ password }) → sign out → redirect to login.
//
// Mirrors PortalResetPassword's password rules (8 chars, mixed case, number)
// but uses Supabase's native auth instead of a custom token RPC.
export function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  // Until Supabase finishes processing the recovery token in the URL hash
  // (a few ms after mount), we don't know whether there's a valid
  // recovery session. Show a spinner during that window so the user
  // doesn't see a flicker of the "invalid link" screen.
  const [resolvingRecovery, setResolvingRecovery] = useState(true);
  const [recoveryReady, setRecoveryReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // 1) If we land on this page with a recovery hash, supabase-js will
    //    fire PASSWORD_RECOVERY shortly after mount. Hook it.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === 'PASSWORD_RECOVERY' && session) {
        setRecoveryReady(true);
        setResolvingRecovery(false);
      }
    });

    // 2) Also check for an already-present session in case the user
    //    refreshed the page after the hash was processed (then the
    //    PASSWORD_RECOVERY event has already fired and we missed it).
    //    A short window is enough — supabase-js processes the hash
    //    synchronously on init.
    const timeout = setTimeout(async () => {
      if (cancelled) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setRecoveryReady(true);
      }
      setResolvingRecovery(false);
    }, 800);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const validatePassword = (pwd: string): { valid: boolean } => {
    return {
      valid:
        pwd.length >= 8
        && /[A-Z]/.test(pwd)
        && /[a-z]/.test(pwd)
        && /[0-9]/.test(pwd),
    };
  };

  const passwordValidation = validatePassword(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!passwordValidation.valid) {
      setMessage('Please meet all password requirements');
      return;
    }
    if (password !== confirmPassword) {
      setMessage('Passwords do not match');
      return;
    }

    setSubmitting(true);
    setMessage('');

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setSuccess(true);
      setMessage('Password reset successfully. Signing you out and redirecting to login…');

      // Sign out so the next sign-in uses the new password — Supabase
      // would otherwise leave the recovery session active and skip the
      // login screen entirely, which is confusing.
      setTimeout(async () => {
        try {
          await supabase.auth.signOut();
        } finally {
          window.location.href = '/login';
        }
      }, 1500);
    } catch (err: any) {
      console.error('Password reset failed:', err);
      setMessage(err?.message || 'Failed to reset password. The link may be expired — please request a new one.');
    } finally {
      setSubmitting(false);
    }
  };

  if (resolvingRecovery) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full p-8 text-center">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Verifying reset link…</p>
        </div>
      </div>
    );
  }

  if (!recoveryReady) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full p-8 text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Invalid or Expired Link</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            This password reset link is invalid or has expired. Please request a new one from the login screen.
          </p>
          <a
            href="/login"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Set a New Password</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Choose a new password for your InkOps account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">New Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting || success}
                className="w-full pl-10 pr-12 py-3 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 dark:disabled:bg-slate-700 disabled:cursor-not-allowed bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                placeholder="Enter new password"
                required
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {password && (
              <div className="mt-2 space-y-1">
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Password must contain:</p>
                <div className="space-y-1">
                  <Requirement met={password.length >= 8} text="At least 8 characters" />
                  <Requirement met={/[A-Z]/.test(password)} text="One uppercase letter" />
                  <Requirement met={/[a-z]/.test(password)} text="One lowercase letter" />
                  <Requirement met={/[0-9]/.test(password)} text="One number" />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Confirm Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={submitting || success}
                className="w-full pl-10 pr-12 py-3 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 dark:disabled:bg-slate-700 disabled:cursor-not-allowed bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                placeholder="Confirm new password"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {confirmPassword && password !== confirmPassword && (
              <p className="mt-1 text-xs text-red-600">Passwords do not match</p>
            )}
          </div>

          {message && (
            <div
              className={`p-3 rounded-lg ${
                success
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800'
                  : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800'
              }`}
            >
              <p className="text-sm">{message}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || success || !passwordValidation.valid || password !== confirmPassword}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Resetting Password…
              </>
            ) : success ? (
              <>
                <CheckCircle2 className="w-5 h-5" />
                Password Reset!
              </>
            ) : (
              <>
                <Lock className="w-5 h-5" />
                Reset Password
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-slate-700 text-center">
          <a href="/login" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
            Back to Login
          </a>
        </div>
      </div>
    </div>
  );
}

function Requirement({ met, text }: { met: boolean; text: string }) {
  return (
    <div className="flex items-center gap-2">
      {met ? (
        <CheckCircle2 className="w-4 h-4 text-green-500" />
      ) : (
        <XCircle className="w-4 h-4 text-gray-300 dark:text-gray-600" />
      )}
      <span className={`text-xs ${met ? 'text-green-700 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
        {text}
      </span>
    </div>
  );
}
