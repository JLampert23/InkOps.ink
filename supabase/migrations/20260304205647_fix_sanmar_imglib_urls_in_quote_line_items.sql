/*
  # Fix SanMar /imglib/ URLs in quote_line_items

  1. Changes
    - Rewrites all garment image URLs that contain the dead `/imglib/` CDN path
      to the working `/catalog/images/` path
    - Applies to garment_front_image_url, garment_rear_image_url, garment_side_image_url,
      garment_back_image_url, and garment_images_data (JSONB)
    - The proxy URL structure is preserved, only the encoded SanMar CDN path is updated

  2. Background
    - SanMar deprecated their `/imglib/` CDN path; all such URLs now redirect to
      a "not available" placeholder
    - The working path is `/catalog/images/{filename}`
*/

UPDATE quote_line_items
SET garment_front_image_url = regexp_replace(
  garment_front_image_url,
  '%2Fimglib%2F[^%]+%2F',
  '%2Fcatalog%2Fimages%2F',
  'g'
)
WHERE garment_front_image_url LIKE '%imglib%';

UPDATE quote_line_items
SET garment_rear_image_url = regexp_replace(
  garment_rear_image_url,
  '%2Fimglib%2F[^%]+%2F',
  '%2Fcatalog%2Fimages%2F',
  'g'
)
WHERE garment_rear_image_url LIKE '%imglib%';

UPDATE quote_line_items
SET garment_back_image_url = regexp_replace(
  garment_back_image_url,
  '%2Fimglib%2F[^%]+%2F',
  '%2Fcatalog%2Fimages%2F',
  'g'
)
WHERE garment_back_image_url LIKE '%imglib%';

UPDATE quote_line_items
SET garment_side_image_url = regexp_replace(
  garment_side_image_url,
  '%2Fimglib%2F[^%]+%2F',
  '%2Fcatalog%2Fimages%2F',
  'g'
)
WHERE garment_side_image_url LIKE '%imglib%';

UPDATE quote_line_items
SET garment_images_data = replace(
  garment_images_data::text,
  '%2Fimglib%2F',
  '%2Fcatalog%2Fimages%2F'
)::jsonb
WHERE garment_images_data::text LIKE '%imglib%';
