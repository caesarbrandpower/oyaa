-- Sla veldbriefing bijlagen (foto's + links) op als JSON per thread
-- Structuur: { [messageId]: { photos: [{url, name}], links: [{label, url}] } }
ALTER TABLE threads ADD COLUMN IF NOT EXISTS field_briefing_extras jsonb;
