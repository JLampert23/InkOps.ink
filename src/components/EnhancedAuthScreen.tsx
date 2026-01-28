import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Lock, Mail, AlertCircle, Loader2, Building2, Eye, EyeOff } from 'lucide-react';

export function EnhancedAuthScreen() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { signIn, signUpWithCompany, resetPassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      if (isForgotPassword) {
        const { error } = await resetPassword(email);
        if (error) {
          setError(error.message);
        } else {
          setSuccessMessage('Password reset email sent! Check your inbox.');
        }
        setLoading(false);
        return;
      }

      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        setLoading(false);
        return;
      }

      if (isSignUp) {
        if (!companyName.trim()) {
          setError('Company name is required');
          setLoading(false);
          return;
        }

        const { error } = await signUpWithCompany({
          email,
          password,
          companyName: companyName.trim(),
        });

        if (error) {
          setError(error.message);
        } else {
          setSuccessMessage('Company account created successfully! Please sign in to set up your integrations.');
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          setError(error.message);
        }
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('Auth error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 p-8 sm:p-10 backdrop-blur-sm">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center mb-6 transform hover:scale-105 transition-transform duration-200">
              <img
                src="/create_variation_b_f.png"
                alt="InkOps Logo"
                className="h-40 w-auto"
              />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3 tracking-tight">
              {isForgotPassword ? 'Reset Password' : isSignUp ? 'Create Company Account' : 'Welcome Back'}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-base leading-relaxed">
              {isForgotPassword
                ? 'Enter your email to receive a password reset link'
                : isSignUp
                ? 'Set up your InkOps account'
                : 'Sign in to InkOps'}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30 border-2 border-red-300 dark:border-red-800 rounded-xl flex items-start gap-3 backdrop-blur-sm">
              <div className="bg-red-100 dark:bg-red-900/50 p-2 rounded-lg flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <p className="text-sm text-red-800 dark:text-red-300 leading-relaxed">{error}</p>
            </div>
          )}

          {successMessage && (
            <div className="mb-6 p-4 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border-2 border-emerald-300 dark:border-emerald-800 rounded-xl flex items-start gap-3 backdrop-blur-sm">
              <div className="bg-emerald-100 dark:bg-emerald-900/50 p-2 rounded-lg flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-sm text-emerald-800 dark:text-emerald-300 leading-relaxed">{successMessage}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {isSignUp && !isForgotPassword && (
              <div>
                <label htmlFor="companyName" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2.5">
                  Company Name
                </label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400 transition-colors">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <input
                    id="companyName"
                    type="text"
                    required={isSignUp}
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 bg-gray-50 dark:bg-slate-900/50 border-2 border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 transition-all duration-200 placeholder:text-gray-400 dark:placeholder:text-gray-600"
                    placeholder="Your Company Name"
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2.5">
                Email Address
              </label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400 transition-colors">
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-gray-50 dark:bg-slate-900/50 border-2 border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 transition-all duration-200 placeholder:text-gray-400 dark:placeholder:text-gray-600"
                  placeholder="you@company.com"
                />
              </div>
            </div>

            {!isForgotPassword && (
              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2.5">
                  Password
                </label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400 transition-colors">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-12 py-3.5 bg-gray-50 dark:bg-slate-900/50 border-2 border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 transition-all duration-200 placeholder:text-gray-400 dark:placeholder:text-gray-600"
                    placeholder={isSignUp ? 'At least 6 characters' : 'Enter your password'}
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-br from-blue-600 to-blue-700 dark:from-blue-500 dark:to-blue-600 text-white py-4 rounded-xl font-semibold text-base hover:from-blue-700 hover:to-blue-800 dark:hover:from-blue-600 dark:hover:to-blue-700 focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-900 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30 dark:shadow-blue-900/30 hover:scale-[1.01] active:scale-[0.99]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>
                    {isForgotPassword ? 'Sending Reset Link...' : isSignUp ? 'Creating Account...' : 'Signing In...'}
                  </span>
                </>
              ) : (
                <span>{isForgotPassword ? 'Send Reset Link' : isSignUp ? 'Create Company Account' : 'Sign In'}</span>
              )}
            </button>
          </form>

          {!isSignUp && !isForgotPassword && (
            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsForgotPassword(true);
                  setError(null);
                  setSuccessMessage(null);
                }}
                className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors hover:underline underline-offset-2"
              >
                Forgot your password?
              </button>
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-slate-700 text-center">
            <button
              type="button"
              onClick={() => {
                if (isForgotPassword) {
                  setIsForgotPassword(false);
                } else {
                  setIsSignUp(!isSignUp);
                }
                setError(null);
                setSuccessMessage(null);
                setCompanyName('');
              }}
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
            >
              {isForgotPassword ? (
                <>
                  Remember your password?{' '}
                  <span className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">Sign in</span>
                </>
              ) : isSignUp ? (
                <>
                  Already have an account?{' '}
                  <span className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">Sign in</span>
                </>
              ) : (
                <>
                  Don't have an account?{' '}
                  <span className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">Create company account</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="text-center mt-8 space-y-2">
          <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
            Secure multi-tenant authentication powered by Supabase
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            All API tokens are encrypted with AES-256-GCM
          </p>
        </div>
      </div>
    </div>
  );
}
