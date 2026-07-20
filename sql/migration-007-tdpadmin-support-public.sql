-- Migration 007: Public API para soporte externo
-- =============================================================================

-- 1. Allow external clients (without client_id FK)
ALTER TABLE tdpadmin.support_tickets ALTER COLUMN client_id DROP NOT NULL;
ALTER TABLE tdpadmin.support_tickets ADD COLUMN IF NOT EXISTS client_email TEXT NOT NULL DEFAULT '';
ALTER TABLE tdpadmin.support_tickets ADD COLUMN IF NOT EXISTS client_name TEXT NOT NULL DEFAULT '';
