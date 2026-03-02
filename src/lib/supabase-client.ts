import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const hasValidConfig = Boolean(supabaseUrl && supabaseAnonKey);

if (!hasValidConfig) {
  console.error(
    'Missing Supabase environment variables. Please check your .env file contains VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY'
  );
}

export { supabaseUrl, supabaseAnonKey, hasValidConfig };

let supabaseInstance: SupabaseClient | null = null;

function createSupabaseClient(): SupabaseClient {
  if (supabaseInstance) return supabaseInstance;

  if (!hasValidConfig) {
    throw new Error('Supabase configuration missing');
  }

  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storageKey: 'inkops-auth-session',
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
    global: {
      fetch: (url, options: RequestInit = {}) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const existingSignal = options.signal;
        if (existingSignal) {
          existingSignal.addEventListener('abort', () => controller.abort());
        }

        return fetch(url, {
          ...options,
          signal: controller.signal,
        }).finally(() => {
          clearTimeout(timeoutId);
        });
      },
    },
  });

  return supabaseInstance;
}

export const supabase = hasValidConfig ? createSupabaseClient() : (null as unknown as SupabaseClient);
