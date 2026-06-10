-- supabase/migrations/012_token_usage.sql
CREATE TABLE public.token_usage (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid        REFERENCES public.tenants(id) ON DELETE SET NULL,
  user_id              uuid,
  thread_id            uuid        REFERENCES public.threads(id) ON DELETE SET NULL,
  request_type         text        NOT NULL,
  model                text        NOT NULL,
  input_tokens         int         NOT NULL DEFAULT 0,
  output_tokens        int         NOT NULL DEFAULT 0,
  cache_read_tokens    int         NOT NULL DEFAULT 0,
  cache_creation_tokens int        NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.token_usage.request_type IS
  'chat-custom-analysis | chat-custom-generation | chat | generate-title | rewrite-marker';

CREATE INDEX token_usage_tenant_created ON public.token_usage (tenant_id, created_at);
CREATE INDEX token_usage_user_created   ON public.token_usage (user_id,   created_at);
