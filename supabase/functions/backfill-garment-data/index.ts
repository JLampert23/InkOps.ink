import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function parseGarmentInfo(text: string): {
  style: string | null;
  color: string | null;
  sizes: Record<string, number>;
} {
  if (!text || typeof text !== 'string') {
    return { style: null, color: null, sizes: {} };
  }

  let style: string | null = null;
  const stylePatterns = [
    /\b(GILDAN\s+\d+[A-Z]*)\b/i,
    /\b(BELLA[\s+]CANVAS\s+\d+[A-Z]*)\b/i,
    /\b(NEXT\s+LEVEL\s+\d+[A-Z]*)\b/i,
    /\b(COMFORT\s+COLORS?\s+\d+[A-Z]*)\b/i,
    /\b(HANES\s+\d+[A-Z]*)\b/i,
    /\b(JERZEES\s+\d+[A-Z]*)\b/i,
    /\b(PORT\s+(?:&\s+)?COMPANY\s+[A-Z]+\d+[A-Z]*)\b/i,
    /\b(ALTERNATIVE\s+\d+[A-Z]*)\b/i,
    /\b([A-Z]{2,}\s*\d{3,5}[A-Z]*)\b/i,
  ];

  for (const pattern of stylePatterns) {
    const match = text.match(pattern);
    if (match) {
      style = match[1].trim();
      break;
    }
  }

  let color: string | null = null;
  const colorPatterns = [
    /(?:COLOR|COLOUR):\s*([A-Z][A-Z\s]+?)(?:\s*[-,]|\s*\d|\s*$)/i,
    /\b(BLACK|WHITE|NAVY|GRAY|GREY|RED|BLUE|GREEN|YELLOW|ORANGE|PURPLE|PINK|BROWN|MAROON|CARDINAL|ROYAL|FOREST|KELLY|LIGHT BLUE|DARK|HEATHER|CHARCOAL|OLIVE|TAN|BEIGE|KHAKI|CREAM|GOLD|SILVER|NATURAL|SAND)\b/i,
    /\b(HEATHER\s+[A-Z]+)\b/i,
    /\b(LIGHT\s+[A-Z]+)\b/i,
    /\b(DARK\s+[A-Z]+)\b/i,
  ];

  for (const pattern of colorPatterns) {
    const match = text.match(pattern);
    if (match) {
      color = match[1].trim();
      break;
    }
  }

  const sizes: Record<string, number> = {};
  const sizePattern = /\b(XXS|XS|S|M|L|XL|2XL|3XL|4XL|5XL|6XL)\s*[-:x×]?\s*(\d+)/gi;
  let sizeMatch;
  while ((sizeMatch = sizePattern.exec(text)) !== null) {
    const size = sizeMatch[1].toUpperCase();
    const quantity = parseInt(sizeMatch[2], 10);
    sizes[size] = (sizes[size] || 0) + quantity;
  }

  const standalonePattern = /\b(XXS|XS|S|M|L|XL|2XL|3XL|4XL|5XL|6XL)(?![A-Z])\b/gi;
  const foundSizes = text.match(standalonePattern);
  if (foundSizes && Object.keys(sizes).length === 0) {
    foundSizes.forEach(size => {
      const normalizedSize = size.toUpperCase();
      sizes[normalizedSize] = (sizes[normalizedSize] || 0) + 1;
    });
  }

  return {
    style,
    color,
    sizes: Object.keys(sizes).length > 0 ? sizes : {},
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let processedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    let offset = 0;
    const batchSize = 100;

    while (true) {
      const { data: lineItems, error } = await supabase
        .from('printavo_line_items')
        .select('id, description')
        .range(offset, offset + batchSize - 1);

      if (error) {
        console.error('Error fetching line items:', error);
        break;
      }

      if (!lineItems || lineItems.length === 0) {
        break;
      }

      console.log(`Processing batch ${Math.floor(offset / batchSize) + 1} (${lineItems.length} items)...`);

      for (const item of lineItems) {
        processedCount++;

        const textToParse = item.description || '';

        if (!textToParse.trim()) {
          continue;
        }

        try {
          const garmentInfo = parseGarmentInfo(textToParse);

          if (garmentInfo.style || garmentInfo.color || Object.keys(garmentInfo.sizes).length > 0) {
            const { error: updateError } = await supabase
              .from('printavo_line_items')
              .update({
                extracted_style: garmentInfo.style,
                extracted_color: garmentInfo.color,
                extracted_sizes: Object.keys(garmentInfo.sizes).length > 0 ? garmentInfo.sizes : null,
                parsed_at: new Date().toISOString(),
              })
              .eq('id', item.id);

            if (updateError) {
              console.error(`Error updating line item ${item.id}:`, updateError);
              errorCount++;
            } else {
              updatedCount++;
            }
          }
        } catch (err) {
          console.error(`Error parsing line item ${item.id}:`, err);
          errorCount++;
        }
      }

      if (lineItems.length < batchSize) {
        break;
      }

      offset += batchSize;
    }

    const result = {
      success: true,
      summary: {
        totalProcessed: processedCount,
        successfullyUpdated: updatedCount,
        errors: errorCount,
        skipped: processedCount - updatedCount - errorCount,
      },
    };

    return new Response(
      JSON.stringify(result),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Backfill error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});