/*
  # Backfill Existing Chipply Quotes with Location-Filtered Garment Images

  1. Purpose
    - Fix existing Chipply-imported quotes that have all garment images on all imprints
    - Apply the same location-based filtering logic to existing data

  2. Approach
    - Find all quotes that came from Chipply imports
    - For each quote, rebuild garment_images per imprint based on location
    - Use the get_relevant_garment_images_for_location function
*/

DO $$
DECLARE
  v_quote RECORD;
  v_imprint RECORD;
  v_all_images jsonb;
  v_filtered_images jsonb;
  v_updated_count integer := 0;
BEGIN
  -- Loop through all Chipply-imported quotes
  FOR v_quote IN 
    SELECT DISTINCT q.id, q.quote_number
    FROM quotes q
    WHERE q.chipply_import_log_id IS NOT NULL
  LOOP
    RAISE NOTICE 'Processing quote: %', v_quote.quote_number;
    
    -- For each imprint in this quote, rebuild garment images based on location
    FOR v_imprint IN
      SELECT qi.id, qi.location, qi.group_label
      FROM quote_imprints qi
      WHERE qi.quote_id = v_quote.id
    LOOP
      -- Get all garment images for this group from line items
      SELECT jsonb_agg(DISTINCT img_obj)
      INTO v_all_images
      FROM (
        SELECT jsonb_build_object('url', garment_front_image_url, 'view', 'front') AS img_obj
        FROM quote_line_items
        WHERE quote_id = v_quote.id
        AND group_label = v_imprint.group_label
        AND garment_front_image_url IS NOT NULL
        
        UNION ALL
        
        SELECT jsonb_build_object('url', garment_back_image_url, 'view', 'back') AS img_obj
        FROM quote_line_items
        WHERE quote_id = v_quote.id
        AND group_label = v_imprint.group_label
        AND garment_back_image_url IS NOT NULL
        
        UNION ALL
        
        SELECT jsonb_build_object('url', garment_side_image_url, 'view', 'side') AS img_obj
        FROM quote_line_items
        WHERE quote_id = v_quote.id
        AND group_label = v_imprint.group_label
        AND garment_side_image_url IS NOT NULL
      ) imgs;
      
      -- Filter based on location
      IF v_all_images IS NOT NULL THEN
        v_filtered_images := get_relevant_garment_images_for_location(v_imprint.location, v_all_images);
        
        -- Update the imprint
        UPDATE quote_imprints
        SET garment_images = v_filtered_images
        WHERE id = v_imprint.id;
        
        v_updated_count := v_updated_count + 1;
        
        RAISE NOTICE '  Imprint location "%" -> % images (was %)', 
          COALESCE(v_imprint.location, 'NULL'), 
          jsonb_array_length(COALESCE(v_filtered_images, '[]'::jsonb)),
          jsonb_array_length(COALESCE(v_all_images, '[]'::jsonb));
      END IF;
    END LOOP;
  END LOOP;
  
  RAISE NOTICE 'Backfill complete. Updated % imprints.', v_updated_count;
END $$;
