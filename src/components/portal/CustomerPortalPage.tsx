import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase-client';
import { FileText, Receipt, Loader2, AlertCircle, ChevronRight, Clock, CheckCircle, XCircle, DollarSign, CreditCard, Image } from 'lucide-react';
import { format } from 'date-fns';
import { PortalPaymentsTab } from './PortalPaymentsTab';
import { PortalPaymentModal } from './PortalPaymentModal';
import { PortalProofsTab } from './PortalProofsTab';

interface CustomerPortalPageProps {
  customerId: string;
}

interface Customer {
  id: string;
  company_name: string;
  contact_name: string | null;
  email: string | null;
  company_id: string;
}

interface Quote {
  id: string;
  quote_number: string;
  created_at: string;
  status: string;
  subtotal: number;
  tax_amount: number;
  nickname?: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  visual_id: string;
  invoice_date: string;
  status: string;
  total: number;
  amount_paid: number;
  balance_remaining: number;
}

interface StripeConfig {
  enabled: boolean;
}

interface CompanyBranding {
  company_name: string;
  logo_url: string | null;
  company_logo_primary_url: string | null;
  company_address: string | null;
  company_phone: string | null;
  company_email: string | null;
}

export function CustomerPortalPage({ customerId }: CustomerPortalPageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [branding, setBranding] = useState<CompanyBranding | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [activeTab, setActiveTab] = useState<'quotes' | 'invoices' | 'payments' | 'proofs'>('quotes');
  const [stripeConfig, setStripeConfig] = useState<StripeConfig>({ enabled: false });
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<Invoice | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  useEffect(() => {
    loadCustomerData();
    checkPaymentSuccess();
  }, [customerId]);

  const checkPaymentSuccess = () => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('payment') === 'success') {
      setPaymentSuccess(true);
      setActiveTab('payments');
      window.history.replaceState({}, '', window.location.pathname);
      setTimeout(() => setPaymentSuccess(false), 5000);
    }
  };

  const loadCustomerData = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('id, company_name, contact_name, email, company_id')
        .eq('id', customerId)
        .maybeSingle();

      if (customerError) throw customerError;

      if (!customerData) {
        setError('Customer not found');
        setLoading(false);
        return;
      }

      setCustomer(customerData);

      const { data: companyData, error: companyError } = await supabase
        .from('company_settings')
        .select('company_name, logo_url, company_logo_primary_url, company_address, company_phone, company_email, stripe_public_key, stripe_secret_key')
        .eq('id', customerData.company_id)
        .maybeSingle();

      if (companyError) throw companyError;

      if (companyData) {
        setBranding(companyData);
        setStripeConfig({
          enabled: !!(companyData.stripe_public_key && companyData.stripe_secret_key),
        });
      }

      const { data: quotesData, error: quotesError } = await supabase
        .from('quotes')
        .select('id, quote_number, created_at, status, subtotal, tax_amount, nickname')
        .eq('customer_id', customerId)
        .eq('company_id', customerData.company_id)
        .order('created_at', { ascending: false });

      if (quotesError) throw quotesError;
      setQuotes(quotesData || []);

      const { data: invoicesData, error: invoicesError } = await supabase
        .from('printavo_invoices')
        .select('id, invoice_number, visual_id, invoice_date, status, total, amount_paid, balance_remaining')
        .eq('customer_id', customerId)
        .eq('company_id', customerData.company_id)
        .order('invoice_date', { ascending: false });

      if (invoicesError) throw invoicesError;
      setInvoices(invoicesData || []);

    } catch (err) {
      console.error('Error loading customer data:', err);
      setError('Failed to load customer data');
    } finally {
      setLoading(false);
    }
  };

  const getQuoteStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3" />
            Approved
          </span>
        );
      case 'sent':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
            <Clock className="w-3 h-3" />
            Sent
          </span>
        );
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
            Draft
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
            <XCircle className="w-3 h-3" />
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
            {status}
          </span>
        );
    }
  };

  const getInvoiceStatusBadge = (invoice: Invoice) => {
    const balance = parseFloat(invoice.balance_remaining?.toString() || '0');
    const amountPaid = parseFloat(invoice.amount_paid?.toString() || '0');

    if (balance <= 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
          <CheckCircle className="w-3 h-3" />
          Paid
        </span>
      );
    } else if (amountPaid > 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
          <DollarSign className="w-3 h-3" />
          Partial
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
          <Clock className="w-3 h-3" />
          Unpaid
        </span>
      );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading customer portal...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {error === 'Customer not found' ? 'Customer Not Found' : 'Access Denied'}
          </h1>
          <p className="text-gray-600">
            {error === 'Customer not found'
              ? 'The customer you are looking for does not exist or has been removed.'
              : 'You do not have permission to access this customer portal.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              {(branding?.company_logo_primary_url || branding?.logo_url) && (
                <img
                  src={branding.company_logo_primary_url || branding.logo_url || ''}
                  alt={branding?.company_name || 'Company'}
                  className="h-10 w-auto object-contain"
                />
              )}
              {!branding?.company_logo_primary_url && !branding?.logo_url && branding?.company_name && (
                <h1 className="text-xl font-bold text-gray-900">{branding.company_name}</h1>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">{customer?.company_name}</p>
              {customer?.contact_name && (
                <p className="text-xs text-gray-500">{customer.contact_name}</p>
              )}
            </div>
          </div>
        </div>
      </header>

      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('quotes')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === 'quotes'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              <FileText className="w-4 h-4" />
              Quotes ({quotes.length})
            </button>
            <button
              onClick={() => setActiveTab('invoices')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === 'invoices'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              <Receipt className="w-4 h-4" />
              Invoices ({invoices.length})
            </button>
            <button
              onClick={() => setActiveTab('payments')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === 'payments'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              Payments
            </button>
            <button
              onClick={() => setActiveTab('proofs')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === 'proofs'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              <Image className="w-4 h-4" />
              Proofs
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {paymentSuccess && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <p className="text-green-800 font-medium">Payment successful! Thank you for your payment.</p>
          </div>
        )}

        {activeTab === 'quotes' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900">Quotes</h2>
              <p className="text-sm text-gray-600 mt-1">View all quotes for {customer?.company_name}</p>
            </div>

            {quotes.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No quotes available</h3>
                <p className="text-gray-600">There are no quotes for this customer yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quote #</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {quotes.map((quote) => (
                      <tr key={quote.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{quote.quote_number}</div>
                          {quote.nickname && (
                            <div className="text-xs text-gray-500">{quote.nickname}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {format(new Date(quote.created_at), 'MMM d, yyyy')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getQuoteStatusBadge(quote.status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                          ${((quote.subtotal || 0) + (quote.tax_amount || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <a
                            href={`/quote-approval/${quote.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                          >
                            View
                            <ChevronRight className="w-4 h-4" />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'invoices' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900">Invoices</h2>
              <p className="text-sm text-gray-600 mt-1">View all invoices for {customer?.company_name}</p>
            </div>

            {invoices.length === 0 ? (
              <div className="text-center py-12">
                <Receipt className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No invoices available</h3>
                <p className="text-gray-600">There are no invoices for this customer yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice #</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Balance Due</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {invoices.map((invoice) => (
                      <tr key={invoice.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {invoice.visual_id || invoice.invoice_number}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {format(new Date(invoice.invoice_date), 'MMM d, yyyy')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getInvoiceStatusBadge(invoice)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                          ${parseFloat(invoice.total?.toString() || '0').toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                          <span className={`font-medium ${parseFloat(invoice.balance_remaining?.toString() || '0') > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            ${parseFloat(invoice.balance_remaining?.toString() || '0').toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          {parseFloat(invoice.balance_remaining?.toString() || '0') > 0 && stripeConfig.enabled && (
                            <button
                              onClick={() => setSelectedInvoiceForPayment(invoice)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                            >
                              <CreditCard className="w-4 h-4" />
                              Pay Now
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'payments' && customer && (
          <PortalPaymentsTab
            customerId={customer.id}
            companyId={customer.company_id}
          />
        )}

        {activeTab === 'proofs' && customer && (
          <PortalProofsTab
            customerId={customer.id}
            companyId={customer.company_id}
          />
        )}
      </main>

      {selectedInvoiceForPayment && customer && (
        <PortalPaymentModal
          invoice={selectedInvoiceForPayment}
          companyId={customer.company_id}
          customerId={customer.id}
          customerEmail={customer.email}
          customerName={customer.contact_name || customer.company_name}
          onClose={() => setSelectedInvoiceForPayment(null)}
          onPaymentSuccess={() => {
            setSelectedInvoiceForPayment(null);
            loadCustomerData();
            setActiveTab('payments');
          }}
        />
      )}

      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-gray-600">
              {branding?.company_address && <p>{branding.company_address}</p>}
              <div className="flex gap-4 mt-1">
                {branding?.company_phone && <span>{branding.company_phone}</span>}
                {branding?.company_email && <span>{branding.company_email}</span>}
              </div>
            </div>
            <p className="text-sm text-gray-500">
              {new Date().getFullYear()} {branding?.company_name}. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
