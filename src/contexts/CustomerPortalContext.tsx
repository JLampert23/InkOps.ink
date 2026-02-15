import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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

  const checkSession = async () => {
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
  };

  const loginWithToken = async (token: string): Promise<boolean> => {
    try {
      setLoading(true);

      // Check if token is for a quote approval
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

      // Check if token is for an invoice
      // Invoice tokens would need to be implemented similarly

      return false;
    } catch (error) {
      console.error('Error logging in with token:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const loginWithEmail = async (email: string): Promise<boolean> => {
    try {
      setLoading(true);

      // Find customer by email
      const { data: customer } = await supabase
        .from('customers')
        .select('id, company_id, customer_name, customer_email')
        .eq('customer_email', email)
        .maybeSingle();

      if (customer) {
        const { data: company } = await supabase
          .from('company_settings')
          .select('company_name, logo_url, company_logo_primary_url, company_address, company_phone, company_email, customer_url')
          .eq('id', customer.company_id)
          .maybeSingle();

        if (company) {
          const portalUser = {
            email: customer.customer_email || '',
            name: customer.customer_name || '',
            company_id: customer.company_id,
            customer_id: customer.id,
          };

          setUser(portalUser);
          setBranding(company);

          localStorage.setItem('customer_portal_user', JSON.stringify(portalUser));
          localStorage.setItem('customer_portal_branding', JSON.stringify(company));

          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Error logging in with email:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setBranding(null);
    localStorage.removeItem('customer_portal_user');
    localStorage.removeItem('customer_portal_branding');
    localStorage.removeItem('customer_portal_token');
  };

  return (
    <CustomerPortalContext.Provider value={{ user, branding, loading, loginWithToken, loginWithEmail, logout }}>
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
