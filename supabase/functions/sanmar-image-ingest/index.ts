import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import {
  classifyImageType,
  normalizeColorForPath,
  resolveSanMarImages,
  sanMarImagesFresh,
} from "../_shared/sanmar-image-resolver.ts";
import {
  fetchSanMarMedia,
  type SanMarCredentials,
} from "../_shared/sanmar-promostandards-client.ts";
import { isPlaceholderUrl } from "../_shared/image-validator.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const STORAGE_BUCKET = "sanmar-images";

function getFileExtension(url: string, contentType: string): string {
  const urlPath = new URL(url).pathname;
  const extMatch = urlPath.match(/\.(\w+)$/);
  if (extMatch) {
    const ext = extMatch[1].toLowerCase();
    if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return ext;
  }
  if (contentType.includes("png")) return "png";
  if (contentType.includes("gif")) return "gif";
  if (contentType.includes("webp")) return "webp";
  return "jpg";
}

function getMimeType(ext: string): string {
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
  };
  return map[ext] || "image/jpeg";
}

async function fetchImageWithRetry(
  url: string,
  retries = 1
): Promise<{ data: ArrayBuffer; contentType: string } | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const resp = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; InkOps/1.0)",
          Accept: "image/*",
        },
        redirect: "follow",
      });

      if (!resp.ok) {
        console.warn(`[Ingest] Fetch failed (${resp.status}) for ${url}, attempt ${attempt + 1}`);
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }
        return null;
      }

      const finalUrl = resp.url || "";
      if (isPlaceholderUrl(finalUrl)) {
        console.warn(`[Ingest] Placeholder detected for ${url}`);
        return null;
      }

      const contentType = resp.headers.get("Content-Type") || "image/jpeg";
      const data = await resp.arrayBuffer();

      if (data.byteLength < 500) {
        console.warn(`[Ingest] Image too small (${data.byteLength} bytes), likely invalid: ${url}`);
        return null;
      }

      return { data, contentType };
    } catch (err: any) {
      console.error(`[Ingest] Fetch error for ${url}, attempt ${attempt + 1}:`, err.message);
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const url = new URL(req.url);
    const style = (url.searchParams.get("style") || "").toUpperCase().trim();

    if (!style) {
      return new Response(
        JSON.stringify({ error: "style query parameter required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let companyId: string;

    if (token === supabaseServiceRoleKey) {
      const qsCompanyId = url.searchParams.get("companyId");
      if (!qsCompanyId) {
        return new Response(
          JSON.stringify({ error: "companyId query param required for service-role calls" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      companyId = qsCompanyId;
    } else {
      const jwtParts = token.split(".");
      if (jwtParts.length !== 3) {
        return new Response(
          JSON.stringify({ error: "Invalid JWT format" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let userId: string;
      try {
        const payload = JSON.parse(atob(jwtParts[1]));
        userId = payload.sub;
        if (!userId) throw new Error("No sub claim");
      } catch {
        return new Response(
          JSON.stringify({ error: "Failed to decode JWT" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: profile } = await supabaseAdmin
        .from("user_profiles")
        .select("company_id")
        .eq("id", userId)
        .maybeSingle();

      if (!profile?.company_id) {
        return new Response(
          JSON.stringify({ error: "Company not found for user" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      companyId = profile.company_id;
    }

    const isFresh = await sanMarImagesFresh(supabaseAdmin, style);
    if (isFresh) {
      console.log(`[Ingest] Cache HIT for ${style} -- returning stored images`);
      const cached = await resolveSanMarImages(supabaseAdmin, style);
      return new Response(
        JSON.stringify({ style, cached: true, colors: cached }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Ingest] Cache MISS for ${style} -- fetching from PromoStandards`);

    const { data: settings } = await supabaseAdmin
      .from("company_settings")
      .select("sanmar_promo_username, sanmar_promo_password_encrypted")
      .eq("id", companyId)
      .maybeSingle();

    if (!settings?.sanmar_promo_username || !settings?.sanmar_promo_password_encrypted) {
      return new Response(
        JSON.stringify({ error: "SanMar credentials not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const decryptResponse = await fetch(`${supabaseUrl}/functions/v1/crypto-service`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseServiceRoleKey}`,
      },
      body: JSON.stringify({
        action: "decrypt",
        token: settings.sanmar_promo_password_encrypted,
      }),
    });

    if (!decryptResponse.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to decrypt credentials" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { result: decryptedPassword } = await decryptResponse.json();
    const credentials: SanMarCredentials = {
      id: settings.sanmar_promo_username,
      password: decryptedPassword,
    };

    const mediaData = await fetchSanMarMedia(credentials, style);

    if (!mediaData.images || mediaData.images.length === 0) {
      console.warn(`[Ingest] No images returned from PromoStandards for ${style}`);
      return new Response(
        JSON.stringify({ style, cached: false, colors: {}, message: "No images available" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Ingest] PromoStandards returned ${mediaData.images.length} images for ${style}`);

    const colorTypeCounter: Record<string, Record<string, number>> = {};
    let uploaded = 0;
    let skipped = 0;
    let failed = 0;

    for (const img of mediaData.images) {
      if (!img.url) {
        skipped++;
        continue;
      }

      const colorNorm = normalizeColorForPath(img.color);
      const imageType = classifyImageType(img.classTypeName, img.url);

      if (!colorTypeCounter[colorNorm]) colorTypeCounter[colorNorm] = {};
      const count = (colorTypeCounter[colorNorm][imageType] || 0) + 1;
      colorTypeCounter[colorNorm][imageType] = count;

      const { data: existing } = await supabaseAdmin
        .from("sanmar_image_map")
        .select("id")
        .eq("original_url", img.url)
        .eq("style", style)
        .maybeSingle();

      if (existing) {
        await supabaseAdmin
          .from("sanmar_image_map")
          .update({ last_synced_at: new Date().toISOString() })
          .eq("id", existing.id);
        skipped++;
        continue;
      }

      const fetchResult = await fetchImageWithRetry(img.url);
      if (!fetchResult) {
        failed++;
        continue;
      }

      const ext = getFileExtension(img.url, fetchResult.contentType);
      const suffix = count > 1 ? `-${count}` : "";
      const storagePath = `${style}/${colorNorm}/${imageType}${suffix}.${ext}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, fetchResult.data, {
          contentType: getMimeType(ext),
          upsert: true,
        });

      if (uploadError) {
        console.error(`[Ingest] Upload failed for ${storagePath}:`, uploadError.message);
        failed++;
        continue;
      }

      const { data: publicUrlData } = supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(storagePath);

      const cdnUrl = publicUrlData?.publicUrl || "";

      const { error: insertError } = await supabaseAdmin
        .from("sanmar_image_map")
        .insert({
          style,
          color_name: colorNorm,
          image_type: imageType,
          original_url: img.url,
          cdn_url: cdnUrl,
          storage_path: storagePath,
          file_size: fetchResult.data.byteLength,
          class_type_name: img.classTypeName || "",
          part_id: img.partId || "",
          last_synced_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error(`[Ingest] DB insert failed for ${storagePath}:`, insertError.message);
        failed++;
        continue;
      }

      uploaded++;
    }

    console.log(`[Ingest] Done for ${style}: uploaded=${uploaded}, skipped=${skipped}, failed=${failed}`);

    const resolved = await resolveSanMarImages(supabaseAdmin, style);

    return new Response(
      JSON.stringify({
        style,
        cached: false,
        uploaded,
        skipped,
        failed,
        colors: resolved,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error(`[Ingest] Unhandled error:`, err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
