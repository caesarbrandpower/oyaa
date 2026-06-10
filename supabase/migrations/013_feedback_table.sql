-- supabase/migrations/013_feedback_table.sql
CREATE TABLE public.feedback (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid        REFERENCES public.tenants(id) ON DELETE SET NULL,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email text        NOT NULL,
  page_url   text,
  message    text        NOT NULL,
  status     text        NOT NULL DEFAULT 'nieuw',
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.feedback.status IS 'nieuw | gelezen | afgehandeld';

CREATE INDEX feedback_tenant_created ON public.feedback (tenant_id, created_at);
CREATE INDEX feedback_status         ON public.feedback (status);
