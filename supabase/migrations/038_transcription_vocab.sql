-- Voeg transcription_vocab toe aan tenant_config voor Chase.
-- tenant_config.transcription_vocab is een array van strings die als custom dictionary
-- worden meegegeven aan de transcriptiedienst naast de locatienamen uit de database.
-- Per tenant instelbaar; andere tenants krijgen een lege array als startpunt.

UPDATE public.tenants
SET tenant_config = tenant_config || jsonb_build_object(
  'transcription_vocab', jsonb_build_array(
    'Collabor8',
    'Oslofjordweg',
    'Coca-Cola Zero Sugar'
  )
)
WHERE hostname IN ('chase.waybetter.nl', 'chase-staging.waybetter.nl');
