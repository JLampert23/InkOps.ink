import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { isPlaceholderUrl } from "../_shared/image-validator.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ALLOWED_HOSTS = ["cdn.sanmar.com", "cdnm.sanmar.com", "www.sanmar.com", "sanmar.com"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const params = new URL(req.url).searchParams;
    const imageUrl = params.get("url");

    if (!imageUrl) {
      return new Response(JSON.stringify({ error: "Missing url parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(imageUrl);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid URL" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!ALLOWED_HOSTS.includes(parsedUrl.hostname)) {
      return new Response(
        JSON.stringify({ error: "URL host not allowed" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[ImageProxy] Fetching: ${imageUrl}`);

    const imageResponse = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    });

    console.log(`[ImageProxy] Upstream status: ${imageResponse.status}, finalUrl: ${imageResponse.url || 'N/A'}`);

    if (!imageResponse.ok) {
      console.warn(`[ImageProxy] Upstream error ${imageResponse.status} for ${imageUrl}`);
      return new Response(
        JSON.stringify({
          error: `Upstream returned ${imageResponse.status}`,
          requestedUrl: imageUrl,
        }),
        {
          status: imageResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const contentType =
      imageResponse.headers.get("Content-Type") || "image/jpeg";
    const imageBody = await imageResponse.arrayBuffer();

    // Only reject as placeholder if the final URL looks like a placeholder AND
    // the response is suspiciously small (real images are typically >5KB)
    const finalUrl = imageResponse.url || "";
    if (isPlaceholderUrl(finalUrl) && imageBody.byteLength < 5000) {
      console.warn(`[ImageProxy] Placeholder detected: finalUrl=${finalUrl}, size=${imageBody.byteLength}`);
      return new Response(
        JSON.stringify({ error: "No image available for this product" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify we actually got an image
    if (!contentType.startsWith("image/")) {
      console.warn(`[ImageProxy] Non-image content-type: ${contentType} for ${imageUrl}`);
    }

    console.log(`[ImageProxy] Success: ${contentType}, ${imageBody.byteLength} bytes`);

    return new Response(imageBody, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
