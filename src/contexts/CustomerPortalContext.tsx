import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { supabase } from '../lib/supabase-client';

interface CustomerPortalUser {
  email: string;
  name: string;
  company_id: string;
  customer_id?: string;
}

interface CompanyBranding {
  company_name: string;
  logo_url: string | null;
  company_logo_primary_url: string | null;
  company_address: string | null;
  company_phone: string | null;
  company_email: string | null;
  customer_url: string | null;
}

interface CustomerPortalContextType {
  user: CustomerPortalUser | null;
  branding: CompanyBranding | null;
  loading: boolean;
  loginWithToken: (token: string) => Promise<boolean>;
  loginWithEmail: (email: string) => Promise<boolean>;
  loginWithPassword: (email: string, password: string) => Promise<{ success: boolean; requiresSetup?: boolean; error?: string }>;
  requestPasswordReset: (email: string) => Promise<boolean>;
  resetPassword: (token: string, newPassword: string) => Promise<boolean>;
  setupPassword: (email: string, password: string, setupToken: string) => Promise<boolean>;
  logout: () => void;
}

const CustomerPortalContext = createContext<CustomerPortalContextType | undefined>(undefined);

export function CustomerPortalProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CustomerPortalUser | null>(null);
  const [branding, setBranding] = useState<CompanyBranding | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = useCallback(async () => {
    try {
      const storedUser = localStorage.getItem('customer_portal_user');
      const storedBranding = localStorage.getItem('customer_portal_branding');

      if (storedUser && storedBranding) {
        setUser(JSON.parse(storedUser));
        setBranding(JSON.parse(storedBranding));
      }
    } catch (error) {
      console.error('Error checking session:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const loginWithToken = useCallback(async (token: string): Promise<boolean> => {
    try {
      setLoading(true);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/verify-magic-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey
        },
        body: JSON.stringify({ token })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        const { data: quoteApproval } = await supabase
          .from('quote_approvals')
          .select('quote_id, company_id')
          .eq('approval_token', token)
          .maybeSingle();

        if (quoteApproval) {
          const { data: quote } = await supabase
            .from('quotes')
            .select('customer_email, customer_name')
            .eq('id', quoteApproval.quote_id)
            .maybeSingle();

          const { data: company } = await supabase
            .from('company_settings')
            .select('company_name, logo_url, company_logo_primary_url, company_address, company_phone, company_email, customer_url')
            .eq('id', quoteApproval.company_id)
            .maybeSingle();

          if (quote && company) {
            const portalUser = {
              email: quote.customer_email || '',
              name: quote.customer_name || '',
              company_id: quoteApproval.company_id,
            };

            setUser(portalUser);
            setBranding(company);

            localStorage.setItem('customer_portal_user', JSON.stringify(portalUser));
            localStorage.setItem('customer_portal_branding', JSON.stringify(company));
            localStorage.setItem('customer_portal_token', token);

            return true;
          }
        }

        return false;
      }

      const portalUser = {
        email: result.customer.email,
        name: result.customer.name,
        company_id: result.customer.company_id,
        customer_id: result.customer.id,
      };

      setUser(portalUser);
      setBranding(result.branding);

      localStorage.setItem('customer_portal_user', JSON.stringify(portalUser));
      localStorage.setItem('customer_portal_branding', JSON.stringify(result.branding));
      localStorage.setItem('customer_portal_token', token);

      return true;
    } catch (error) {
      console.error('Error logging in with token:', error);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const loginWithEmail = useCallback(async (email: string): Promise<boolean> => {
    try {
      setLoading(true);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/send-magic-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey
        },
        body: JSON.stringify({ email })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error sending magic link:', error);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const loginWithPassword = useCallback(async (email: string, password: string): Promise<{ success: boolean; requiresSetup?: boolean; error?: string }> => {
    try {
      setLoading(true);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/verify-customer-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey
        },
        body: JSON.stringify({ email, password })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        return {
          success: false,
          requiresSetup: result.requiresSetup,
          error: result.error || 'Invalid email or password'
        };
      }

      const portalUser = {
        email: result.customer.email,
        name: result.customer.name,
        company_id: result.customer.company_id,
        customer_id: result.customer.id,
      };

      setUser(portalUser);
      setBranding(result.branding);

      localStorage.setItem('customer_portal_user', JSON.stringify(portalUser));
      localStorage.setItem('customer_portal_branding', JSON.stringify(result.branding));

      return { success: true };
    } catch (error) {
      console.error('Error logging in with password:', error);
      return { success: false, error: 'An error occurred. Please try again.' };
    } finally {
      setLoading(false);
    }
  }, []);

  const requestPasswordReset = useCallback(async (email: string): Promise<boolean> => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/request-password-reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey
        },
        body: JSON.stringify({ email })
      });

      const result = await response.json();
      return response.ok && result.success;
    } catch (error) {
      console.error('Error requesting password reset:', error);
      return false;
    }
  }, []);

  const resetPassword = useCallback(async (token: string, newPassword: string): Promise<boolean> => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/reset-customer-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey
        },
        body: JSON.stringify({ token, newPassword })
      });

      const result = await response.json();
      return response.ok && result.success;
    } catch (error) {
      console.error('Error resetting password:', error);
      return false;
    }
  }, []);

  const setupPassword = useCallback(async (email: string, password: string, setupToken: string): Promise<boolean> => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/set-customer-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey
        },
        body: JSON.stringify({ email, password, setupToken })
      });

      const result = await response.json();
      return response.ok && result.success;
    } catch (error) {
      console.error('Error setting up password:', error);
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setBranding(null);
    localStorage.removeItem('customer_portal_user');
    localStorage.removeItem('customer_portal_branding');
    localStorage.removeItem('customer_portal_token');
  }, []);

  const value = useMemo(() => ({
    user,
    branding,
    loading,
    loginWithToken,
    loginWithEmail,
    loginWithPassword,
    requestPasswordReset,
    resetPassword,
    setupPassword,
    logout
  }), [user, branding, loading, loginWithToken, loginWithEmail, loginWithPassword, requestPasswordReset, resetPassword, setupPassword, logout]);

  return (
    <CustomerPortalContext.Provider value={value}>
      {children}
    </CustomerPortalContext.Provider>
  );
}

export function useCustomerPortal() {
  const context = useContext(CustomerPortalContext);
  if (context === undefined) {
    throw new Error('useCustomerPortal must be used within a CustomerPortalProvider');
  }
  return context;
}
