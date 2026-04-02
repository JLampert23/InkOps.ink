import { useState } from 'react';
import { useCustomerPortal } from '../../contexts/CustomerPortalContext';
import { Mail, Loader2, CheckCircle2, ArrowLeft } from 'lucide-react';

export function PortalForgotPassword() {
  const { requestPasswordReset } = useCustomerPortal();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setSubmitting(true);
    setMessage('');

    const result = await requestPasswordReset(email);

    if (result) {
      setSuccess(true);
      setMessage('Password reset instructions have been sent to your email.');
    } else {
      setMessage('If an account exists with this email, you will receive password reset instructions.');
      setSuccess(true);
    }

    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Forgot Password?</h1>
          <p className="text-gray-600">
            Enter your email address and we'll send you a link to reset your password
          </p>
        </div>

        {!success ? (
          <form onSubmit={handleSubmit} className="space-y-4">
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

            {message && !success && (
              <div className="p-3 rounded-lg bg-red-50 text-red-800 border border-red-200">
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
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="w-5 h-5" />
                  Send Reset Link
                </>
              )}
            </button>
          </form>
        ) : (
          <div className="space-y-6">
            <div className="p-4 rounded-lg bg-green-50 border border-green-200">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
                <div>
                  <h3 className="font-medium text-green-900 mb-1">Check your email</h3>
                  <p className="text-sm text-green-800">{message}</p>
                </div>
              </div>
            </div>

            <div className="text-center space-y-2">
              <p className="text-sm text-gray-600">
                Didn't receive an email? Check your spam folder.
              </p>
              <button
                onClick={() => {
                  setSuccess(false);
                  setMessage('');
                  setEmail('');
                }}
                className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 pt-6 border-t border-gray-200 text-center">
          <a
            href="/portal/login"
            className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Login
          </a>
        </div>
      </div>
    </div>
  );
}
