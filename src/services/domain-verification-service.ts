import { supabase } from '../lib/supabase-client';

export interface DomainVerificationStatus {
  status: 'unverified' | 'verified' | 'failed';
  token: string | null;
  expiresAt: string | null;
  verifiedAt: string | null;
}

export interface DomainVerificationResult {
  success: boolean;
  token?: string;
  expiresAt?: string;
  error?: string;
}

class DomainVerificationService {
  async requestVerification(companyId: string, customerUrl: string): Promise<DomainVerificationResult> {
    try {
      if (!customerUrl || !customerUrl.trim()) {
        return {
          success: false,
          error: 'Please enter a valid URL'
        };
      }

      const { data, error } = await supabase.rpc('request_domain_verification', {
        p_company_id: companyId,
        p_customer_url: customerUrl
      });

      if (error) {
        console.error('Error requesting domain verification:', error);
        return {
          success: false,
          error: error.message || 'Failed to request domain verification'
        };
      }

      if (!data.success) {
        return {
          success: false,
          error: data.error || 'Failed to request domain verification'
        };
      }

      return {
        success: true,
        token: data.token,
        expiresAt: data.expires_at
      };
    } catch (error: any) {
      console.error('Error in requestVerification:', error);
      return {
        success: false,
        error: error.message || 'An unexpected error occurred'
      };
    }
  }

  async verifyDomain(companyId: string): Promise<{ success: boolean; error?: string; message?: string }> {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return {
          success: false,
          error: 'Not authenticated'
        };
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/verify-domain`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey
        },
        body: JSON.stringify({ company_id: companyId })
      });

      const result = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: result.error || 'Failed to verify domain'
        };
      }

      return result;
    } catch (error: any) {
      console.error('Error in verifyDomain:', error);
      return {
        success: false,
        error: error.message || 'An unexpected error occurred'
      };
    }
  }

  async getVerificationStatus(companyId: string): Promise<DomainVerificationStatus | null> {
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('customer_url_verification_status, customer_url_verification_token, customer_url_verification_expires_at, customer_url_verified_at')
        .eq('id', companyId)
        .maybeSingle();

      if (error || !data) {
        console.error('Error getting verification status:', error);
        return null;
      }

      return {
        status: (data.customer_url_verification_status || 'unverified') as 'unverified' | 'verified' | 'failed',
        token: data.customer_url_verification_token,
        expiresAt: data.customer_url_verification_expires_at,
        verifiedAt: data.customer_url_verified_at
      };
    } catch (error) {
      console.error('Error in getVerificationStatus:', error);
      return null;
    }
  }

  async checkDomainAvailability(customerUrl: string, currentCompanyId: string): Promise<{ available: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('is_domain_verified_elsewhere', {
        p_company_id: currentCompanyId,
        p_customer_url: customerUrl
      });

      if (error) {
        console.error('Error checking domain availability:', error);
        return { available: true };
      }

      return { available: !data };
    } catch (error: any) {
      console.error('Error in checkDomainAvailability:', error);
      return { available: true };
    }
  }

  formatTokenForDNS(token: string): string {
    return token;
  }

  extractDomain(url: string): string {
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      return urlObj.hostname;
    } catch {
      return url.replace(/^https?:\/\//, '').split('/')[0];
    }
  }
}

export const domainVerificationService = new DomainVerificationService();
