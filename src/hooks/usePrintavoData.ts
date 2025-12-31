import { useState, useEffect } from 'react';
import { apolloClient } from '../lib/apollo-client';
import { GET_INVOICES, GET_PAYMENTS } from '../graphql/queries';
import { fetchAllPagesWithRetry } from '../utils/pagination';
import { Invoice, PaymentWithInvoice } from '../types/printavo';

interface PrintavoData {
  invoices: Invoice[];
  payments: PaymentWithInvoice[];
  loading: boolean;
  error: Error | null;
  progress: {
    invoices: number;
    payments: number;
  };
}

export function usePrintavoData(): PrintavoData {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<PaymentWithInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState({
    invoices: 0,
    payments: 0,
  });

  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const [invoicesData, paymentsData] = await Promise.all([
          fetchAllPagesWithRetry<Invoice>(
            apolloClient,
            GET_INVOICES,
            'invoices',
            {},
            {
              onProgress: (page, total) => {
                if (isMounted) {
                  setProgress(prev => ({ ...prev, invoices: total }));
                }
              },
            }
          ),
          fetchAllPagesWithRetry<PaymentWithInvoice>(
            apolloClient,
            GET_PAYMENTS,
            'transactions',
            {},
            {
              onProgress: (page, total) => {
                if (isMounted) {
                  setProgress(prev => ({ ...prev, payments: total }));
                }
              },
            }
          ),
        ]);

        if (isMounted) {
          setInvoices(invoicesData);
          setPayments(paymentsData);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Failed to fetch data'));
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      isMounted = false;
    };
  }, []);

  return {
    invoices,
    payments,
    loading,
    error,
    progress,
  };
}
