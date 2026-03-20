/**
 * SanMar Image Resolver
 *
 * Resolves SanMar product images from the sanmar_image_map table.
 * Images are stored permanently in the sanmar-images Supabase Storage bucket.
 *
 * This module is read-only -- it queries cached images.
 * For downloading/ingesting images, see the sanmar-image-ingest edge function.
 */

const CACHE_MAX_AGE_DAYS = 30;

export interface ResolvedImages {
  front: string | null;
  back: string | null;
  side: string | null;
  lifestyle: string | null;
  swatch: string | null;
  all: string[];
}

export interface ResolvedColorImages {
  [colorName: string]: ResolvedImages;
}

export async function resolveSanMarImages(
  supabaseAdmin: any,
  style: string,
  colorName?: string,
  partId?: string
): Promise<ResolvedColorImages> {
  const normalizedStyle = style.toUpperCase().trim();

  try {
    let query = supabaseAdmin
      .from("sanmar_image_map")
      .select("color_name, image_type, cdn_url, part_id")
      .eq("style", normalizedStyle);

    // If partId is provided, use it for exact matching (highest priority)
    if (partId && partId.trim()) {
      query = query.eq("part_id", partId.trim());
      console.log(`[SanMar Resolver] Using partId filter: ${partId}`);
    } else if (colorName) {
      // Otherwise fall back to color name matching
      query = query.eq("color_name", colorName.toLowerCase().trim());
      console.log(`[SanMar Resolver] Using color filter: ${colorName}`);
    }

    const { data, error } = await query;

    if (error || !data || data.length === 0) {
      console.log(`[SanMar Resolver] No images found for ${normalizedStyle}, partId=${partId || 'none'}, color=${colorName || 'none'}`);
      return {};
    }

    console.log(`[SanMar Resolver] Found ${data.length} images for ${normalizedStyle}`);

    const result: ResolvedColorImages = {};

    for (const row of data) {
      const color = row.color_name || "";
      if (!result[color]) {
        result[color] = {
          front: null,
          back: null,
          side: null,
          lifestyle: null,
          swatch: null,
          all: [],
        };
      }

      const entry = result[color];
      const type = row.image_type as string;
      const url = row.cdn_url as string;

      if (type === "front" && !entry.front) entry.front = url;
      else if (type === "back" && !entry.back) entry.back = url;
      else if (type === "side" && !entry.side) entry.side = url;
      else if (type === "lifestyle" && !entry.lifestyle) entry.lifestyle = url;
      else if (type === "swatch" && !entry.swatch) entry.swatch = url;

      if (!entry.all.includes(url)) {
        entry.all.push(url);
      }
    }

    return result;
  } catch (err) {
    console.error(`[SanMar Resolver] Error resolving images for ${normalizedStyle}:`, err);
    return {};
  }
}

export async function getSanMarFrontImage(
  supabaseAdmin: any,
  style: string,
  colorName?: string,
  partId?: string
): Promise<string | null> {
  const images = await resolveSanMarImages(supabaseAdmin, style, colorName, partId);
  const colors = Object.keys(images);
  if (colors.length === 0) return null;

  const targetColor = colorName
    ? colorName.toLowerCase().trim()
    : colors[0];

  const entry = images[targetColor] || images[colors[0]];
  return entry?.front || entry?.all?.[0] || null;
}

export async function sanMarImagesExist(
  supabaseAdmin: any,
  style: string
): Promise<boolean> {
  const normalizedStyle = style.toUpperCase().trim();

  try {
    const { count, error } = await supabaseAdmin
      .from("sanmar_image_map")
      .select("id", { count: "exact", head: true })
      .eq("style", normalizedStyle);

    if (error) return false;
    return (count || 0) > 0;
  } catch {
    return false;
  }
}

export async function sanMarImagesFresh(
  supabaseAdmin: any,
  style: string
): Promise<boolean> {
  const normalizedStyle = style.toUpperCase().trim();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - CACHE_MAX_AGE_DAYS);

  try {
    const { data, error } = await supabaseAdmin
      .from("sanmar_image_map")
      .select("last_synced_at")
      .eq("style", normalizedStyle)
      .order("last_synced_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return false;
    return new Date(data.last_synced_at) > cutoff;
  } catch {
    return false;
  }
}

export function classifyImageType(classTypeName: string, url: string): string {
  const label = (classTypeName || "").toLowerCase();
  const urlLower = (url || "").toLowerCase();

  if (/front|fm/.test(label) || /_fm[._]/.test(urlLower)) return "front";
  if (/rear|back|bk/.test(label) || /_bk[._]/.test(urlLower)) return "back";
  if (/side|profile|sleeve/.test(label) || /_sd[._]/.test(urlLower)) return "side";
  if (/lifestyle|casual/.test(label)) return "lifestyle";
  if (/swatch/.test(label)) return "swatch";
  return "other";
}

export function normalizeColorForPath(color: string): string {
  return (color || "unknown")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
