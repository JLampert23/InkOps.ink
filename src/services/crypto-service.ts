import { supabase } from '../lib/supabase-client';

export interface CryptoServiceResponse {
  success: boolean;
  result?: string;
  error?: string;
}

export async function encryptToken(token: string): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('No active session');
  }

  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crypto-service`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'encrypt',
      token,
    }),
  });

  const data: CryptoServiceResponse = await response.json();

  if (!data.success || !data.result) {
    throw new Error(data.error || 'Encryption failed');
  }

  return data.result;
}

export async function decryptToken(encryptedToken: string): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('No active session');
  }

  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crypto-service`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'decrypt',
      token: encryptedToken,
    }),
  });

  const data: CryptoServiceResponse = await response.json();

  if (!data.success || !data.result) {
    throw new Error(data.error || 'Decryption failed');
  }

  return data.result;
}
