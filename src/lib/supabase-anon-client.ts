import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseAnonKey, hasValidConfig } from './supabase-client';

let supabaseAnonInstance: SupabaseClient | null = null;

function createAnonClient(): SupabaseClient {
  if (supabaseAnonInstance) return supabaseAnonInstance;

  if (!hasValidConfig) {
    throw new Error('Supabase configuration missing');
  }

  supabaseAnonInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
      storage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      },
    },
    global: {
      fetch: (url, options = {}) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        return fetch(url, {
          ...options,
          signal: controller.signal,
        }).finally(() => {
          clearTimeout(timeoutId);
        }).catch(err => {
          if (err.name === 'AbortError') {
            console.warn('Supabase anon request timeout');
          }
          throw err;
        });
      },
    },
  });

  return supabaseAnonInstance;
}

export const supabaseAnon = hasValidConfig ? createAnonClient() : (null as unknown as SupabaseClient);
