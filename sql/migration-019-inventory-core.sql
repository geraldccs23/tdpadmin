-- Migration 019: Inventario — Movimientos base
-- PostgreSQL 17 — idempotente
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type TEXT NOT NULL CHECK (item_type IN ('ingredient', 'inventory_product')),
  item_id UUID NOT NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN (
    'compra', 'venta', 'ajuste_positivo', 'ajuste_negativo',
    'transferencia_entrada', 'transferencia_salida',
    'merma', 'vencimiento', 'devolucion'
  )),
  quantity NUMERIC(14,4) NOT NULL,
  unit_cost NUMERIC(14,4),
  total_cost NUMERIC(14,4),
  reference_type TEXT,
  reference_id TEXT,
  warehouse_id UUID REFERENCES public.company_warehouses(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inv_mov_item ON public.inventory_movements(item_type, item_id);
CREATE INDEX IF NOT EXISTS idx_inv_mov_date ON public.inventory_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inv_mov_type ON public.inventory_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_inv_mov_warehouse ON public.inventory_movements(warehouse_id);
