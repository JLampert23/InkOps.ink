#!/bin/bash

echo "=== Production Migration Helper ==="
echo ""

OUTPUT_FILE="PRODUCTION_COMPLETE_MIGRATION.sql"

# Create header
cat > "$OUTPUT_FILE" << 'EOF'
/*
  COMPLETE PRODUCTION MIGRATION SCRIPT

  This file combines all migrations in chronological order.
  Apply this to your production database at:
  https://supabase.com/dashboard/project/gccvdsxiqgbxhdyamzaa/sql/new

  IMPORTANT:
  1. Run this in the SQL Editor
  2. After completion, run: NOTIFY pgrst, 'reload schema';
  3. Wait 30 seconds for PostgREST to reload
  4. Test your application
*/

EOF

# Combine all migrations
echo "" >> "$OUTPUT_FILE"
for file in supabase/migrations/*.sql; do
    filename=$(basename "$file")
    echo "-- ============================================================================" >> "$OUTPUT_FILE"
    echo "-- Migration: $filename" >> "$OUTPUT_FILE"
    echo "-- ============================================================================" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    cat "$file" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    echo "  ✓ Added: $filename"
done

# Add schema reload
cat >> "$OUTPUT_FILE" << 'EOF'
-- ============================================================================
-- Force PostgREST to reload schema
-- ============================================================================

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

EOF

echo ""
echo "=== Migration file created: $OUTPUT_FILE ==="
echo ""
echo "Next steps:"
echo "1. Open: https://supabase.com/dashboard/project/gccvdsxiqgbxhdyamzaa/sql/new"
echo "2. Copy the contents of: $OUTPUT_FILE"
echo "3. Paste into the SQL Editor and click 'Run'"
echo "4. Wait 30 seconds for schema reload"
echo "5. Test your application"
