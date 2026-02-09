/*
  # Add was_reopened flag to quotes

  1. Changes
    - Add `was_reopened` boolean column to quotes table
    - Defaults to false
    - Used to show banner when an approved quote is reopened for editing

  2. Purpose
    - Track when approved quotes are reopened for editing
    - Preserve quote history while allowing modifications
*/

ALTER TABLE quotes
ADD COLUMN IF NOT EXISTS was_reopened boolean DEFAULT false;
