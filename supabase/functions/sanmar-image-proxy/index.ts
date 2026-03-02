import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SANMAR_CDN_BASE = "https://cdnm.sanmar.com/imglib";

const VIEW_SUFFIXES: Record<string, string> = {
  fm: "_fm.jpg",
  bk: "_bk.jpg",
  sd: "_sd.jpg",
  sw: "_sw.jpg",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);

    const proxyIndex = pathParts.indexOf("sanmar-image-proxy");
    if (proxyIndex === -1) {
      return new Response("Not found", { status: 404, headers: corsHeaders });
    }

    const remaining = pathParts.slice(proxyIndex + 1);

    if (remaining.length < 1) {
      return new Response(
        JSON.stringify({ error: "Usage: /sanmar-image-proxy/{style}/{view}?color={colorCode}" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const style = remaining[0].toUpperCase();
    const view = (remaining[1] || "fm").toLowerCase();
    const colorCode = url.searchParams.get("color")?.toUpperCase() || null;

    const directUrl = url.searchParams.get("url");
    if (directUrl) {
      return await proxyImage(directUrl);
    }

    const suffix = VIEW_SUFFIXES[view];
    if (!suffix) {
      return new Response(
        JSON.stringify({ error: `Invalid view: ${view}. Valid: fm, bk, sd, sw` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cdnUrls: string[] = [];

    if (colorCode) {
      cdnUrls.push(`${SANMAR_CDN_BASE}/${style}/${style}_${colorCode}${suffix}`);
    }
    cdnUrls.push(`${SANMAR_CDN_BASE}/${style}/${style}${suffix}`);

    for (const cdnUrl of cdnUrls) {
      console.log(`[SanMar Proxy] Trying: ${cdnUrl}`);
      const response = await proxyImage(cdnUrl);
      if (response.status === 200) {
        return response;
      }
    }

    console.log(`[SanMar Proxy] No image found for style=${style}, view=${view}, color=${colorCode}`);
    return new Response("Image not found", { status: 404, headers: corsHeaders });
  } catch (error) {
    console.error("[SanMar Proxy] Error:", error);
    return new Response("Internal server error", { status: 500, headers: corsHeaders });
  }
});

async function proxyImage(cdnUrl: string): Promise<Response> {
  try {
    const upstream = await fetch(cdnUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; InkOps/1.0)",
        "Accept": "image/*",
      },
    });

    if (!upstream.ok) {
      return new Response(null, { status: upstream.status, headers: corsHeaders });
    }

    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    const body = await upstream.arrayBuffer();

    return new Response(body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    console.error(`[SanMar Proxy] Fetch error for ${cdnUrl}:`, err);
    return new Response(null, { status: 502, headers: corsHeaders });
  }
}
