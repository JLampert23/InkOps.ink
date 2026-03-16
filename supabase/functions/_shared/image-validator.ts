/**
 * Shared utility for validating and filtering placeholder images
 */

export const PLACEHOLDER_INDICATORS = [
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
export function isPlaceholderUrl(url: string): boolean {
  if (!url) return true;
  const lower = url.toLowerCase();
  return PLACEHOLDER_INDICATORS.some((indicator) => lower.includes(indicator));
}

/**
 * Validate that a SanMar image URL is real and not a placeholder
 */
export async function validateImageUrl(url: string): Promise<boolean> {
  if (!url || isPlaceholderUrl(url)) {
    return false;
  }

  try {
    const response = await fetch(url, {
      method: "HEAD",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; InkOps/1.0)",
        Accept: "image/*",
      },
      redirect: "manual",
    });

    // Check if redirected to placeholder
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("Location") || "";
      if (isPlaceholderUrl(location)) {
        return false;
      }
    }

    // Check if response is OK
    if (!response.ok) {
      return false;
    }

    // Verify content type is an image
    const contentType = response.headers.get("Content-Type") || "";
    if (!contentType.startsWith("image/")) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Filter out placeholder images from an array of image objects
 */
export async function filterValidImages(
  images: Array<{ url?: string; [key: string]: any }>
): Promise<Array<{ url?: string; [key: string]: any }>> {
  if (!images || images.length === 0) return [];

  // First, filter out obvious placeholders
  const nonPlaceholders = images.filter((img) => img.url && !isPlaceholderUrl(img.url));

  if (nonPlaceholders.length === 0) return [];

  // Get unique URLs to validate
  const uniqueUrls = [...new Set(nonPlaceholders.map((img) => img.url).filter(Boolean))];
  if (uniqueUrls.length === 0) return [];

  // Sample-check the first 3 unique URLs to verify they're real images
  const samplesToCheck = uniqueUrls.slice(0, 3);
  const results = await Promise.allSettled(
    samplesToCheck.map((url) => validateImageUrl(url!))
  );

  // If all samples fail validation, discard all images
  const validSamples = results.filter(
    (r) => r.status === "fulfilled" && r.value === true
  );

  if (validSamples.length === 0) {
    console.log(`[ImageValidator] All sample images failed validation - discarding ${images.length} images`);
    return [];
  }

  // Return images that don't contain placeholder URLs
  return nonPlaceholders;
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
