-- Migration 015: Pagos/Cobranza, Time Tracking, Contratos
-- =============================================================================

-- 1. Pagos / Cobranza
CREATE TABLE IF NOT EXISTS tdpadmin.invoice_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES tdpadmin.invoices(id) ON DELETE RESTRICT,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT NOT NULL DEFAULT 'transfer' CHECK (payment_method IN ('transfer','cash','zelle','paypal','credit_card','debit_card','other')),
  reference TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES tdpadmin.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tdp_invoice_payments_invoice ON tdpadmin.invoice_payments(invoice_id);

-- Paid amount view for invoices
CREATE OR REPLACE VIEW tdpadmin.vw_invoice_balances AS
SELECT
  i.id AS invoice_id,
  i.total,
  COALESCE(SUM(ip.amount), 0) AS paid_amount,
  i.total - COALESCE(SUM(ip.amount), 0) AS balance_due,
  CASE
    WHEN COALESCE(SUM(ip.amount), 0) >= i.total THEN 'paid'
    WHEN COALESCE(SUM(ip.amount), 0) > 0 THEN 'partial'
    ELSE 'unpaid'
  END AS payment_status
FROM tdpadmin.invoices i
LEFT JOIN tdpadmin.invoice_payments ip ON ip.invoice_id = i.id
GROUP BY i.id, i.total;

-- 2. Time Tracking / Horas
CREATE TABLE IF NOT EXISTS tdpadmin.time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES tdpadmin.projects(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tdpadmin.project_tasks(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES tdpadmin.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  hours NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (hours > 0),
  description TEXT NOT NULL DEFAULT '',
  billable BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tdp_time_entries_project ON tdpadmin.time_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_tdp_time_entries_user ON tdpadmin.time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_tdp_time_entries_date ON tdpadmin.time_entries(date);

DROP TRIGGER IF EXISTS trg_tdp_time_entries_updated_at ON tdpadmin.time_entries;
CREATE TRIGGER trg_tdp_time_entries_updated_at BEFORE UPDATE ON tdpadmin.time_entries
  FOR EACH ROW EXECUTE FUNCTION tdpadmin.set_updated_at();

-- 3. Contratos / SOW
CREATE TABLE IF NOT EXISTS tdpadmin.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES tdpadmin.projects(id) ON DELETE SET NULL,
  client_id UUID NOT NULL REFERENCES tdpadmin.clients(id) ON DELETE RESTRICT,
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  file_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','signed','cancelled')),
  signed_at TIMESTAMPTZ,
  signed_by_client BOOLEAN NOT NULL DEFAULT false,
  valid_from DATE,
  valid_until DATE,
  created_by UUID REFERENCES tdpadmin.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tdp_contracts_project ON tdpadmin.contracts(project_id);
CREATE INDEX IF NOT EXISTS idx_tdp_contracts_client ON tdpadmin.contracts(client_id);

DROP TRIGGER IF EXISTS trg_tdp_contracts_updated_at ON tdpadmin.contracts;
CREATE TRIGGER trg_tdp_contracts_updated_at BEFORE UPDATE ON tdpadmin.contracts
  FOR EACH ROW EXECUTE FUNCTION tdpadmin.set_updated_at();

-- 4. Add paid_amount column to invoices for quick reference
ALTER TABLE tdpadmin.invoices ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(14,2) NOT NULL DEFAULT 0;
