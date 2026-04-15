
1. First the chippy integration is not working  and it was this morning

The error "case not found" is a PostgreSQL error that occurs when a CASE statement encounters a value that doesn't match any WHEN clause and there is no ELSE clause. Here is exactly what's happening:

Root Cause Found
The standalone process_chipply_import(uuid) function (called by the edge function via RPC) contains a CASE statement for size mapping that has no ELSE clause:
CASE v_size_name
  WHEN 'YXS' THEN ...
  WHEN 'YS' THEN ...
  ...
  WHEN '5XL' THEN ...
  -- NO ELSE HERE
END CASE;


In PostgreSQL, a searched CASE without an ELSE throws a case not found exception when an unmatched value is encountered. The incoming Chipply payload contains sizes like "XS" with a different format (it appears the size field value has extra data or a non-matching variant), or more likely, certain size strings that don't match any WHEN clause -- things like "YOUTH XS", "SM", "2X", "Adult S", etc.
The trigger version of the function was updated to handle these with ELSE NULL;, but the standalone version (the one called by the edge function via RPC) was not updated with the same comprehensive size list and ELSE NULL safety net.


Fix Chipply "case not found" Error
1. Fix the SQL Processor Function
Add ELSE NULL to the CASE v_size_name statement in the standalone process_chipply_import(uuid) function so unrecognized size strings don't throw an exception
Expand the WHEN clauses to match the same comprehensive list as the trigger version, including aliases like 'YOUTH XS', 'SM', 'MD', 'LG', '2X', '3X', 'XXL', 'Adult S', 'Adult M', etc.
Create a new migration file that replaces the current standalone function with the corrected version

The bug is straightforward: the standalone SQL function called by the Chipply edge function has an incomplete CASE statement with no ELSE fallback. When Chipply sends a size string that isn't in the hardcoded list (e.g., YOUTH XS, SM, Adult S), PostgreSQL throws a case not found error, which propagates back as received_but_processing_failed. The fix requires one migration to add ELSE NULL and expand the size aliases.


2. Need to sort the json file so all parts of it land in the correct spot on the quote
If we can have a 45 minute chat about this at some point toward the end of the week that would be great

3.   When I download a quote PDF the line item total is stacked.  See image below





