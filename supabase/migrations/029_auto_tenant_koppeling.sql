-- supabase/migrations/029_auto_tenant_koppeling.sql
-- Automatische koppeling van nieuwe gebruikers aan de juiste tenant op basis
-- van e-maildomein. Drie onderdelen:
--   1. allowed_email_domains kolom op tenants
--   2. Trigger op auth.users die bij eerste login koppelt
--   3. Backfill voor bestaande Chase-accounts

-- ── STAP 1: allowed_email_domains kolom ──────────────────────────────────────

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS allowed_email_domains jsonb DEFAULT '[]'::jsonb;

UPDATE public.tenants
SET allowed_email_domains = '["chase.amsterdam", "startthechase.com"]'::jsonb
WHERE hostname IN ('chase.waybetter.nl', 'chase-staging.waybetter.nl');

-- ── STAP 2: trigger-functie ───────────────────────────────────────────────────
-- Draait als SECURITY DEFINER zodat hij user_tenants kan schrijven
-- zonder een open insert-policy.

CREATE OR REPLACE FUNCTION public.koppel_gebruiker_aan_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_domain text;
  v_tenant_id uuid;
BEGIN
  -- Haal het domein op uit het e-mailadres
  v_domain := split_part(NEW.email, '@', 2);

  -- Zoek de eerste tenant waarvan allowed_email_domains dit domein bevat
  SELECT id INTO v_tenant_id
  FROM public.tenants
  WHERE allowed_email_domains @> to_jsonb(v_domain)
  LIMIT 1;

  IF v_tenant_id IS NOT NULL THEN
    INSERT INTO public.user_tenants (user_id, tenant_id)
    VALUES (NEW.id, v_tenant_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger op auth.users — draait na elke nieuwe rij (= na invite bevestiging)
DROP TRIGGER IF EXISTS trigger_koppel_gebruiker_aan_tenant ON auth.users;

CREATE TRIGGER trigger_koppel_gebruiker_aan_tenant
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.koppel_gebruiker_aan_tenant();

-- ── STAP 3: backfill bestaande Chase-accounts ─────────────────────────────────
-- Koppelt alle bestaande gebruikers met een chase.amsterdam of
-- startthechase.com e-mailadres die nog niet in user_tenants staan.

INSERT INTO public.user_tenants (user_id, tenant_id)
SELECT u.id, t.id
FROM auth.users u
CROSS JOIN public.tenants t
WHERE t.hostname = 'chase.waybetter.nl'
  AND (
    u.email LIKE '%@chase.amsterdam'
    OR u.email LIKE '%@startthechase.com'
  )
ON CONFLICT DO NOTHING;

-- ── Verificatie ───────────────────────────────────────────────────────────────
SELECT u.email, tn.hostname
FROM auth.users u
JOIN public.user_tenants ut ON ut.user_id = u.id
JOIN public.tenants tn ON tn.id = ut.tenant_id
WHERE tn.hostname = 'chase.waybetter.nl'
ORDER BY u.email;
