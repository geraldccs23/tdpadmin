-- Migration 014: Invoicing / Facturación
-- =============================================================================

CREATE SEQUENCE IF NOT EXISTS tdpadmin.seq_invoice_number START 1;

CREATE TABLE IF NOT EXISTS tdpadmin.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE DEFAULT 'FAC-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || LPAD(NEXTVAL('tdpadmin.seq_invoice_number')::TEXT, 5, '0'),
  client_id UUID NOT NULL REFERENCES tdpadmin.clients(id) ON DELETE RESTRICT,
  project_id UUID REFERENCES tdpadmin.projects(id) ON DELETE SET NULL,
  quote_id UUID REFERENCES tdpadmin.quotes(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','issued','paid','cancelled','overdue')),
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  exchange_rate NUMERIC(14,4),
  issue_date DATE,
  due_date DATE,
  paid_at TIMESTAMPTZ,
  notes TEXT NOT NULL DEFAULT '',
  terms TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES tdpadmin.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tdp_invoices_client ON tdpadmin.invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_tdp_invoices_status ON tdpadmin.invoices(status);
CREATE INDEX IF NOT EXISTS idx_tdp_invoices_number ON tdpadmin.invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_tdp_invoices_created ON tdpadmin.invoices(created_at DESC);

DROP TRIGGER IF EXISTS trg_tdp_invoices_updated_at ON tdpadmin.invoices;
CREATE TRIGGER trg_tdp_invoices_updated_at BEFORE UPDATE ON tdpadmin.invoices
  FOR EACH ROW EXECUTE FUNCTION tdpadmin.set_updated_at();

-- Invoice items
CREATE TABLE IF NOT EXISTS tdpadmin.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES tdpadmin.invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL DEFAULT '',
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tdp_invoice_items_invoice ON tdpadmin.invoice_items(invoice_id);
