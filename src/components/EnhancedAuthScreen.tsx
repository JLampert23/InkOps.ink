import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Lock, Mail, AlertCircle, Loader2, Building2, User, Key } from 'lucide-react';

export function EnhancedAuthScreen() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [printavoUsername, setPrintavoUsername] = useState('');
  const [printavoApiToken, setPrintavoApiToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { signIn, signUpWithCompany } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        if (!companyName.trim()) {
          setError('Company name is required');
          setLoading(false);
          return;
        }

        if (!printavoUsername.trim()) {
          setError('Printavo username is required');
          setLoading(false);
          return;
        }

        if (!printavoApiToken.trim()) {
          setError('Printavo API token is required');
          setLoading(false);
          return;
        }

        const { error } = await signUpWithCompany({
          email,
          password,
          companyName: companyName.trim(),
          printavoUsername: printavoUsername.trim(),
          printavoApiToken: printavoApiToken.trim(),
        });

        if (error) {
          setError(error.message);
        } else {
          setSuccessMessage('Company account created successfully!');
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-xl mb-4">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {isSignUp ? 'Create Company Account' : 'Welcome Back'}
            </h1>
            <p className="text-gray-600">
              {isSignUp
                ? 'Set up your Printavo Financial Dashboard'
                : 'Sign in to your financial dashboard'}
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
            {isSignUp && (
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
                    className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="Your Company Name"
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="you@company.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder={isSignUp ? 'At least 6 characters' : 'Enter your password'}
                  minLength={6}
                />
              </div>
            </div>

            {isSignUp && (
              <>
                <div className="border-t border-gray-200 pt-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Key className="w-4 h-4 text-blue-600" />
                    Printavo API Credentials
                  </h3>
                  <p className="text-xs text-gray-600 mb-4">
                    Your Printavo credentials are encrypted and stored securely. They're used to sync your financial data.
                  </p>
                </div>

                <div>
                  <label htmlFor="printavoUsername" className="block text-sm font-medium text-gray-700 mb-2">
                    Printavo Username (Email)
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      id="printavoUsername"
                      type="email"
                      required={isSignUp}
                      value={printavoUsername}
                      onChange={(e) => setPrintavoUsername(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="your-printavo-email@company.com"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="printavoApiToken" className="block text-sm font-medium text-gray-700 mb-2">
                    Printavo API Token
                  </label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      id="printavoApiToken"
                      type="password"
                      required={isSignUp}
                      value={printavoApiToken}
                      onChange={(e) => setPrintavoApiToken(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="Enter your Printavo API token"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1.5">
                    Find your API token in Printavo under Settings → API Settings
                  </p>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{isSignUp ? 'Creating Account...' : 'Signing In...'}</span>
                </>
              ) : (
                <span>{isSignUp ? 'Create Company Account' : 'Sign In'}</span>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
                setSuccessMessage(null);
                setCompanyName('');
                setPrintavoUsername('');
                setPrintavoApiToken('');
              }}
              className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
            >
              {isSignUp ? (
                <>
                  Already have an account?{' '}
                  <span className="font-medium text-blue-600">Sign in</span>
                </>
              ) : (
                <>
                  Don't have an account?{' '}
                  <span className="font-medium text-blue-600">Create company account</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="text-center mt-6">
          <p className="text-sm text-gray-600">
            Secure multi-tenant authentication powered by Supabase
          </p>
          <p className="text-xs text-gray-500 mt-2">
            All API tokens are encrypted with AES-256-GCM
          </p>
        </div>
      </div>
    </div>
  );
}
