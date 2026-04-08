import { supabase } from '../lib/supabase-client';

export type QuoteActionType = 
  | 'Quote opened for editing'
  | 'Quote edited'
  | 'Email sent'
  | 'Text sent'
  | 'Payment request sent'
  | 'Payment applied'
  | 'Quote sent';

interface LogOptions {
  quoteId: string;
  companyId: string;
  action: QuoteActionType;
  /** Pass the user auth object if logged in, otherwise system will try to infer or leave null for system actions */
  userId?: string | null;
  userName?: string | null;
  meta?: Record<string, any>;
}

export const activityLogger = {
  /**
   * Logs an action against a quote.
   */
  async logQuoteActivity({
    quoteId,
    companyId,
    action,
    userId = null,
    userName = null,
    meta = {}
  }: LogOptions) {
    try {
      let finalUserId = userId;
      let finalUserName = userName;

      // If no user provided, try to automatically detect the current session user
      if (!finalUserId) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          finalUserId = session.user.id;
          // Attempt to get user name if we don't have it
          if (!finalUserName) {
            const { data: profile } = await supabase
              .from('user_profiles')
              .select('first_name, last_name')
              .eq('id', session.user.id)
              .single();
              
            if (profile) {
              const first = profile.first_name || '';
              const last = profile.last_name || '';
              finalUserName = `${first} ${last}`.trim() || null;
            }
          }
        }
      }

      await supabase.from('quote_activity_log').insert({
        quote_id: quoteId,
        company_id: companyId,
        action: action,
        performed_by: finalUserId,
        performed_by_name: finalUserName,
        meta: meta,
      });

    } catch (error) {
      console.error('Failed to log quote activity:', error);
      // Suppress throwing to explicitly not break the primary application flow
    }
  }
};
