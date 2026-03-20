/**
 * Client-side utility for validating and filtering placeholder images
 */

const PLACEHOLDER_INDICATORS = [
  "imagenotavailable",
  "image404errorhandler",
  "image_not_available",
  "notavailable",
  "placeholder",
  "no-image",
  "noimage",
];

/**
 * Check if a URL is a placeholder image
 */
export function isPlaceholderUrl(url: string | null | undefined): boolean {
  if (!url) return true;
  const lower = url.toLowerCase();
  return PLACEHOLDER_INDICATORS.some((indicator) => lower.includes(indicator));
}

/**
 * Sanitize image URL by removing placeholder images
 */
export function sanitizeImageUrl(url: string | null | undefined): string | null {
  if (!url || isPlaceholderUrl(url)) {
    return null;
  }
  return url;
}

/**
 * Filter out placeholder images from an array of URLs
 */
export function filterValidImageUrls(urls: (string | null | undefined)[]): string[] {
  return urls
    .filter((url): url is string => !!url && !isPlaceholderUrl(url));
}

/**
 * Get the first valid image URL from an array, or null if none found
 */
export function getFirstValidImageUrl(urls: (string | null | undefined)[]): string | null {
  const validUrls = filterValidImageUrls(urls);
  return validUrls.length > 0 ? validUrls[0] : null;
}
