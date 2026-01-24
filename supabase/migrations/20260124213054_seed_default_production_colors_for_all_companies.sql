/*
  # Seed Default Production Colors for All Companies
  
  1. Purpose
    - Add default ink and thread color options for companies that don't have any
    - Ensures the Imprints modal color dropdowns work for all companies
  
  2. Default Colors
    - Ink Colors: Black, White, Red, Navy, Royal Blue, Light Blue, Dark Green, Kelly Green, Yellow, Orange, Purple, Maroon, Gray
    - Thread Colors: Black, White, Red, Navy, Royal Blue, Light Blue, Dark Green, Kelly Green, Yellow, Orange, Purple, Maroon, Gray
  
  3. Notes
    - Only inserts for companies that don't have production_color_settings yet
    - Uses common industry-standard color options
*/

-- Insert default production colors for companies that don't have them
INSERT INTO production_color_settings (company_id, ink_colors, thread_colors)
SELECT 
  cs.id as company_id,
  '[
    {"name": "Black"},
    {"name": "White"},
    {"name": "Red"},
    {"name": "Navy"},
    {"name": "Royal Blue"},
    {"name": "Light Blue"},
    {"name": "Dark Green"},
    {"name": "Kelly Green"},
    {"name": "Yellow"},
    {"name": "Orange"},
    {"name": "Purple"},
    {"name": "Maroon"},
    {"name": "Gray"}
  ]'::jsonb as ink_colors,
  '[
    {"name": "Black"},
    {"name": "White"},
    {"name": "Red"},
    {"name": "Navy"},
    {"name": "Royal Blue"},
    {"name": "Light Blue"},
    {"name": "Dark Green"},
    {"name": "Kelly Green"},
    {"name": "Yellow"},
    {"name": "Orange"},
    {"name": "Purple"},
    {"name": "Maroon"},
    {"name": "Gray"}
  ]'::jsonb as thread_colors
FROM company_settings cs
WHERE NOT EXISTS (
  SELECT 1 
  FROM production_color_settings pcs 
  WHERE pcs.company_id = cs.id
);
