-- Migration 007: Inventario Físico
-- Ejecutar en Supabase Studio → SQL Editor

-- 1. Sesiones de inventario físico
CREATE TABLE IF NOT EXISTS public.physical_inventory (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  branch text NOT NULL,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'completed')),
  created_by text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT physical_inventory_pkey PRIMARY KEY (id)
);

ALTER TABLE public.physical_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "physical_inventory_all" ON public.physical_inventory
  FOR ALL USING (true);

-- 2. Líneas de inventario físico
CREATE TABLE IF NOT EXISTS public.physical_inventory_lines (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  inventory_id bigint NOT NULL REFERENCES physical_inventory(id) ON DELETE CASCADE,
  codigo_producto text NOT NULL REFERENCES products(codigo_producto),
  descripcion text,
  sistema_qty numeric NOT NULL DEFAULT 0,
  fisico_qty numeric,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT physical_inventory_lines_pkey PRIMARY KEY (id),
  CONSTRAINT pil_unique UNIQUE (inventory_id, codigo_producto)
);

ALTER TABLE public.physical_inventory_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "physical_inventory_lines_all" ON public.physical_inventory_lines
  FOR ALL USING (true);

-- 3. Vista sugerencias (no contados en últimos 7 días)
CREATE OR REPLACE VIEW public.vw_physical_inventory_suggestions AS
SELECT p.codigo_producto, p.descripcion, p.stock_boleita, p.stock_sabana_grande,
       MAX(pi.completed_at) as last_counted_at
FROM products p
LEFT JOIN physical_inventory_lines pil ON pil.codigo_producto = p.codigo_producto
LEFT JOIN physical_inventory pi ON pi.id = pil.inventory_id AND pi.status = 'completed'
GROUP BY p.codigo_producto, p.descripcion, p.stock_boleita, p.stock_sabana_grande
HAVING MAX(pi.completed_at) IS NULL 
    OR MAX(pi.completed_at) < NOW() - INTERVAL '7 days';

NOTIFY pgrst, 'reload schema';
