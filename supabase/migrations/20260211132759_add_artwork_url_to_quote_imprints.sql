/*
  # Add Artwork URL to Quote Imprints
  
  1. Changes
    - Add artwork_url column to store the URL of the artwork/art file
    - This will be populated from Chipply's component.artworkVariations[].imageSrc
*/

ALTER TABLE quote_imprints 
ADD COLUMN IF NOT EXISTS artwork_url text;
