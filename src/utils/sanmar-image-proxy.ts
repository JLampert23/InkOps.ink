const SANMAR_CDN_HOSTS = ["cdn.sanmar.com", "cdnm.sanmar.com", "www.sanmar.com", "sanmar.com"];

export function proxySanMarImageUrl(url: string): string {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    if (SANMAR_CDN_HOSTS.includes(parsed.hostname)) {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) return url;
      return `${supabaseUrl}/functions/v1/sanmar-image-proxy?url=${encodeURIComponent(url)}`;
    }
  } catch {
    // not a valid URL
  }
  return url;
}
