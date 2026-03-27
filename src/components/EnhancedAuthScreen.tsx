import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Lock, Mail, AlertCircle, Loader2, Building2, Eye, EyeOff, ArrowLeft } from 'lucide-react';

interface EnhancedAuthScreenProps {
  onBackClick?: () => void;
}

export function EnhancedAuthScreen({ onBackClick }: EnhancedAuthScreenProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
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
          setSuccessMessage('Account created! You can now sign in.');
          setIsSignUp(false);
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
    <div className="min-h-screen flex">
      {/* Left Panel - Blue Branding */}
      <div className="hidden lg:flex lg:w-[40%] bg-gradient-to-br from-[#2563eb] via-[#1d4ed8] to-[#1e40af] relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-400/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 left-20 flex gap-3">
          <div className="w-2 h-2 bg-white/40 rounded-full"></div>
          <div className="w-2 h-2 bg-white/40 rounded-full"></div>
          <div className="w-2 h-2 bg-white/40 rounded-full"></div>
          <div className="w-2 h-2 bg-white/40 rounded-full"></div>
          <div className="w-2 h-2 bg-white/40 rounded-full"></div>
        </div>

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo */}
          <div className="flex items-center">
            <img
              src="/InkOps-01-copy.png"
              alt="InkOps Pro"
              className="h-16 w-auto"
            />
          </div>

          {/* Main messaging */}
          <div className="space-y-6">
            <h2 className="text-white text-5xl font-bold leading-tight">
              Imprinted Apparel<br />Operations System
            </h2>
            <p className="text-blue-100 text-xl font-light">
              Quote - Art - Receive - Schedule - Invoice - Payment
            </p>
          </div>

          <div className="h-20"></div>
        </div>
      </div>

      {/* Right Panel - Sign In Form */}
      <div className="flex-1 bg-gray-50 flex items-center justify-center p-6 sm:p-8">
        <div className="w-full max-w-md">
          {onBackClick && (
            <button
              onClick={onBackClick}
              className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span className="text-sm font-medium">Back to Home</span>
            </button>
          )}

          {/* Mobile Logo - Only shown on small screens */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center mb-6">
              <img
                src="/InkOps-01-copy.png"
                alt="InkOps Pro"
                className="h-12 w-auto"
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 sm:p-10">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {isForgotPassword ? 'Reset Password' : isSignUp ? 'Create Account' : 'Sign in to InkOps Pro'}
              </h2>
              <p className="text-gray-600">
                {isForgotPassword
                  ? 'Enter your email to receive a password reset link'
                  : isSignUp
                  ? 'Get started with InkOps'
                  : 'Use your work email to access your shop.'}
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {successMessage && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-green-800">{successMessage}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {isSignUp && !isForgotPassword && (
                <div>
                  <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-2">
                    Company Name
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      id="companyName"
                      type="text"
                      required={isSignUp}
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      placeholder="Your Company Name"
                    />
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder="Email address"
                  />
                </div>
              </div>

              {!isForgotPassword && (
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-11 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      placeholder="Password"
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              )}

              {!isSignUp && !isForgotPassword && (
                <div className="flex items-center justify-between">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Remember me</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotPassword(true);
                      setError(null);
                      setSuccessMessage(null);
                    }}
                    className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{isForgotPassword ? 'Sending...' : isSignUp ? 'Creating...' : 'Signing in...'}</span>
                  </>
                ) : (
                  <span>{isForgotPassword ? 'Send Reset Link' : isSignUp ? 'Create Account' : 'Sign in'}</span>
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
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
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                {isForgotPassword ? (
                  <>
                    Remember your password?{' '}
                    <span className="font-medium text-blue-600 hover:underline">Sign in</span>
                  </>
                ) : isSignUp ? (
                  <>
                    Already have an account?{' '}
                    <span className="font-medium text-blue-600 hover:underline">Sign in</span>
                  </>
                ) : (
                  <>
                    Don't have an account?{' '}
                    <span className="font-medium text-blue-600 hover:underline">Contact account</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              © InkOps Pro - Imprinted Apparel Operations System
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
