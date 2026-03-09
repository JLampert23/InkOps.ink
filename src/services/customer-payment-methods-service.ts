export interface SavedPaymentMethod {
  id: string;
  customer_id: string;
  company_id: string;
  stripe_payment_method_id: string;
  payment_method_type: 'card' | 'us_bank_account';
  last_four: string;
  brand: string;
  exp_month?: number;
  exp_year?: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

class CustomerPaymentMethodsService {
  private readonly supabaseUrl: string;
  private readonly supabaseAnonKey: string;

  constructor() {
    this.supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    this.supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  }

  async getPaymentMethods(customerId: string): Promise<SavedPaymentMethod[]> {
    try {
      const response = await fetch(
        `${this.supabaseUrl}/functions/v1/customer-payment-methods?customer_id=${customerId}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'apikey': this.supabaseAnonKey
          }
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to fetch payment methods');
      }

      return result.payment_methods || [];
    } catch (error) {
      console.error('Error fetching payment methods:', error);
      throw error;
    }
  }

  async addPaymentMethod(
    customerId: string,
    stripePaymentMethodId: string,
    isDefault: boolean = false
  ): Promise<SavedPaymentMethod> {
    try {
      const response = await fetch(
        `${this.supabaseUrl}/functions/v1/customer-payment-methods`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': this.supabaseAnonKey
          },
          body: JSON.stringify({
            customer_id: customerId,
            stripe_payment_method_id: stripePaymentMethodId,
            is_default: isDefault
          })
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to add payment method');
      }

      return result.payment_method;
    } catch (error) {
      console.error('Error adding payment method:', error);
      throw error;
    }
  }

  async setDefaultPaymentMethod(
    paymentMethodId: string,
    customerId: string
  ): Promise<void> {
    try {
      const response = await fetch(
        `${this.supabaseUrl}/functions/v1/customer-payment-methods`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'apikey': this.supabaseAnonKey
          },
          body: JSON.stringify({
            payment_method_id: paymentMethodId,
            customer_id: customerId
          })
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to set default payment method');
      }
    } catch (error) {
      console.error('Error setting default payment method:', error);
      throw error;
    }
  }

  async deletePaymentMethod(
    paymentMethodId: string,
    customerId: string
  ): Promise<void> {
    try {
      const response = await fetch(
        `${this.supabaseUrl}/functions/v1/customer-payment-methods`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'apikey': this.supabaseAnonKey
          },
          body: JSON.stringify({
            payment_method_id: paymentMethodId,
            customer_id: customerId
          })
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to delete payment method');
      }
    } catch (error) {
      console.error('Error deleting payment method:', error);
      throw error;
    }
  }

  formatPaymentMethodDisplay(method: SavedPaymentMethod): string {
    if (method.payment_method_type === 'card') {
      const expiry = method.exp_month && method.exp_year
        ? ` (${method.exp_month}/${method.exp_year})`
        : '';
      return `${method.brand} ending in ${method.last_four}${expiry}`;
    } else if (method.payment_method_type === 'us_bank_account') {
      return `${method.brand} ending in ${method.last_four}`;
    }
    return `Payment method ending in ${method.last_four}`;
  }
}

export const customerPaymentMethodsService = new CustomerPaymentMethodsService();
