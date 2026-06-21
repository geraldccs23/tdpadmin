-- Migration 018: Productos inventariables + dualidad receta/producto en menú
-- =============================================================================

-- 1. Productos inventariables (comprados y vendidos directamente)
CREATE TABLE IF NOT EXISTS public.restaurant_inventory_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE,
  barcode TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  unit TEXT NOT NULL DEFAULT 'unidad',
  cost NUMERIC(14,4) NOT NULL DEFAULT 0,
  sale_price NUMERIC(14,4) NOT NULL DEFAULT 0,
  current_stock NUMERIC(14,4) NOT NULL DEFAULT 0,
  minimum_stock NUMERIC(14,4) NOT NULL DEFAULT 0,
  warehouse_id UUID REFERENCES public.company_warehouses(id) ON DELETE SET NULL,
  supplier_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inv_products_code ON public.restaurant_inventory_products(code);
CREATE INDEX IF NOT EXISTS idx_inv_products_barcode ON public.restaurant_inventory_products(barcode);
CREATE INDEX IF NOT EXISTS idx_inv_products_category ON public.restaurant_inventory_products(category);

-- 2. Modificar restaurant_menu_items para dualidad receta/producto
ALTER TABLE public.restaurant_menu_items ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT 'recipe'
  CHECK (item_type IN ('recipe', 'inventory_product'));
ALTER TABLE public.restaurant_menu_items ADD COLUMN IF NOT EXISTS inventory_product_id UUID
  REFERENCES public.restaurant_inventory_products(id) ON DELETE SET NULL;

-- Hacer recipe_id nullable explícitamente (ya lo es por CREATE, pero por si acaso)
ALTER TABLE public.restaurant_menu_items ALTER COLUMN recipe_id DROP NOT NULL;
