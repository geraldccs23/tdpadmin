-- Migration 005: Partners + Comisiones
-- =============================================================================

-- 1. Agregar campos de partner a users
ALTER TABLE tdpadmin.users ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE tdpadmin.users ADD COLUMN IF NOT EXISTS bank_name TEXT NOT NULL DEFAULT '';
ALTER TABLE tdpadmin.users ADD COLUMN IF NOT EXISTS bank_account_type TEXT NOT NULL DEFAULT '';
ALTER TABLE tdpadmin.users ADD COLUMN IF NOT EXISTS bank_account_number TEXT NOT NULL DEFAULT '';
ALTER TABLE tdpadmin.users ADD COLUMN IF NOT EXISTS bank_document_id TEXT NOT NULL DEFAULT '';
ALTER TABLE tdpadmin.users ADD COLUMN IF NOT EXISTS bank_phone TEXT NOT NULL DEFAULT '';
ALTER TABLE tdpadmin.users ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2) NOT NULL DEFAULT 10.00;

-- 2. Tabla de comisiones
CREATE TABLE IF NOT EXISTS tdpadmin.commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES tdpadmin.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES tdpadmin.clients(id) ON DELETE SET NULL,
  project_name TEXT NOT NULL DEFAULT '',
  client_name TEXT NOT NULL DEFAULT '',
  project_value NUMERIC(14,2) NOT NULL DEFAULT 0,
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  commission_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','paid','cancelled')),
  notes TEXT NOT NULL DEFAULT '',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commissions_partner ON tdpadmin.commissions(partner_id);
CREATE INDEX IF NOT EXISTS idx_commissions_status ON tdpadmin.commissions(status);

DROP TRIGGER IF EXISTS trg_tdp_commissions_updated_at ON tdpadmin.commissions;
CREATE TRIGGER trg_tdp_commissions_updated_at BEFORE UPDATE ON tdpadmin.commissions
  FOR EACH ROW EXECUTE FUNCTION tdpadmin.set_updated_at();

-- 3. Generar códigos de referido para partners existentes
UPDATE tdpadmin.users SET referral_code = 'TDP-' || UPPER(SUBSTRING(MD5(id::TEXT) FROM 1 FOR 6))
WHERE role = 'sales' AND referral_code IS NULL;
