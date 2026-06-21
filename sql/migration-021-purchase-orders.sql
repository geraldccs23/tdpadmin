-- Migration 021: Órdenes de Compra
-- PostgreSQL 17 — idempotente
-- =============================================================================

-- Secuencia para número de orden
CREATE SEQUENCE IF NOT EXISTS public.seq_purchase_order_number START 1;

CREATE OR REPLACE FUNCTION public.generate_purchase_order_number()
RETURNS TEXT AS $$
DECLARE
  seq_num TEXT;
BEGIN
  seq_num := LPAD(nextval('public.seq_purchase_order_number')::TEXT, 6, '0');
  RETURN 'OC-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || seq_num;
END;
$$ LANGUAGE plpgsql;

-- Órdenes de compra
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL DEFAULT generate_purchase_order_number(),
  supplier_id UUID REFERENCES public.purchase_suppliers(id) ON DELETE SET NULL,
  warehouse_id UUID REFERENCES public.company_warehouses(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','partial','received','cancelled')),
  approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending','approved','rejected')),
  expected_date DATE,
  subtotal NUMERIC(14,4) NOT NULL DEFAULT 0,
  tax NUMERIC(14,4) NOT NULL DEFAULT 0,
  total NUMERIC(14,4) NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_po_status ON public.purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_po_approval ON public.purchase_orders(approval_status);
CREATE INDEX IF NOT EXISTS idx_po_supplier ON public.purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_created ON public.purchase_orders(created_at DESC);

-- Líneas de orden de compra
CREATE TABLE IF NOT EXISTS public.purchase_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('ingredient','inventory_product')),
  item_id UUID NOT NULL,
  item_name TEXT NOT NULL DEFAULT '',
  quantity_ordered NUMERIC(14,4) NOT NULL,
  quantity_received NUMERIC(14,4) NOT NULL DEFAULT 0,
  unit_cost NUMERIC(14,4) NOT NULL,
  total_line NUMERIC(14,4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pol_order ON public.purchase_order_lines(order_id);
