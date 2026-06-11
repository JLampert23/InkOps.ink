-- 2026-06-11 [3.2-3] — Portal branding on PRE-AUTH pages (login screen).
--
-- PortalLayout already shows the company logo/name AFTER login (branding
-- arrives with the portal-data session payload). But the login page itself
-- renders a generic "Customer Portal" header — Jamie wants Todd's customers
-- to see Todd's branding from the first screen.
--
-- Magic links and portal URLs are built as https://<subdomain>.inkops.ink
-- (see send-magic-link), so the hostname identifies the company before any
-- auth happens. This RPC resolves a subdomain to the MINIMAL public-safe
-- branding fields: company name + logo. Nothing else is exposed — no keys,
-- no settings, no contact data.
--
-- Matching mirrors send-magic-link's URL construction exactly:
--   1. company_settings.inkops_subdomain (explicit), else
--   2. lower(company_name) stripped to [a-z0-9], first 30 chars (the
--      generated fallback used when inkops_subdomain is null).

CREATE OR REPLACE FUNCTION public.get_portal_branding_by_subdomain(p_subdomain text)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'company_name', cs.company_name,
    'logo_url', cs.company_logo_primary_url,
    'company_logo_primary_url', cs.company_logo_primary_url,
    'company_address', NULL,
    'company_phone', NULL,
    'company_email', NULL,
    'customer_url', NULL
  )
  FROM company_settings cs
  WHERE lower(coalesce(cs.inkops_subdomain, '')) = lower(trim(p_subdomain))
     OR left(regexp_replace(lower(coalesce(cs.company_name, '')), '[^a-z0-9]', '', 'g'), 30)
        = lower(trim(p_subdomain))
  ORDER BY (lower(coalesce(cs.inkops_subdomain, '')) = lower(trim(p_subdomain))) DESC
  LIMIT 1;
$$;

-- Pre-auth callers use the anon key.
GRANT EXECUTE ON FUNCTION public.get_portal_branding_by_subdomain(text) TO anon, authenticated;
