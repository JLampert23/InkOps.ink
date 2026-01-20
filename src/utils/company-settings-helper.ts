import { supabase } from '../lib/supabase-client';

/**
 * Safely fetch company settings for the current user
 * This helper ensures proper filtering by company_id to avoid RLS issues
 */
export async function fetchCompanySettings<T = any>(selectFields: string = '*'): Promise<T | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return null;
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('company_id')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile?.company_id) {
      return null;
    }

    const { data, error } = await supabase
      .from('company_settings')
      .select(selectFields)
      .eq('id', profile.company_id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching company settings:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in fetchCompanySettings:', error);
    return null;
  }
}
