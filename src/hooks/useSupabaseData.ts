import { useState, useEffect } from 'react';
import { Invoice, PaymentWithInvoice } from '../types/printavo';
import { supabase } from '../lib/supabase-client';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://cuaukcvccxvfpuxaciac.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1YXVrY3ZjY3h2ZnB1eGFjaWFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1NjA4NTQsImV4cCI6MjA4MjEzNjg1NH0.I-FDsR0oezVPxKcWgFmV-MMolV6E-lYcoA7Ew8ZgKYU';

export interface LineItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface SupabaseData {
  invoices: Invoice[];
  payments: PaymentWithInvoice[];
  lineItems: LineItem[];
  loading: boolean;
  error: Error | null;
  syncing: boolean;
  lastSyncTime: Date | null;
  triggerSync: () => Promise<void>;
}

export function useSupabaseData(): SupabaseData {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<PaymentWithInvoice[]>([]);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  const loadDataFromDatabase = async () => {
    try {
      setLoading(true);
      setError(null);

      const [invoicesResult, paymentsResult, lineItemsResult] = await Promise.all([
        supabase
          .from('printavo_invoices_calculated')
          .select('*')
          .order('invoice_date', { ascending: false, nullsFirst: false }),
        supabase
          .from('printavo_payments')
          .select('*')
          .order('payment_date', { ascending: false, nullsFirst: false }),
        supabase
          .from('printavo_line_items')
          .select('*')
          .order('created_at', { ascending: false, nullsFirst: false }),
      ]);

      if (invoicesResult.error) throw invoicesResult.error;
      if (paymentsResult.error) throw paymentsResult.error;
      if (lineItemsResult.error) throw lineItemsResult.error;

      const mappedInvoices: Invoice[] = (invoicesResult.data || []).map((row: any) => {
        const total = Number(row.total) || 0;
        const amountPaid = Number(row.amount_paid) || 0;
        const amountOutstanding = Number(row.amount_outstanding) || 0;
        const paidInFull = row.paid_in_full === true;

        const rawData = row.raw_data || {};
        const customerId = rawData.contact?.customer?.id || row.customer_email || row.id;

        return {
          id: row.id,
          visualId: row.invoice_number,
          status: { name: row.status || 'Unknown' },
          createdAt: row.created_at,
          invoiceAt: row.invoice_date,
          dueAt: row.due_date,
          total,
          subtotal: Number(row.subtotal) || 0,
          salesTaxAmount: Number(row.tax) || 0,
          amountPaid,
          amountOutstanding,
          paidInFull,
          contact: {
            id: rawData.contact?.id || row.customer_email || row.id,
            fullName: row.customer_name || 'Unknown',
            email: row.customer_email,
            customer: row.customer_company ? {
              id: customerId,
              companyName: row.customer_company,
            } : undefined,
          },
          lineItemGroups: { edges: [] },
          transactions: { edges: [] },
          fees: { edges: [] },
          payments: { edges: [] },
        };
      });

      const invoiceMap = new Map(
        (invoicesResult.data || []).map((inv: any) => [inv.id, inv.invoice_number])
      );

      const mappedPayments: PaymentWithInvoice[] = (paymentsResult.data || []).map((row: any) => ({
        id: row.id,
        amount: row.amount,
        transactionDate: row.payment_date,
        transactedFor: row.invoice_id ? {
          id: row.invoice_id,
          visualId: invoiceMap.get(row.invoice_id) || row.invoice_id,
        } : undefined,
      }));

      const mappedLineItems: LineItem[] = (lineItemsResult.data || []).map((row: any) => ({
        id: row.id,
        invoice_id: row.invoice_id,
        description: row.description || '',
        quantity: Number(row.quantity) || 0,
        unit_price: Number(row.unit_price) || 0,
        total_price: Number(row.total_price) || 0,
      }));

      setInvoices(mappedInvoices);
      setPayments(mappedPayments);
      setLineItems(mappedLineItems);

      const { data: lastSync } = await supabase
        .from('printavo_sync_log')
        .select('completed_at')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastSync?.completed_at) {
        setLastSyncTime(new Date(lastSync.completed_at));
      }

      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load data'));
      setLoading(false);
    }
  };

  const checkSyncStatus = async (syncId: string): Promise<'running' | 'completed' | 'failed'> => {
    const { data } = await supabase
      .from('printavo_sync_log')
      .select('status')
      .eq('id', syncId)
      .maybeSingle();

    return data?.status || 'failed';
  };

  const triggerSync = async () => {
    try {
      setSyncing(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Not authenticated');
      }

      console.log('Starting sync...');
      const response = await fetch(`${supabaseUrl}/functions/v1/printavo-sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      console.log('Sync response:', result);

      if (!response.ok && response.status !== 202) {
        throw new Error(result.error || 'Sync failed');
      }

      if (result.syncId) {
        console.log('Sync started, polling for completion...');

        const pollInterval = setInterval(async () => {
          const status = await checkSyncStatus(result.syncId);
          console.log('Sync status:', status);

          if (status === 'completed') {
            clearInterval(pollInterval);
            console.log('Sync completed, reloading data...');
            await loadDataFromDatabase();
            setSyncing(false);
          } else if (status === 'failed') {
            clearInterval(pollInterval);
            setError(new Error('Sync failed - check Supabase logs'));
            setSyncing(false);
          }
        }, 5000);

        setTimeout(() => {
          clearInterval(pollInterval);
          if (syncing) {
            setSyncing(false);
            setError(new Error('Sync timed out'));
          }
        }, 10 * 60 * 1000);
      }
    } catch (err) {
      console.error('Sync error:', err);
      setError(err instanceof Error ? err : new Error('Sync failed'));
      setSyncing(false);
    }
  };

  useEffect(() => {
    loadDataFromDatabase();
  }, []);

  return {
    invoices,
    payments,
    lineItems,
    loading,
    error,
    syncing,
    lastSyncTime,
    triggerSync,
  };
}
