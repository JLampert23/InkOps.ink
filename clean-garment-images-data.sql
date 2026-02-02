-- Clean up garment_images_data by removing non-image URLs and empty strings
-- This fixes blank thumbnails showing in the Mockup Generator

DO $$
DECLARE
  line_item RECORD;
  cleaned_data JSONB;
  original_data JSONB;
  update_count INTEGER := 0;
BEGIN
  -- Loop through all line items with garment_images_data
  FOR line_item IN
    SELECT id, garment_images_data
    FROM quote_line_items
    WHERE garment_images_data IS NOT NULL
  LOOP
    original_data := line_item.garment_images_data;

    -- Clean each image array
    cleaned_data := jsonb_build_object(
      'frontImages', (
        SELECT jsonb_agg(elem)
        FROM jsonb_array_elements_text(original_data->'frontImages') elem
        WHERE elem IS NOT NULL
          AND elem != ''
          AND elem != 'null'
          AND elem != 'undefined'
          AND (elem ILIKE '%.jpg' OR elem ILIKE '%.jpeg' OR elem ILIKE '%.png' OR elem ILIKE '%.gif' OR elem ILIKE '%.webp' OR elem ILIKE '%.svg')
          AND elem NOT ILIKE '%.pdf'
          AND elem NOT ILIKE '%itemspecs.aspx%'
          AND elem NOT ILIKE '%itemspecsheet.aspx%'
      ),
      'rearImages', (
        SELECT jsonb_agg(elem)
        FROM jsonb_array_elements_text(original_data->'rearImages') elem
        WHERE elem IS NOT NULL
          AND elem != ''
          AND elem != 'null'
          AND elem != 'undefined'
          AND (elem ILIKE '%.jpg' OR elem ILIKE '%.jpeg' OR elem ILIKE '%.png' OR elem ILIKE '%.gif' OR elem ILIKE '%.webp' OR elem ILIKE '%.svg')
          AND elem NOT ILIKE '%.pdf'
          AND elem NOT ILIKE '%itemspecs.aspx%'
          AND elem NOT ILIKE '%itemspecsheet.aspx%'
      ),
      'sideImages', (
        SELECT jsonb_agg(elem)
        FROM jsonb_array_elements_text(original_data->'sideImages') elem
        WHERE elem IS NOT NULL
          AND elem != ''
          AND elem != 'null'
          AND elem != 'undefined'
          AND (elem ILIKE '%.jpg' OR elem ILIKE '%.jpeg' OR elem ILIKE '%.png' OR elem ILIKE '%.gif' OR elem ILIKE '%.webp' OR elem ILIKE '%.svg')
          AND elem NOT ILIKE '%.pdf'
          AND elem NOT ILIKE '%itemspecs.aspx%'
          AND elem NOT ILIKE '%itemspecsheet.aspx%'
      ),
      'lifestyleImages', (
        SELECT jsonb_agg(elem)
        FROM jsonb_array_elements_text(original_data->'lifestyleImages') elem
        WHERE elem IS NOT NULL
          AND elem != ''
          AND elem != 'null'
          AND elem != 'undefined'
          AND (elem ILIKE '%.jpg' OR elem ILIKE '%.jpeg' OR elem ILIKE '%.png' OR elem ILIKE '%.gif' OR elem ILIKE '%.webp' OR elem ILIKE '%.svg')
          AND elem NOT ILIKE '%.pdf'
          AND elem NOT ILIKE '%itemspecs.aspx%'
          AND elem NOT ILIKE '%itemspecsheet.aspx%'
      ),
      'otherImages', (
        SELECT jsonb_agg(elem)
        FROM jsonb_array_elements_text(original_data->'otherImages') elem
        WHERE elem IS NOT NULL
          AND elem != ''
          AND elem != 'null'
          AND elem != 'undefined'
          AND (elem ILIKE '%.jpg' OR elem ILIKE '%.jpeg' OR elem ILIKE '%.png' OR elem ILIKE '%.gif' OR elem ILIKE '%.webp' OR elem ILIKE '%.svg')
          AND elem NOT ILIKE '%.pdf'
          AND elem NOT ILIKE '%itemspecs.aspx%'
          AND elem NOT ILIKE '%itemspecsheet.aspx%'
      ),
      'allImages', (
        SELECT jsonb_agg(elem)
        FROM jsonb_array_elements_text(original_data->'allImages') elem
        WHERE elem IS NOT NULL
          AND elem != ''
          AND elem != 'null'
          AND elem != 'undefined'
          AND (elem ILIKE '%.jpg' OR elem ILIKE '%.jpeg' OR elem ILIKE '%.png' OR elem ILIKE '%.gif' OR elem ILIKE '%.webp' OR elem ILIKE '%.svg')
          AND elem NOT ILIKE '%.pdf'
          AND elem NOT ILIKE '%itemspecs.aspx%'
          AND elem NOT ILIKE '%itemspecsheet.aspx%'
      )
    );

    -- Replace NULL arrays with empty arrays
    cleaned_data := jsonb_build_object(
      'frontImages', COALESCE(cleaned_data->'frontImages', '[]'::jsonb),
      'rearImages', COALESCE(cleaned_data->'rearImages', '[]'::jsonb),
      'sideImages', COALESCE(cleaned_data->'sideImages', '[]'::jsonb),
      'lifestyleImages', COALESCE(cleaned_data->'lifestyleImages', '[]'::jsonb),
      'otherImages', COALESCE(cleaned_data->'otherImages', '[]'::jsonb),
      'allImages', COALESCE(cleaned_data->'allImages', '[]'::jsonb)
    );

    -- Update if changed
    IF original_data != cleaned_data THEN
      UPDATE quote_line_items
      SET garment_images_data = cleaned_data
      WHERE id = line_item.id;

      update_count := update_count + 1;

      RAISE NOTICE 'Updated line item % (%, %)', line_item.id, update_count, 'cleaned';
    END IF;
  END LOOP;

  RAISE NOTICE 'Cleanup complete! Updated % line items', update_count;
END $$;
