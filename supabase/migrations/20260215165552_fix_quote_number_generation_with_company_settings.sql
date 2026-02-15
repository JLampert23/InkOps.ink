/*
  # Fix Quote Number Generation with Company Settings
  
  1. Changes
    - Drop old generate_quote_number() function
    - Create new function that accepts company_id parameter
    - Respects company_settings (quote_prefix, quote_start_number)
    - Ensures unique number generation by checking for existing numbers
    - Uses proper sequential numbering per company
*/

-- Drop old function
DROP FUNCTION IF EXISTS generate_quote_number();

-- Create new function that respects company settings
CREATE OR REPLACE FUNCTION generate_quote_number(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_prefix text;
  v_start_number int;
  v_use_prefix boolean;
  v_max_number int;
  v_new_number text;
  v_exists boolean;
  v_attempt int := 0;
BEGIN
  -- Get company settings
  SELECT 
    COALESCE(quote_prefix, 'QTE'),
    COALESCE(quote_start_number, 1),
    COALESCE(use_quote_prefix, true)
  INTO v_prefix, v_start_number, v_use_prefix
  FROM company_settings
  WHERE id = p_company_id;

  -- If no settings found, use defaults
  IF NOT FOUND THEN
    v_prefix := 'QTE';
    v_start_number := 1;
    v_use_prefix := true;
  END IF;

  -- Build the pattern for this company's quotes
  LOOP
    -- Get the highest number for this company with this prefix
    IF v_use_prefix THEN
      SELECT COALESCE(MAX(
        NULLIF(regexp_replace(quote_number, '[^0-9]', '', 'g'), '')::int
      ), v_start_number - 1) INTO v_max_number
      FROM quotes
      WHERE company_id = p_company_id
      AND quote_number LIKE v_prefix || '%';
      
      -- Generate new quote number with prefix
      v_new_number := v_prefix || '-' || LPAD((v_max_number + 1)::text, 4, '0');
    ELSE
      SELECT COALESCE(MAX(
        NULLIF(regexp_replace(quote_number, '[^0-9]', '', 'g'), '')::int
      ), v_start_number - 1) INTO v_max_number
      FROM quotes
      WHERE company_id = p_company_id
      AND quote_number ~ '^[0-9]+$';
      
      -- Generate new quote number without prefix
      v_new_number := LPAD((v_max_number + 1)::text, 4, '0');
    END IF;

    -- Check if this number already exists (race condition protection)
    SELECT EXISTS(
      SELECT 1 FROM quotes 
      WHERE quote_number = v_new_number 
      AND company_id = p_company_id
    ) INTO v_exists;

    -- If unique, return it
    IF NOT v_exists THEN
      RETURN v_new_number;
    END IF;

    -- Safety: prevent infinite loop
    v_attempt := v_attempt + 1;
    IF v_attempt > 10 THEN
      RAISE EXCEPTION 'Failed to generate unique quote number after 10 attempts';
    END IF;
    
    -- Try again with next number
    v_max_number := v_max_number + 1;
  END LOOP;
END;
$$;
