import { supabase } from '../lib/supabase-client';
import { encryptToken } from './crypto-service';

export interface CompanySignupData {
  companyName: string;
  email: string;
  password: string;
  printavoUsername?: string;
  printavoApiToken?: string;
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

    const userId = authData.user.id;

    const companyData: {
      company_name: string;
      owner_id: string;
      printavo_username?: string;
      printavo_api_token_encrypted?: string;
      encryption_key_version?: string;
    } = {
      company_name: companyName,
      owner_id: userId,
    };

    if (printavoUsername && printavoApiToken) {
      const encryptedToken = await encryptToken(printavoApiToken);
      companyData.printavo_username = printavoUsername;
      companyData.printavo_api_token_encrypted = encryptedToken;
      companyData.encryption_key_version = 'v1';
    }

    const { data: companySettings, error: settingsError } = await supabase
      .from('company_settings')
      .insert(companyData)
      .select()
      .single();

    if (settingsError || !companySettings) {
      return { error: new Error(`Failed to save company settings: ${settingsError?.message || 'Unknown error'}`) };
    }

    const { error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        id: userId,
        email: email,
        company_id: companySettings.id,
        role: 'super_admin',
      });

    if (profileError) {
      return { error: new Error(`Failed to create user profile: ${profileError.message}`) };
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
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.error('No authenticated user found');
      return null;
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('company_id')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile?.company_id) {
      console.error('Error fetching user profile or company_id:', profileError);
      return null;
    }

    const { data, error } = await supabase
      .from('company_settings')
      .select('*')
      .eq('id', profile.company_id)
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
