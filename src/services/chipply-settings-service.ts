import { supabase } from '../lib/supabase-client';

const NAMESPACE = 'chipply';

export interface ChipplyEndpointSettings {
  auth_type: 'basic' | 'api_key';
  username: string;
  password: string;
  api_key: string;
}

export interface ChipplyImportBehavior {
  create_quote_on_import: boolean;
  auto_approve_quote: boolean;
  store_sale_order_in_notes: boolean;
  populate_nickname: boolean;
}

const ENDPOINT_DEFAULTS: ChipplyEndpointSettings = {
  auth_type: 'basic',
  username: '',
  password: '',
  api_key: '',
};

const BEHAVIOR_DEFAULTS: ChipplyImportBehavior = {
  create_quote_on_import: true,
  auto_approve_quote: false,
  store_sale_order_in_notes: true,
  populate_nickname: true,
};

async function getCompanyId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('company_id')
    .eq('id', user.id)
    .maybeSingle();

  return profile?.company_id ?? null;
}

async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const companyId = await getCompanyId();
  if (!companyId) return fallback;

  const { data, error } = await supabase
    .from('system_settings')
    .select('value')
    .eq('company_id', companyId)
    .eq('namespace', NAMESPACE)
    .eq('key', key)
    .maybeSingle();

  if (error || !data) return fallback;
  return data.value as T;
}

async function upsertSetting(key: string, value: unknown): Promise<{ error: string | null }> {
  const companyId = await getCompanyId();
  if (!companyId) return { error: 'No company found' };

  const { error } = await supabase
    .from('system_settings')
    .upsert(
      {
        company_id: companyId,
        namespace: NAMESPACE,
        key,
        value: value as any,
      },
      { onConflict: 'company_id,namespace,key' }
    );

  if (error) return { error: error.message };
  return { error: null };
}

export const chipplySettingsService = {
  async getEndpointSettings(): Promise<ChipplyEndpointSettings> {
    return getSetting('endpoint', ENDPOINT_DEFAULTS);
  },

  async saveEndpointSettings(settings: ChipplyEndpointSettings): Promise<{ error: string | null }> {
    return upsertSetting('endpoint', settings);
  },

  async getImportBehavior(): Promise<ChipplyImportBehavior> {
    return getSetting('import_behavior', BEHAVIOR_DEFAULTS);
  },

  async saveImportBehavior(behavior: ChipplyImportBehavior): Promise<{ error: string | null }> {
    return upsertSetting('import_behavior', behavior);
  },

  getEndpointUrl(): string {
    const base = import.meta.env.VITE_SUPABASE_URL || '';
    return `${base}/functions/v1/chipply-inbound`;
  },
};
