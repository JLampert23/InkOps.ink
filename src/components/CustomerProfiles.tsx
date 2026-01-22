import { useState, useMemo, useEffect } from 'react';
import { Search, User, DollarSign, FileText, AlertCircle, ExternalLink, Plus, Edit2, Trash2, Save, X, Gift, Upload, File } from 'lucide-react';
import { Invoice } from '../types/printavo';
import { formatCurrency, calculateCustomerLifetimeValue, calculateCustomerOutstandingBalance } from '../utils/financial-aggregations';
import { format, parseISO } from 'date-fns';
import { getPrintavoInvoiceUrl } from '../utils/printavo-links';
import { supabase } from '../lib/supabase-client';

interface CustomerProfile {
  id: string;
  name: string;
  email?: string;
  invoices: Invoice[];
  lifetimeValue: number;
  outstandingBalance: number;
  totalInvoices: number;
}

interface CustomerProfilesProps {
  invoices: Invoice[];
  loading?: boolean;
}

interface FundraisingCredit {
  id: string;
  customer_id: string;
  date: string;
  store_name: string;
  batch_number: string;
  amount: number;
  report_file_path?: string | null;
  created_at: string;
  updated_at: string;
}

export function CustomerProfiles({ invoices, loading }: CustomerProfilesProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'ltv' | 'balance'>('ltv');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const customerProfiles = useMemo(() => {
    const customersMap = new Map<string, CustomerProfile>();

    invoices.forEach(invoice => {
      if (!invoice.contact?.customer) return;

      const customerId = invoice.contact.customer.id;
      const customerName = invoice.contact.customer.companyName || invoice.contact.fullName;

      if (!customersMap.has(customerId)) {
        customersMap.set(customerId, {
          id: customerId,
          name: customerName,
          email: invoice.contact.email,
          invoices: [],
          lifetimeValue: 0,
          outstandingBalance: 0,
          totalInvoices: 0,
        });
      }

      const profile = customersMap.get(customerId)!;
      profile.invoices.push(invoice);
    });

    customersMap.forEach((profile) => {
      profile.lifetimeValue = calculateCustomerLifetimeValue(profile.invoices);
      profile.outstandingBalance = calculateCustomerOutstandingBalance(profile.invoices);
      profile.totalInvoices = profile.invoices.length;
    });

    return Array.from(customersMap.values());
  }, [invoices]);

  const filteredAndSortedCustomers = useMemo(() => {
    let filtered = customerProfiles.filter(customer =>
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === 'ltv') {
        comparison = a.lifetimeValue - b.lifetimeValue;
      } else if (sortBy === 'balance') {
        comparison = a.outstandingBalance - b.outstandingBalance;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [customerProfiles, searchTerm, sortBy, sortOrder]);

  const selectedCustomer = useMemo(() => {
    return customerProfiles.find(c => c.id === selectedCustomerId);
  }, [customerProfiles, selectedCustomerId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading customer data...</div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 space-y-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2 mb-4">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="ltv">Sort by LTV</option>
              <option value="balance">Sort by Balance</option>
              <option value="name">Sort by Name</option>
            </select>
            <button
              onClick={() => setSortOrder(order => order === 'asc' ? 'desc' : 'asc')}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
          {filteredAndSortedCustomers.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No customers found
            </div>
          ) : (
            filteredAndSortedCustomers.map(customer => (
              <button
                key={customer.id}
                onClick={() => setSelectedCustomerId(customer.id)}
                className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                  selectedCustomerId === customer.id ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-gray-100 rounded-full">
                    <User className="w-4 h-4 text-gray-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">{customer.name}</div>
                    {customer.email && (
                      <div className="text-sm text-gray-500 truncate">{customer.email}</div>
                    )}
                    <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                      <span>{customer.totalInvoices} invoices</span>
                      <span>{formatCurrency(customer.lifetimeValue)}</span>
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="lg:col-span-2">
        {selectedCustomer ? (
          <CustomerDetail customer={selectedCustomer} />
        ) : (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            Select a customer to view their financial profile
          </div>
        )}
      </div>
    </div>
  );
}

interface CustomerDetailProps {
  customer: CustomerProfile;
}

function CustomerDetail({ customer }: CustomerDetailProps) {
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
  const [loading, setLoading] = useState(false);

  // Fetch company ID
  useEffect(() => {
    async function fetchCompanyId() {
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
    }
    fetchCompanyId();
  }, []);

  // Fetch fundraising credits
  useEffect(() => {
    async function fetchFundraisingCredits() {
      if (!companyId) return;

      const { data, error } = await supabase
        .from('customer_fundraising_credits')
        .select('*')
        .eq('customer_id', customer.id)
        .eq('company_id', companyId)
        .order('date', { ascending: false });

      if (error) {
        console.error('Error fetching fundraising credits:', error);
      } else {
        setFundraisingCredits(data || []);
      }
    }

    if (customer.id && companyId) {
      fetchFundraisingCredits();
    }
  }, [customer.id, companyId]);

  const totalFundraisingCredits = useMemo(() => {
    return fundraisingCredits.reduce((sum, credit) => sum + parseFloat(credit.amount.toString()), 0);
  }, [fundraisingCredits]);

  const handleAddCredit = async () => {
    if (!companyId || !newCredit.date || !newCredit.store_name || !newCredit.batch_number || !newCredit.amount) {
      alert('Please fill in all fields');
      return;
    }

    const amount = parseFloat(newCredit.amount);
    if (isNaN(amount) || amount < 0) {
      alert('Please enter a valid amount');
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from('customer_fundraising_credits')
      .insert([{
        customer_id: customer.id,
        company_id: companyId,
        date: newCredit.date,
        store_name: newCredit.store_name,
        batch_number: newCredit.batch_number,
        amount: amount
      }])
      .select()
      .single();

    setLoading(false);

    if (error) {
      console.error('Error adding fundraising credit:', error);
      alert('Failed to add fundraising credit');
    } else {
      setFundraisingCredits([data, ...fundraisingCredits]);
      setNewCredit({
        date: format(new Date(), 'yyyy-MM-dd'),
        store_name: '',
        batch_number: '',
        amount: ''
      });
      setIsAddingCredit(false);
    }
  };

  const handleUpdateCredit = async (creditId: string, updates: Partial<FundraisingCredit>) => {
    setLoading(true);

    const { data, error } = await supabase
      .from('customer_fundraising_credits')
      .update(updates)
      .eq('id', creditId)
      .select()
      .single();

    setLoading(false);

    if (error) {
      console.error('Error updating fundraising credit:', error);
      alert('Failed to update fundraising credit');
    } else {
      setFundraisingCredits(fundraisingCredits.map(c => c.id === creditId ? data : c));
      setEditingCreditId(null);
    }
  };

  const handleDeleteCredit = async (creditId: string) => {
    if (!confirm('Are you sure you want to delete this fundraising credit entry?')) {
      return;
    }

    setLoading(true);

    const { error } = await supabase
      .from('customer_fundraising_credits')
      .delete()
      .eq('id', creditId);

    setLoading(false);

    if (error) {
      console.error('Error deleting fundraising credit:', error);
      alert('Failed to delete fundraising credit');
    } else {
      setFundraisingCredits(fundraisingCredits.filter(c => c.id !== creditId));
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{customer.name}</h2>
            {customer.email && (
              <p className="text-gray-500 mt-1">{customer.email}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-blue-600" />
              <span className="text-sm text-blue-600 font-medium">Lifetime Value</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(customer.lifetimeValue)}
            </div>
          </div>
          <div className="bg-orange-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-orange-600" />
              <span className="text-sm text-orange-600 font-medium">Outstanding</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(customer.outstandingBalance)}
            </div>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-green-600" />
              <span className="text-sm text-green-600 font-medium">Invoices</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {customer.totalInvoices}
            </div>
          </div>
        </div>
      </div>

      {/* Fundraising Credits Section */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow">
        <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-purple-600 dark:text-purple-500" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Fundraising Credits</h3>
          </div>
          <button
            onClick={() => setIsAddingCredit(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Credit
          </button>
        </div>

        <div className="p-4">
          {isAddingCredit && (
            <div className="mb-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="grid grid-cols-4 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
                  <input
                    type="date"
                    value={newCredit.date}
                    onChange={(e) => setNewCredit({ ...newCredit, date: e.target.value })}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Store Name / Number</label>
                  <input
                    type="text"
                    value={newCredit.store_name}
                    onChange={(e) => setNewCredit({ ...newCredit, store_name: e.target.value })}
                    placeholder="Store name"
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Batch Number</label>
                  <input
                    type="text"
                    value={newCredit.batch_number}
                    onChange={(e) => setNewCredit({ ...newCredit, batch_number: e.target.value })}
                    placeholder="Batch #"
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newCredit.amount}
                    onChange={(e) => setNewCredit({ ...newCredit, amount: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddCredit}
                  disabled={loading}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
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
                  className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors text-gray-900 dark:text-white"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              </div>
            </div>
          )}

          {fundraisingCredits.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No fundraising credits recorded
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full table-auto">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-slate-700">
                      <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 pb-2 w-32">Date</th>
                      <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 pb-2">Store Name / Number</th>
                      <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 pb-2">Batch Number</th>
                      <th className="text-right text-xs font-semibold text-gray-600 dark:text-gray-400 pb-2 w-28">Amount</th>
                      <th className="text-center text-xs font-semibold text-gray-600 dark:text-gray-400 pb-2 w-32">Report</th>
                      <th className="text-right text-xs font-semibold text-gray-600 dark:text-gray-400 pb-2 w-24">Actions</th>
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
                        loading={loading}
                        companyId={companyId}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700 flex justify-end">
                <div className="text-right">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Fundraising Credits</div>
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-500">
                    {formatCurrency(totalFundraisingCredits)}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">Invoice History</h3>
        </div>
        <div className="divide-y divide-gray-200 max-h-[400px] overflow-y-auto">
          {customer.invoices.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No invoices found
            </div>
          ) : (
            customer.invoices.map(invoice => {
              const totalPaid = invoice.payments?.edges.reduce((sum, edge) => sum + edge.node.amount, 0) || 0;
              const balance = invoice.total - totalPaid;

              return (
                <div key={invoice.id} className="p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <a
                          href={getPrintavoInvoiceUrl(invoice.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {invoice.visualId || invoice.id}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        {invoice.contact?.fullName && (
                          <span className="text-sm text-gray-600">
                            - {invoice.contact.fullName}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">
                        {format(parseISO(invoice.createdAt), 'MMM d, yyyy')}
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Total: {formatCurrency(invoice.total)}</span>
                    {balance > 0.01 && (
                      <span className="text-orange-600">Balance: {formatCurrency(balance)}</span>
                    )}
                  </div>
                </div>
              );
            })
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
}

function FundraisingCreditRow({ credit, isEditing, onEdit, onSave, onCancel, onDelete, loading, companyId }: FundraisingCreditRowProps) {
  const [editValues, setEditValues] = useState({
    date: credit.date,
    store_name: credit.store_name,
    batch_number: credit.batch_number,
    amount: credit.amount.toString()
  });
  const [uploading, setUploading] = useState(false);
  const [reportUrl, setReportUrl] = useState<string | null>(null);

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

  useEffect(() => {
    if (credit.report_file_path) {
      loadReportUrl();
    }
  }, [credit.report_file_path]);

  const loadReportUrl = async () => {
    if (!credit.report_file_path) return;

    try {
      const { data, error } = await supabase.storage
        .from('fundraising-reports')
        .createSignedUrl(credit.report_file_path, 3600);

      if (error) throw error;
      setReportUrl(data.signedUrl);
    } catch (error) {
      console.error('Error loading report URL:', error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !companyId) return;

    if (file.type !== 'application/pdf') {
      alert('Please upload a PDF file');
      return;
    }

    setUploading(true);
    try {
      const fileExt = 'pdf';
      const fileName = `${companyId}/${credit.id}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('fundraising-reports')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from('customer_fundraising_credits')
        .update({ report_file_path: fileName })
        .eq('id', credit.id);

      if (updateError) throw updateError;

      onSave({ report_file_path: fileName });
      await loadReportUrl();
      alert('Report uploaded successfully!');
    } catch (error) {
      console.error('Error uploading report:', error);
      alert('Failed to upload report');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = () => {
    const amount = parseFloat(editValues.amount);
    if (isNaN(amount) || amount < 0) {
      alert('Please enter a valid amount');
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
      <tr className="bg-purple-50 dark:bg-purple-900/20">
        <td className="py-2">
          <input
            type="date"
            value={editValues.date}
            onChange={(e) => setEditValues({ ...editValues, date: e.target.value })}
            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </td>
        <td className="py-2">
          <input
            type="text"
            value={editValues.store_name}
            onChange={(e) => setEditValues({ ...editValues, store_name: e.target.value })}
            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </td>
        <td className="py-2">
          <input
            type="text"
            value={editValues.batch_number}
            onChange={(e) => setEditValues({ ...editValues, batch_number: e.target.value })}
            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </td>
        <td className="py-2">
          <input
            type="number"
            step="0.01"
            min="0"
            value={editValues.amount}
            onChange={(e) => setEditValues({ ...editValues, amount: e.target.value })}
            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent text-right"
          />
        </td>
        <td className="py-2 text-center">
          <div className="flex items-center justify-center gap-1">
            {credit.report_file_path && reportUrl ? (
              <a
                href={reportUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded transition-all border border-blue-200 dark:border-blue-800"
                title="View Report"
              >
                <File className="w-3.5 h-3.5" />
                <span>View</span>
              </a>
            ) : (
              <label className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 dark:hover:bg-purple-900/50 rounded transition-all cursor-pointer border border-purple-200 dark:border-purple-800" title="Upload Report">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload</span>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </td>
        <td className="py-2">
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={handleSave}
              disabled={loading}
              className="p-1 text-green-600 dark:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors disabled:opacity-50"
              title="Save"
            >
              <Save className="w-4 h-4" />
            </button>
            <button
              onClick={onCancel}
              className="p-1 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition-colors"
              title="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-slate-700">
      <td className="py-3 text-sm text-gray-900 dark:text-white">
        {format(parseISO(credit.date), 'MMM d, yyyy')}
      </td>
      <td className="py-3 text-sm text-gray-900 dark:text-white">{credit.store_name}</td>
      <td className="py-3 text-sm text-gray-900 dark:text-white">{credit.batch_number}</td>
      <td className="py-3 text-sm text-gray-900 dark:text-white text-right font-medium">
        {formatCurrency(parseFloat(credit.amount.toString()))}
      </td>
      <td className="py-3 text-center">
        <div className="flex items-center justify-center gap-1">
          {credit.report_file_path && reportUrl ? (
            <a
              href={reportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-md transition-all border border-blue-200 dark:border-blue-800"
              title="View Report"
            >
              <File className="w-4 h-4" />
              <span>View PDF</span>
            </a>
          ) : (
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 dark:hover:bg-purple-900/50 rounded-md transition-all cursor-pointer border border-purple-200 dark:border-purple-800" title="Upload Report">
              <Upload className="w-4 h-4" />
              <span>{uploading ? 'Uploading...' : 'Upload PDF'}</span>
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
          )}
        </div>
      </td>
      <td className="py-3">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={onEdit}
            className="p-1 text-blue-600 dark:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
            title="Edit"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-1 text-red-600 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}
