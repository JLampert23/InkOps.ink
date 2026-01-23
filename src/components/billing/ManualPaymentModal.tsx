import { useState, useEffect } from 'react';
import { XCircle, DollarSign, Calendar, FileText, CheckCircle, Loader2, AlertCircle, Gift } from 'lucide-react';
import { supabase } from '../../lib/supabase-client';

interface ManualPaymentModalProps {
  invoiceId: string;
  invoiceNumber: string;
  invoiceTotal: number;
  invoiceBalance: number;
  customerId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function ManualPaymentModal({
  invoiceId,
  invoiceNumber,
  invoiceTotal,
  invoiceBalance,
  customerId,
  onClose,
  onSuccess,
}: ManualPaymentModalProps) {
  const [paymentType, setPaymentType] = useState<string>('');
  const [amount, setAmount] = useState<string>(invoiceBalance.toFixed(2));
  const [checkNumber, setCheckNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [allowOverpayment] = useState(false);
  const [availableFundraisingCredit, setAvailableFundraisingCredit] = useState<number>(0);
  const [loadingCredit, setLoadingCredit] = useState(false);

  useEffect(() => {
    setAmount(invoiceBalance.toFixed(2));
  }, [invoiceBalance]);

  // Fetch available fundraising credit
  useEffect(() => {
    async function fetchFundraisingCredit() {
      if (!customerId) return;

      setLoadingCredit(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from('user_profiles')
          .select('company_id')
          .eq('id', user.id)
          .single();

        if (!profile) return;

        const { data: credits } = await supabase
          .from('customer_fundraising_credits')
          .select('amount')
          .eq('customer_id', customerId)
          .eq('company_id', profile.company_id);

        if (credits) {
          const total = credits.reduce((sum, credit) => sum + parseFloat(credit.amount.toString()), 0);
          setAvailableFundraisingCredit(total);
        }
      } catch (error) {
        console.error('Error fetching fundraising credit:', error);
      } finally {
        setLoadingCredit(false);
      }
    }

    fetchFundraisingCredit();
  }, [customerId]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!paymentType) {
      newErrors.paymentType = 'Payment type is required';
    }

    const amountNum = parseFloat(amount);
    if (!amount || isNaN(amountNum)) {
      newErrors.amount = 'Please enter a valid amount';
    } else if (amountNum <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    } else if (!allowOverpayment && amountNum > invoiceBalance) {
      newErrors.amount = `Amount cannot exceed invoice balance of $${invoiceBalance.toFixed(2)}`;
    }

    if (paymentType === 'fundraising_credit') {
      if (amountNum > availableFundraisingCredit) {
        newErrors.amount = `Amount cannot exceed available fundraising credit of $${availableFundraisingCredit.toFixed(2)}`;
      }
    }

    if (paymentType === 'check_ach' && !checkNumber.trim()) {
      newErrors.checkNumber = 'Check number is required for check payments';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('Session error:', sessionError);
        throw new Error('Failed to get session. Please sign in again.');
      }

      const accessToken = session?.access_token;

      if (!accessToken) {
        console.error('No access token in session:', session);
        throw new Error('No access token available. Please sign in again.');
      }

      console.log('Making payment request with token length:', accessToken.length);

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/record-manual-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          invoiceId,
          paymentType,
          amount: parseFloat(amount),
          checkNumber: checkNumber.trim() || null,
          notes: notes.trim() || null,
          paymentDate,
          customerId: customerId || null,
        }),
      });

      console.log('Response status:', response.status);

      const result = await response.json();
      console.log('Response result:', result);

      if (!response.ok) {
        throw new Error(result.error || result.details || 'Failed to record payment');
      }

      onSuccess();
    } catch (err) {
      console.error('Error recording payment:', err);
      setErrors({ submit: err instanceof Error ? err.message : 'Failed to record payment' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAmountChange = (value: string) => {
    if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
      setAmount(value);
      if (errors.amount) {
        const newErrors = { ...errors };
        delete newErrors.amount;
        setErrors(newErrors);
      }
    }
  };

  const fillMaxFundraisingCredit = () => {
    const maxApplicable = Math.min(availableFundraisingCredit, invoiceBalance);
    setAmount(maxApplicable.toFixed(2));
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-slate-800 px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-green-600 dark:text-green-500" />
            Record a Payment
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            disabled={submitting}
          >
            <XCircle className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {errors.submit && (
            <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-300">{errors.submit}</p>
            </div>
          )}

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2">Invoice Summary</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-blue-700 dark:text-blue-300">Invoice Number</p>
                <p className="font-semibold text-blue-900 dark:text-blue-100">{invoiceNumber}</p>
              </div>
              <div>
                <p className="text-blue-700 dark:text-blue-300">Invoice Total</p>
                <p className="font-semibold text-blue-900 dark:text-blue-100">${invoiceTotal.toFixed(2)}</p>
              </div>
              <div className="col-span-2">
                <p className="text-blue-700 dark:text-blue-300">Balance Remaining</p>
                <p className="text-lg font-bold text-blue-900 dark:text-blue-100">${invoiceBalance.toFixed(2)}</p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Payment Type <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setPaymentType('cash');
                  if (errors.paymentType) {
                    const newErrors = { ...errors };
                    delete newErrors.paymentType;
                    setErrors(newErrors);
                  }
                }}
                disabled={submitting}
                className={`p-4 rounded-lg border-2 transition-all ${
                  paymentType === 'cash'
                    ? 'border-green-600 bg-green-50 dark:bg-green-900/30 text-green-900 dark:text-green-100'
                    : 'border-gray-300 dark:border-slate-600 hover:border-gray-400 dark:hover:border-slate-500 text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-700'
                } ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <DollarSign className="w-6 h-6 mx-auto mb-1" />
                <p className="text-sm font-medium">Cash</p>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPaymentType('debit_credit');
                  if (errors.paymentType) {
                    const newErrors = { ...errors };
                    delete newErrors.paymentType;
                    setErrors(newErrors);
                  }
                }}
                disabled={submitting}
                className={`p-4 rounded-lg border-2 transition-all ${
                  paymentType === 'debit_credit'
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100'
                    : 'border-gray-300 dark:border-slate-600 hover:border-gray-400 dark:hover:border-slate-500 text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-700'
                } ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <CheckCircle className="w-6 h-6 mx-auto mb-1" />
                <p className="text-sm font-medium">Card</p>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPaymentType('check_ach');
                  if (errors.paymentType) {
                    const newErrors = { ...errors };
                    delete newErrors.paymentType;
                    setErrors(newErrors);
                  }
                }}
                disabled={submitting}
                className={`p-4 rounded-lg border-2 transition-all ${
                  paymentType === 'check_ach'
                    ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/30 text-purple-900 dark:text-purple-100'
                    : 'border-gray-300 dark:border-slate-600 hover:border-gray-400 dark:hover:border-slate-500 text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-700'
                } ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <FileText className="w-6 h-6 mx-auto mb-1" />
                <p className="text-sm font-medium">Check/ACH</p>
              </button>
              {customerId && (
                <button
                  type="button"
                  onClick={() => {
                    setPaymentType('fundraising_credit');
                    if (errors.paymentType) {
                      const newErrors = { ...errors };
                      delete newErrors.paymentType;
                      setErrors(newErrors);
                    }
                  }}
                  disabled={submitting || loadingCredit || availableFundraisingCredit === 0}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    paymentType === 'fundraising_credit'
                      ? 'border-pink-600 bg-pink-50 dark:bg-pink-900/30 text-pink-900 dark:text-pink-100'
                      : 'border-gray-300 dark:border-slate-600 hover:border-gray-400 dark:hover:border-slate-500 text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-700'
                  } ${submitting || loadingCredit || availableFundraisingCredit === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Gift className="w-6 h-6 mx-auto mb-1" />
                  <p className="text-sm font-medium">Fundraising</p>
                </button>
              )}
            </div>
            {errors.paymentType && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.paymentType}
              </p>
            )}
          </div>

          {paymentType === 'fundraising_credit' && (
            <div className="bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-pink-900 dark:text-pink-200">Available Fundraising Credit</h4>
                <p className="text-lg font-bold text-pink-900 dark:text-pink-100">${availableFundraisingCredit.toFixed(2)}</p>
              </div>
              <p className="text-xs text-pink-700 dark:text-pink-300 mb-2">
                This will deduct the payment amount from the customer's fundraising credit balance.
              </p>
              <button
                type="button"
                onClick={fillMaxFundraisingCredit}
                className="text-xs text-pink-700 dark:text-pink-300 hover:text-pink-900 dark:hover:text-pink-100 underline"
              >
                Apply maximum available credit
              </button>
            </div>
          )}

          <div>
            <label htmlFor="amount" className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Amount Paid <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500 dark:text-gray-400 text-lg">$</span>
              </div>
              <input
                type="text"
                id="amount"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                disabled={submitting}
                className={`w-full pl-8 pr-4 py-3 text-lg font-semibold border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white ${
                  errors.amount ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20' : 'border-gray-300 dark:border-slate-600'
                } ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                placeholder="0.00"
              />
            </div>
            {errors.amount && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.amount}
              </p>
            )}
            {!errors.amount && parseFloat(amount) > 0 && parseFloat(amount) < invoiceBalance && (
              <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
                Remaining balance after payment: ${(invoiceBalance - parseFloat(amount)).toFixed(2)}
              </p>
            )}
          </div>

          {paymentType === 'check_ach' && (
            <div>
              <label htmlFor="checkNumber" className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                Check Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="checkNumber"
                value={checkNumber}
                onChange={(e) => {
                  setCheckNumber(e.target.value);
                  if (errors.checkNumber) {
                    const newErrors = { ...errors };
                    delete newErrors.checkNumber;
                    setErrors(newErrors);
                  }
                }}
                disabled={submitting}
                className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white ${
                  errors.checkNumber ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20' : 'border-gray-300 dark:border-slate-600'
                } ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                placeholder="Enter check number"
              />
              {errors.checkNumber && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.checkNumber}
                </p>
              )}
            </div>
          )}

          <div>
            <label htmlFor="paymentDate" className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Payment Date
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Calendar className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              </div>
              <input
                type="date"
                id="paymentDate"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                disabled={submitting}
                max={new Date().toISOString().split('T')[0]}
                className={`w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white ${
                  submitting ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              />
            </div>
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Notes (Optional)
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={submitting}
              rows={3}
              className={`w-full px-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 ${
                submitting ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              placeholder="Add any additional notes about this payment..."
            />
          </div>
        </div>

        <div className="sticky bottom-0 bg-gray-50 dark:bg-slate-900 px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-5 py-2.5 text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !paymentType || !amount}
            className="flex items-center gap-2 px-5 py-2.5 text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Recording Payment...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                Record Payment
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
