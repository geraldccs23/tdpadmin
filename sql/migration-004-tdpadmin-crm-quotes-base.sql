-- Migration 004: CRM + Quotes base
-- PostgreSQL 17 — idempotente
-- =============================================================================

-- =============================================================================
-- 1. Ampliar tdpadmin.clients
-- =============================================================================
ALTER TABLE tdpadmin.clients ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'prospect'
  CHECK (kind IN ('prospect','client','partner','provider'));
ALTER TABLE tdpadmin.clients ADD COLUMN IF NOT EXISTS company_name TEXT NOT NULL DEFAULT '';
ALTER TABLE tdpadmin.clients ADD COLUMN IF NOT EXISTS contact_name TEXT NOT NULL DEFAULT '';
ALTER TABLE tdpadmin.clients ADD COLUMN IF NOT EXISTS position TEXT NOT NULL DEFAULT '';
ALTER TABLE tdpadmin.clients ADD COLUMN IF NOT EXISTS whatsapp TEXT NOT NULL DEFAULT '';
ALTER TABLE tdpadmin.clients ADD COLUMN IF NOT EXISTS instagram TEXT NOT NULL DEFAULT '';
ALTER TABLE tdpadmin.clients ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'Venezuela';
ALTER TABLE tdpadmin.clients ADD COLUMN IF NOT EXISTS city TEXT NOT NULL DEFAULT '';
ALTER TABLE tdpadmin.clients ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'otro';
ALTER TABLE tdpadmin.clients ADD COLUMN IF NOT EXISTS interest TEXT NOT NULL DEFAULT '';
ALTER TABLE tdpadmin.clients ADD COLUMN IF NOT EXISTS estimated_budget NUMERIC(14,2);
ALTER TABLE tdpadmin.clients ADD COLUMN IF NOT EXISTS next_follow_up DATE;
ALTER TABLE tdpadmin.clients ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES tdpadmin.users(id) ON DELETE SET NULL;
ALTER TABLE tdpadmin.clients ADD COLUMN IF NOT EXISTS lost_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE tdpadmin.clients ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

-- Actualizar CHECK de status
ALTER TABLE tdpadmin.clients DROP CONSTRAINT IF EXISTS tdpadmin_clients_status_check;
ALTER TABLE tdpadmin.clients ADD CONSTRAINT tdpadmin_clients_status_check
  CHECK (status IN ('lead','contacted','qualified','proposal_sent','won','lost','active','inactive'));

DROP INDEX IF EXISTS tdpadmin.idx_tdp_clients_kind;
DROP INDEX IF EXISTS tdpadmin.idx_tdp_clients_source;
DROP INDEX IF EXISTS tdpadmin.idx_tdp_clients_assigned;
CREATE INDEX IF NOT EXISTS idx_tdp_clients_kind ON tdpadmin.clients(kind);
CREATE INDEX IF NOT EXISTS idx_tdp_clients_source ON tdpadmin.clients(source);
CREATE INDEX IF NOT EXISTS idx_tdp_clients_assigned ON tdpadmin.clients(assigned_to);

-- =============================================================================
-- 2. Ampliar tdpadmin.quotes
-- =============================================================================
ALTER TABLE tdpadmin.quotes ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE tdpadmin.quotes ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(18,6);
ALTER TABLE tdpadmin.quotes ADD COLUMN IF NOT EXISTS discount NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE tdpadmin.quotes ADD COLUMN IF NOT EXISTS terms TEXT NOT NULL DEFAULT '';
ALTER TABLE tdpadmin.quotes ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- Actualizar CHECK de status
ALTER TABLE tdpadmin.quotes DROP CONSTRAINT IF EXISTS tdpadmin_quotes_status_check;
ALTER TABLE tdpadmin.quotes ADD CONSTRAINT tdpadmin_quotes_status_check
  CHECK (status IN ('draft','sent','approved','rejected','expired','cancelled'));

-- Secuencia con formato PRE-YYYYMM-NNNNN
CREATE SEQUENCE IF NOT EXISTS tdpadmin.seq_quote_number_v2 START 1;

CREATE OR REPLACE FUNCTION tdpadmin.generate_quote_number_v2()
RETURNS TEXT AS $$
DECLARE
  seq_num TEXT;
BEGIN
  seq_num := LPAD(nextval('tdpadmin.seq_quote_number_v2')::TEXT, 5, '0');
  RETURN 'PRE-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || seq_num;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 3. Ampliar tdpadmin.quote_items
-- =============================================================================
ALTER TABLE tdpadmin.quote_items ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT 'service'
  CHECK (item_type IN ('service','product','hosting','domain','license','other'));
ALTER TABLE tdpadmin.quote_items ADD COLUMN IF NOT EXISTS display_order INT NOT NULL DEFAULT 0;
