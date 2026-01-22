import { useState, useEffect } from 'react';
import { Users, Search, ChevronRight, Mail, Phone, DollarSign, Loader2, FileText, CreditCard, FileSpreadsheet, Gift, Plus, Save, X, Edit2, Trash2, Upload } from 'lucide-react';
import { supabase } from '../../lib/supabase-client';
import { format } from 'date-fns';
import { InvoiceDetail } from '../billing/InvoiceDetail';
import { useNotification } from '../../contexts/NotificationContext';
import {
  exportCustomerListToPDF,
  exportCustomerListToCSV,
  exportPaymentHistoryToPDF,
  exportPaymentHistoryToCSV,
  downloadCSV,
  PaymentHistoryItem,
} from '../../utils/customer-export';

interface Customer {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  total_invoices: number;
  total_billed: number;
  total_paid: number;
  outstanding_balance: number;
}

interface CustomerDetail {
  invoice_id: string;
  invoice_number: string;
  invoice_date: string;
  total: number;
  amount_paid: number;
  status: string;
}

interface FundraisingCredit {
  id: string;
  customer_id: string;
  date: string;
  store_name: string;
  batch_number: string;
  amount: number;
  report_url?: string;
  created_at: string;
  updated_at: string;
}

interface CustomersReportProps {
  initialSearchTerm?: string;
}

export default function CustomersReport({ initialSearchTerm }: CustomersReportProps = {}) {
  const { showNotification } = useNotification();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm || '');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerInvoices, setCustomerInvoices] = useState<CustomerDetail[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [viewingInvoiceId, setViewingInvoiceId] = useState<string | null>(null);
  const [selectedReportType, setSelectedReportType] = useState('customer-list');
  const [companyName, setCompanyName] = useState('Company Name');
  const [fundraisingCredits, setFundraisingCredits] = useState<FundraisingCredit[]>([]);
  const [isAddingCredit, setIsAddingCredit] = useState(false);
  const [editingCreditId, setEditingCreditId] = useState<string | null>(null);
  const [newCredit, setNewCredit] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    store_name: '',
    batch_number: '',
    amount: ''
  });
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [savingCredit, setSavingCredit] = useState(false);

  useEffect(() => {
    loadCustomers();
    loadCompanySettings();
    fetchCompanyId();
  }, []);

  useEffect(() => {
    if (initialSearchTerm && customers.length > 0 && !selectedCustomer) {
      const matchedCustomer = customers.find(c =>
        c.company_name.toLowerCase().includes(initialSearchTerm.toLowerCase()) ||
        c.email.toLowerCase().includes(initialSearchTerm.toLowerCase())
      );
      if (matchedCustomer) {
        loadCustomerDetails(matchedCustomer);
      }
    }
  }, [initialSearchTerm, customers, selectedCustomer]);

  useEffect(() => {
    if (selectedCustomer?.id && companyId) {
      fetchFundraisingCredits();
    }
  }, [selectedCustomer?.id, companyId]);

  const fetchCompanyId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (data) {
        setCompanyId(data.company_id);
      }
    }
  };

  const fetchFundraisingCredits = async () => {
    if (!companyId || !selectedCustomer) return;

    const { data, error } = await supabase
      .from('customer_fundraising_credits')
      .select('*')
      .eq('customer_id', selectedCustomer.id)
      .eq('company_id', companyId)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching fundraising credits:', error);
    } else {
      setFundraisingCredits(data || []);
    }
  };

  const loadCompanySettings = async () => {
    try {
      const { data: settings } = await supabase
        .from('company_settings')
        .select('company_name')
        .single();

      if (settings?.company_name) {
        setCompanyName(settings.company_name);
      }
    } catch (error) {
      console.error('Error loading company settings:', error);
    }
  };

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('*')
        .order('company_name');

      if (customersError) throw customersError;

      const customersWithStats = await Promise.all(
        (customersData || []).map(async (customer: any) => {
          const { data: invoices, error: invoicesError } = await supabase
            .from('printavo_invoices')
            .select('total, amount_paid')
            .eq('customer_id', customer.id);

          if (invoicesError) {
            console.error('Error loading invoices for customer:', invoicesError);
            return null;
          }

          const totalInvoices = invoices?.length || 0;
          const totalBilled = invoices?.reduce((sum, inv) => sum + parseFloat(inv.total || 0), 0) || 0;
          const totalPaid = invoices?.reduce((sum, inv) => sum + parseFloat(inv.amount_paid || 0), 0) || 0;
          const outstandingBalance = totalBilled - totalPaid;

          return {
            id: customer.id,
            company_name: customer.company_name,
            contact_name: customer.contact_name,
            email: customer.email || '',
            phone: customer.phone || '',
            total_invoices: totalInvoices,
            total_billed: totalBilled,
            total_paid: totalPaid,
            outstanding_balance: outstandingBalance,
          };
        })
      );

      const validCustomers = customersWithStats.filter(c => c !== null) as Customer[];
      const sortedCustomers = validCustomers.sort((a, b) => b.total_billed - a.total_billed);

      setCustomers(sortedCustomers);
    } catch (error) {
      console.error('Error loading customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomerDetails = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setLoadingDetails(true);
    setIsAddingCredit(false);
    setEditingCreditId(null);
    try {
      const { data, error } = await supabase
        .from('printavo_invoices')
        .select('*')
        .eq('customer_id', customer.id)
        .order('invoice_date', { ascending: false });

      if (error) throw error;

      const details: CustomerDetail[] = (data || []).map((inv: any) => {
        const total = parseFloat(inv.total || 0);
        const amountPaid = parseFloat(inv.amount_paid || 0);
        const balanceRemaining = parseFloat(inv.balance_remaining || 0);

        let calculatedStatus = 'Unpaid';
        if (balanceRemaining <= 0) {
          calculatedStatus = 'Paid';
        } else if (amountPaid > 0) {
          calculatedStatus = 'Partially Paid';
        }

        return {
          invoice_id: inv.id,
          invoice_number: inv.invoice_number,
          invoice_date: inv.invoice_date,
          total,
          amount_paid: amountPaid,
          status: calculatedStatus,
        };
      });

      setCustomerInvoices(details);
    } catch (error) {
      console.error('Error loading customer details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleAddCredit = async () => {
    if (!companyId || !selectedCustomer || !newCredit.date || !newCredit.store_name || !newCredit.batch_number || !newCredit.amount) {
      showNotification('warning', 'Missing Information', 'Please fill in all fields');
      return;
    }

    const amount = parseFloat(newCredit.amount);
    if (isNaN(amount)) {
      showNotification('warning', 'Invalid Amount', 'Please enter a valid amount');
      return;
    }

    setSavingCredit(true);

    const { data, error } = await supabase
      .from('customer_fundraising_credits')
      .insert([{
        customer_id: selectedCustomer.id,
        company_id: companyId,
        date: newCredit.date,
        store_name: newCredit.store_name,
        batch_number: newCredit.batch_number,
        amount: amount
      }])
      .select()
      .single();

    setSavingCredit(false);

    if (error) {
      console.error('Error adding fundraising credit:', error);
      showNotification('error', 'Failed to Add', 'Failed to add fundraising credit. Please try again.');
    } else {
      setFundraisingCredits([data, ...fundraisingCredits]);
      setNewCredit({
        date: format(new Date(), 'yyyy-MM-dd'),
        store_name: '',
        batch_number: '',
        amount: ''
      });
      setIsAddingCredit(false);
      showNotification('success', 'Credit Added', 'Fundraising credit has been added successfully');
    }
  };

  const handleUpdateCredit = async (creditId: string, updates: Partial<FundraisingCredit>) => {
    setSavingCredit(true);

    const { data, error } = await supabase
      .from('customer_fundraising_credits')
      .update(updates)
      .eq('id', creditId)
      .select()
      .single();

    setSavingCredit(false);

    if (error) {
      console.error('Error updating fundraising credit:', error);
      showNotification('error', 'Update Failed', 'Failed to update fundraising credit. Please try again.');
    } else {
      setFundraisingCredits(fundraisingCredits.map(c => c.id === creditId ? data : c));
      setEditingCreditId(null);
      showNotification('success', 'Credit Updated', 'Fundraising credit has been updated successfully');
    }
  };

  const handleDeleteCredit = async (creditId: string) => {
    setSavingCredit(true);

    const { error } = await supabase
      .from('customer_fundraising_credits')
      .delete()
      .eq('id', creditId);

    setSavingCredit(false);

    if (error) {
      console.error('Error deleting fundraising credit:', error);
      showNotification('error', 'Delete Failed', 'Failed to delete fundraising credit. Please try again.');
    } else {
      setFundraisingCredits(fundraisingCredits.filter(c => c.id !== creditId));
      showNotification('success', 'Credit Deleted', 'Fundraising credit has been deleted');
    }
  };

  const filteredCustomers = customers.filter(customer =>
    customer.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleViewInvoice = (invoiceId: string) => {
    setViewingInvoiceId(invoiceId);
  };

  const handleBackToReport = () => {
    setViewingInvoiceId(null);
  };

  const getPaymentHistoryData = async (): Promise<PaymentHistoryItem[]> => {
    try {
      const { data: invoices, error } = await supabase
        .from('printavo_invoices')
        .select('*')
        .gt('amount_paid', 0)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const paymentHistory: PaymentHistoryItem[] = (invoices || []).map((inv: any) => ({
        customer_name: inv.customer_name || 'Unknown',
        payment_date: inv.updated_at || inv.invoice_date,
        payment_amount: parseFloat(inv.amount_paid || 0),
        payment_method: 'Payment',
        invoice_numbers: inv.invoice_number || '',
        notes: inv.status === 'paid' ? 'Paid in full' : 'Partial payment',
      }));

      return paymentHistory;
    } catch (error) {
      console.error('Error loading payment history:', error);
      return [];
    }
  };

  const handleExportPDF = async () => {
    if (selectedReportType === 'customer-list') {
      await exportCustomerListToPDF(filteredCustomers, companyName);
    } else if (selectedReportType === 'payment-history') {
      const paymentHistory = await getPaymentHistoryData();
      await exportPaymentHistoryToPDF(paymentHistory, companyName);
    }
  };

  const handleExportCSV = async () => {
    if (selectedReportType === 'customer-list') {
      const csvContent = exportCustomerListToCSV(filteredCustomers);
      downloadCSV(csvContent, `Customer_List_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    } else if (selectedReportType === 'payment-history') {
      const paymentHistory = await getPaymentHistoryData();
      const csvContent = exportPaymentHistoryToCSV(paymentHistory);
      downloadCSV(csvContent, `Payment_History_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    }
  };

  if (viewingInvoiceId) {
    return (
      <InvoiceDetail
        invoiceId={viewingInvoiceId}
        onBack={handleBackToReport}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-green-600 dark:text-green-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and Export */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[300px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                placeholder="Search customers by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 dark:focus:ring-green-600"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Reports:</span>
            <select
              value={selectedReportType}
              onChange={(e) => setSelectedReportType(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 dark:focus:ring-green-600"
            >
              <option value="customer-list">Customer List</option>
              <option value="payment-history">Customer Payment History Report</option>
            </select>
          </div>

          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 dark:bg-red-700 text-white rounded-lg hover:bg-red-700 dark:hover:bg-red-600 transition-colors"
          >
            <FileText className="w-4 h-4" />
            Export PDF
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customers List */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Customers ({filteredCustomers.length})</h3>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: '600px' }}>
            {filteredCustomers.map((customer) => (
              <button
                key={customer.id}
                onClick={() => loadCustomerDetails(customer)}
                className={`w-full px-6 py-4 border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors text-left ${
                  selectedCustomer?.id === customer.id ? 'bg-green-50 dark:bg-green-900/20' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 dark:text-white">{customer.company_name}</h4>
                    {customer.contact_name && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{customer.contact_name}</p>
                    )}
                    <div className="mt-1 space-y-1">
                      {customer.email && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <Mail className="w-4 h-4" />
                          {customer.email}
                        </div>
                      )}
                      {customer.phone && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <Phone className="w-4 h-4" />
                          {customer.phone}
                        </div>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-sm">
                      <span className="text-gray-600 dark:text-gray-400">{customer.total_invoices} invoices</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        ${customer.total_billed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      {customer.outstanding_balance > 0 && (
                        <span className="text-orange-600 dark:text-orange-500 font-medium">
                          ${customer.outstanding_balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} due
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 dark:text-gray-500 flex-shrink-0 mt-1" />
                </div>
              </button>
            ))}

            {filteredCustomers.length === 0 && (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Customers Found</h3>
                <p className="text-gray-600 dark:text-gray-400">Try adjusting your search.</p>
              </div>
            )}
          </div>
        </div>

        {/* Customer Details */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
          {selectedCustomer ? (
            <>
              <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{selectedCustomer.company_name}</h3>
                {selectedCustomer.contact_name && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{selectedCustomer.contact_name}</p>
                )}
                <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Total Billed:</span>
                    <span className="ml-2 font-semibold text-gray-900 dark:text-white">
                      ${selectedCustomer.total_billed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Total Paid:</span>
                    <span className="ml-2 font-semibold text-green-600 dark:text-green-500">
                      ${selectedCustomer.total_paid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Outstanding:</span>
                    <span className="ml-2 font-semibold text-orange-600 dark:text-orange-500">
                      ${selectedCustomer.outstanding_balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Invoices:</span>
                    <span className="ml-2 font-semibold text-gray-900 dark:text-white">{selectedCustomer.total_invoices}</span>
                  </div>
                </div>
              </div>

              <div className="overflow-y-auto" style={{ maxHeight: '520px' }}>
                {/* Fundraising Credits Section */}
                <div className="border-b border-gray-200 dark:border-slate-700">
                  <div className="px-4 py-3 bg-gray-50 dark:bg-slate-900 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Gift className="w-5 h-5 text-blue-600 dark:text-blue-500" />
                      <h4 className="font-semibold text-gray-900 dark:text-white">Fundraising Credits</h4>
                      {fundraisingCredits.length > 0 && (
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          (${fundraisingCredits.reduce((sum, c) => sum + parseFloat(c.amount.toString()), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => setIsAddingCredit(!isAddingCredit)}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 dark:bg-blue-700 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add
                    </button>
                  </div>

                  <div className="px-4 py-3">
                    {isAddingCredit && (
                      <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                        <div className="grid grid-cols-4 gap-2 mb-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
                            <input
                              type="date"
                              value={newCredit.date}
                              onChange={(e) => setNewCredit({ ...newCredit, date: e.target.value })}
                              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Store Name</label>
                            <input
                              type="text"
                              value={newCredit.store_name}
                              onChange={(e) => setNewCredit({ ...newCredit, store_name: e.target.value })}
                              placeholder="Store"
                              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Batch #</label>
                            <input
                              type="text"
                              value={newCredit.batch_number}
                              onChange={(e) => setNewCredit({ ...newCredit, batch_number: e.target.value })}
                              placeholder="Batch"
                              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Amount</label>
                            <input
                              type="number"
                              step="0.01"
                              value={newCredit.amount}
                              onChange={(e) => setNewCredit({ ...newCredit, amount: e.target.value })}
                              placeholder="0.00"
                              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 focus:border-transparent"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={handleAddCredit}
                            disabled={savingCredit}
                            className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 dark:bg-blue-700 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50"
                          >
                            <Save className="w-3 h-3" />
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setIsAddingCredit(false);
                              setNewCredit({
                                date: format(new Date(), 'yyyy-MM-dd'),
                                store_name: '',
                                batch_number: '',
                                amount: ''
                              });
                            }}
                            className="flex items-center gap-1 px-3 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-900 dark:text-white transition-colors"
                          >
                            <X className="w-3 h-3" />
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {fundraisingCredits.length === 0 ? (
                      <div className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">
                        No fundraising credits recorded
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="border-b border-gray-200 dark:border-slate-700">
                            <tr>
                              <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 pb-2">Date</th>
                              <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 pb-2">Store</th>
                              <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 pb-2">Batch</th>
                              <th className="text-right text-xs font-semibold text-gray-600 dark:text-gray-400 pb-2">Amount</th>
                              <th className="text-center text-xs font-semibold text-gray-600 dark:text-gray-400 pb-2">Report Upload</th>
                              <th className="text-right text-xs font-semibold text-gray-600 dark:text-gray-400 pb-2">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {fundraisingCredits.map((credit) => (
                              <FundraisingCreditRow
                                key={credit.id}
                                credit={credit}
                                isEditing={editingCreditId === credit.id}
                                onEdit={() => setEditingCreditId(credit.id)}
                                onSave={(updates) => handleUpdateCredit(credit.id, updates)}
                                onCancel={() => setEditingCreditId(null)}
                                onDelete={() => handleDeleteCredit(credit.id)}
                                loading={savingCredit}
                                companyId={companyId}
                                onRefresh={fetchFundraisingCredits}
                              />
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

                {/* Invoice History */}
                {loadingDetails ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-green-600 dark:text-green-500 animate-spin" />
                  </div>
                ) : (
                  <div>
                    <div className="px-4 py-3 bg-gray-50 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700">
                      <h4 className="font-semibold text-gray-900 dark:text-white">Invoice History</h4>
                    </div>
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Invoice #</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Amount</th>
                          <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                        {customerInvoices.map((inv) => (
                          <tr key={inv.invoice_number} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                            <td className="px-4 py-3">
                              <button
                                onClick={() => handleViewInvoice(inv.invoice_id)}
                                className="text-sm font-medium text-blue-600 dark:text-blue-500 hover:text-blue-800 dark:hover:text-blue-400 hover:underline cursor-pointer"
                              >
                                {inv.invoice_number}
                              </button>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                              {format(new Date(inv.invoice_date), 'MMM dd, yyyy')}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white">
                              ${inv.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                inv.status === 'Paid' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400' :
                                inv.status === 'Partially Paid' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400' :
                                'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'
                              }`}>
                                {inv.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Users className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Select a Customer</h3>
                <p className="text-gray-600 dark:text-gray-400">Click on a customer to view their details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface FundraisingCreditRowProps {
  credit: FundraisingCredit;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (updates: Partial<FundraisingCredit>) => void;
  onCancel: () => void;
  onDelete: () => void;
  loading: boolean;
  companyId: string | null;
  onRefresh?: () => void;
}

function FundraisingCreditRow({ credit, isEditing, onEdit, onSave, onCancel, onDelete, loading, companyId, onRefresh }: FundraisingCreditRowProps) {
  const { showNotification } = useNotification();
  const [editValues, setEditValues] = useState({
    date: credit.date,
    store_name: credit.store_name,
    batch_number: credit.batch_number,
    amount: credit.amount.toString()
  });
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (file: File) => {
    if (!companyId) {
      showNotification('error', 'Error', 'Company ID not found');
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${companyId}/${credit.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('fundraising-reports')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('fundraising-reports')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('customer_fundraising_credits')
        .update({ report_url: publicUrl })
        .eq('id', credit.id);

      if (updateError) throw updateError;

      showNotification('success', 'Upload Successful', 'Report has been uploaded successfully');
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Error uploading file:', error);
      showNotification('error', 'Upload Failed', 'Failed to upload report. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    if (isEditing) {
      setEditValues({
        date: credit.date,
        store_name: credit.store_name,
        batch_number: credit.batch_number,
        amount: credit.amount.toString()
      });
    }
  }, [isEditing, credit]);

  const handleSave = () => {
    const amount = parseFloat(editValues.amount);
    if (isNaN(amount)) {
      showNotification('warning', 'Invalid Amount', 'Please enter a valid amount');
      return;
    }

    onSave({
      date: editValues.date,
      store_name: editValues.store_name,
      batch_number: editValues.batch_number,
      amount: amount
    });
  };

  if (isEditing) {
    return (
      <tr className="bg-blue-50 dark:bg-blue-900/20">
        <td className="py-2">
          <input
            type="date"
            value={editValues.date}
            onChange={(e) => setEditValues({ ...editValues, date: e.target.value })}
            className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 focus:border-transparent"
          />
        </td>
        <td className="py-2">
          <input
            type="text"
            value={editValues.store_name}
            onChange={(e) => setEditValues({ ...editValues, store_name: e.target.value })}
            className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 focus:border-transparent"
          />
        </td>
        <td className="py-2">
          <input
            type="text"
            value={editValues.batch_number}
            onChange={(e) => setEditValues({ ...editValues, batch_number: e.target.value })}
            className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 focus:border-transparent"
          />
        </td>
        <td className="py-2">
          <input
            type="number"
            step="0.01"
            value={editValues.amount}
            onChange={(e) => setEditValues({ ...editValues, amount: e.target.value })}
            className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 focus:border-transparent text-right"
          />
        </td>
        <td className="py-2 text-center">
          <span className="text-xs text-gray-500 dark:text-gray-400">—</span>
        </td>
        <td className="py-2">
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={handleSave}
              disabled={loading}
              className="p-1 text-green-600 dark:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors disabled:opacity-50"
              title="Save"
            >
              <Save className="w-3 h-3" />
            </button>
            <button
              onClick={onCancel}
              className="p-1 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition-colors"
              title="Cancel"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-slate-700">
      <td className="py-2 text-xs text-gray-900 dark:text-white">
        {format(new Date(credit.date), 'MMM d, yyyy')}
      </td>
      <td className="py-2 text-xs text-gray-900 dark:text-white">{credit.store_name}</td>
      <td className="py-2 text-xs text-gray-900 dark:text-white">{credit.batch_number}</td>
      <td className="py-2 text-xs text-gray-900 dark:text-white text-right font-medium">
        ${parseFloat(credit.amount.toString()).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </td>
      <td className="py-2 text-center">
        <div className="flex items-center justify-center gap-2">
          {credit.report_url && (
            <a
              href={credit.report_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-colors bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/50 border border-green-200 dark:border-green-800"
              title="View uploaded report"
            >
              <FileText className="w-3 h-3" />
              View Report
            </a>
          )}
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
            className="hidden"
            id={`upload-${credit.id}`}
            disabled={uploading}
          />
          <label
            htmlFor={`upload-${credit.id}`}
            className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded cursor-pointer transition-colors ${
              uploading
                ? 'bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800'
            }`}
          >
            <Upload className="w-3 h-3" />
            {uploading ? 'Uploading...' : credit.report_url ? 'Replace PDF' : 'Upload PDF'}
          </label>
        </div>
      </td>
      <td className="py-2">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={onEdit}
            className="p-1 text-blue-600 dark:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
            title="Edit"
          >
            <Edit2 className="w-3 h-3" />
          </button>
          <button
            onClick={onDelete}
            className="p-1 text-red-600 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </td>
    </tr>
  );
}
