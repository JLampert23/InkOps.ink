import { supabase } from '../lib/supabase-client';
import { encryptToken } from './crypto-service';

export interface CompanySignupData {
  companyName: string;
  email: string;
  password: string;
  printavoUsername: string;
  printavoApiToken: string;
}

export interface CompanySettings {
  id: string;
  company_name: string;
  printavo_username: string | null;
  printavo_api_token_encrypted: string | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

export async function signUpCompany(data: CompanySignupData): Promise<{ error: Error | null }> {
  try {
    const { email, password, companyName, printavoUsername, printavoApiToken } = data;

    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      return { error: signUpError };
    }

    if (!authData.user) {
      return { error: new Error('User creation failed') };
    }

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return { error: new Error('Failed to create session') };
    }

    const encryptedToken = await encryptToken(printavoApiToken);

    const { error: settingsError } = await supabase
      .from('company_settings')
      .insert({
        company_name: companyName,
        printavo_username: printavoUsername,
        printavo_api_token_encrypted: encryptedToken,
        encryption_key_version: 'v1',
      });

    if (settingsError) {
      await supabase.auth.admin.deleteUser(authData.user.id);
      return { error: new Error(`Failed to save company settings: ${settingsError.message}`) };
    }

    return { error: null };
  } catch (error) {
    console.error('Company signup error:', error);
    return {
      error: error instanceof Error ? error : new Error('An unexpected error occurred during signup'),
    };
  }
}

export async function getCompanySettings(): Promise<CompanySettings | null> {
  try {
    const { data, error } = await supabase
      .from('company_settings')
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('Error fetching company settings:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getCompanySettings:', error);
    return null;
  }
}

export async function updateCompanySettings(
  settings: Partial<CompanySettings>
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from('company_settings')
      .update(settings)
      .eq('id', settings.id!);

    if (error) {
      return { error };
    }

    return { error: null };
  } catch (error) {
    console.error('Error updating company settings:', error);
    return {
      error: error instanceof Error ? error : new Error('Failed to update company settings'),
    };
  }
}
