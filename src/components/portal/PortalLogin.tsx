import { useState, useEffect } from 'react';
import { useCustomerPortal } from '../../contexts/CustomerPortalContext';
import { Mail, Loader2, LogIn, Lock, Eye, EyeOff } from 'lucide-react';

export function PortalLogin() {
  const { user, branding, loginWithToken, loginWithEmail, loginWithPassword, loading } = useCustomerPortal();
  const [loginMethod, setLoginMethod] = useState<'password' | 'magic-link'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (token) {
      handleTokenLogin(token);
    }
  }, []);

  useEffect(() => {
    // Don't auto-redirect from a stale localStorage user when a fresh token
    // is being processed in the URL. handleTokenLogin will redirect itself
    // once the new token resolves to the right customer. Without this guard
    // every magic link opened in the same browser session jumped to whoever
    // was last logged in instead of the link's actual customer
    // (Jamie reported 2026-05-09).
    const hasUrlToken = !!new URLSearchParams(window.location.search).get('token');
    if (hasUrlToken) return;

    if (user && user.customer_id) {
      window.location.href = `/portal/customer/${user.customer_id}`;
    }
  }, [user]);

  const handleTokenLogin = async (token: string) => {
    setSubmitting(true);
    const result = await loginWithToken(token);

    if (typeof result === 'object' && result.requiresSetup) {
      window.location.href = `/portal/setup-password?token=${result.setupToken}&email=${encodeURIComponent(result.email)}`;
      return;
    }

    if (result === true) {
      const storedUser = localStorage.getItem('customer_portal_user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        if (parsed.customer_id) {
          window.location.href = `/portal/customer/${parsed.customer_id}`;
          return;
        }
      }
      window.location.href = '/portal/login';
    } else {
      setMessage('Invalid or expired token. Please contact support.');
      setSubmitting(false);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setSubmitting(true);
    setMessage('');

    const result = await loginWithPassword(email, password);
    if (result.success) {
      const storedUser = localStorage.getItem('customer_portal_user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        if (parsed.customer_id) {
          window.location.href = `/portal/customer/${parsed.customer_id}`;
          return;
        }
      }
      window.location.href = '/portal/login';
    } else if (result.requiresSetup) {
      setMessage('Please check your email for a password setup link.');
    } else {
      setMessage(result.error || 'Invalid email or password. Please try again.');
    }
    setSubmitting(false);
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setSubmitting(true);
    setMessage('');

    const success = await loginWithEmail(email);
    if (success) {
      setMessage('Magic link sent! Check your email to sign in.');
    } else {
      setMessage('Email not found. Please check your email address or contact support.');
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8">
        <div className="text-center mb-8">
          {/* 2026-06-11 [3.2-3] — company branding on the login screen.
              Resolved pre-auth from the subdomain (CustomerPortalContext).
              Falls back to the generic icon when no company matches. */}
          {(branding?.company_logo_primary_url || branding?.logo_url) ? (
            <img
              src={branding.company_logo_primary_url || branding.logo_url || ''}
              alt={branding.company_name}
              className="h-14 w-auto mx-auto mb-4 object-contain"
            />
          ) : (
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <LogIn className="w-8 h-8 text-white" />
            </div>
          )}
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {branding?.company_name ? `${branding.company_name} Customer Portal` : 'Customer Portal'}
          </h1>
          <p className="text-gray-600">
            Access your invoices, quotes, proofs, and order history
          </p>
        </div>

        <div className="flex gap-2 mb-6 bg-gray-100 rounded-lg p-1">
          <button
            type="button"
            onClick={() => {
              setLoginMethod('password');
              setMessage('');
            }}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              loginMethod === 'password'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Lock className="w-4 h-4 inline mr-2" />
            Password
          </button>
          <button
            type="button"
            onClick={() => {
              setLoginMethod('magic-link');
              setMessage('');
            }}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              loginMethod === 'magic-link'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Mail className="w-4 h-4 inline mr-2" />
            Magic Link
          </button>
        </div>

        {loginMethod === 'password' ? (
          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="your@email.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                  autoComplete="current-password"
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {message && (
              <div className={`p-3 rounded-lg ${
                message.includes('Invalid') || message.includes('not found')
                  ? 'bg-red-50 text-red-800 border border-red-200'
                  : 'bg-blue-50 text-blue-800 border border-blue-200'
              }`}>
                <p className="text-sm">{message}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Signing In...
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Sign In
                </>
              )}
            </button>

            <div className="text-center">
              <a
                href="/portal/forgot-password"
                className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
              >
                Forgot your password?
              </a>
            </div>
          </form>
        ) : (
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="your@email.com"
                  required
                />
              </div>
            </div>

            {message && (
              <div className={`p-3 rounded-lg ${
                message.includes('not found') || message.includes('Invalid')
                  ? 'bg-red-50 text-red-800 border border-red-200'
                  : 'bg-blue-50 text-blue-800 border border-blue-200'
              }`}>
                <p className="text-sm">{message}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Sending Link...
                </>
              ) : (
                <>
                  <Mail className="w-5 h-5" />
                  Send Magic Link
                </>
              )}
            </button>
          </form>
        )}

        <div className="mt-6 pt-6 border-t border-gray-200 text-center">
          <p className="text-sm text-gray-600">
            Need help? Contact support
          </p>
        </div>
      </div>
    </div>
  );
}
