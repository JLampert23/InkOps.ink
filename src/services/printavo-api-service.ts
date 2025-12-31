import { decryptToken } from './crypto-service';
import { getCompanySettings } from './auth-service';

export interface PrintavoCredentials {
  username: string;
  apiToken: string;
}

export async function getPrintavoCredentials(): Promise<PrintavoCredentials | null> {
  try {
    const settings = await getCompanySettings();

    if (!settings || !settings.printavo_username || !settings.printavo_api_token_encrypted) {
      console.error('No Printavo credentials found in company settings');
      return null;
    }

    const decryptedToken = await decryptToken(settings.printavo_api_token_encrypted);

    return {
      username: settings.printavo_username,
      apiToken: decryptedToken,
    };
  } catch (error) {
    console.error('Error getting Printavo credentials:', error);
    return null;
  }
}

export async function makePrintavoRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const credentials = await getPrintavoCredentials();

  if (!credentials) {
    throw new Error('Printavo credentials not configured. Please update your account settings.');
  }

  const authString = btoa(`${credentials.username}:${credentials.apiToken}`);

  const response = await fetch(`https://www.printavo.com/api/v1${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Basic ${authString}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Printavo API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
