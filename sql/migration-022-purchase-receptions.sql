-- Migration 022: Recepciones de Mercancía
-- PostgreSQL 17 — idempotente
-- =============================================================================

-- Secuencia para número de recepción
CREATE SEQUENCE IF NOT EXISTS public.seq_reception_number START 1;

CREATE OR REPLACE FUNCTION public.generate_reception_number()
RETURNS TEXT AS $$
DECLARE
  seq_num TEXT;
BEGIN
  seq_num := LPAD(nextval('public.seq_reception_number')::TEXT, 6, '0');
  RETURN 'REC-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || seq_num;
END;
$$ LANGUAGE plpgsql;

-- Recepciones
CREATE TABLE IF NOT EXISTS public.purchase_receptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reception_number TEXT UNIQUE NOT NULL DEFAULT generate_reception_number(),
  order_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES public.purchase_suppliers(id) ON DELETE SET NULL,
  warehouse_id UUID REFERENCES public.company_warehouses(id) ON DELETE SET NULL,
  document_number TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  received_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_receptions_order ON public.purchase_receptions(order_id);
CREATE INDEX IF NOT EXISTS idx_receptions_supplier ON public.purchase_receptions(supplier_id);

-- Líneas de recepción
CREATE TABLE IF NOT EXISTS public.purchase_reception_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reception_id UUID NOT NULL REFERENCES public.purchase_receptions(id) ON DELETE CASCADE,
  order_line_id UUID REFERENCES public.purchase_order_lines(id) ON DELETE SET NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('ingredient','inventory_product')),
  item_id UUID NOT NULL,
  item_name TEXT NOT NULL DEFAULT '',
  quantity_received NUMERIC(14,4) NOT NULL,
  unit_cost NUMERIC(14,4) NOT NULL,
  total_line NUMERIC(14,4),
  movement_id UUID REFERENCES public.inventory_movements(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reception_lines_reception ON public.purchase_reception_lines(reception_id);
