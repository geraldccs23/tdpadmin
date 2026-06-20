-- Migration 010: Esquema de Restaurante
-- PostgreSQL 17 — idempotente, sin dependencias externas
-- Correr: psql -h postgres -U tdp_admin -d tdp_main -f migration-010-restaurant-schema.sql

-- =============================================================================
-- Enums (PostgreSQL no soporta CREATE TYPE IF NOT EXISTS)
-- =============================================================================
DO $$ BEGIN CREATE TYPE public.order_type AS ENUM ('dine_in', 'takeaway', 'delivery');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE public.order_status AS ENUM ('pending', 'preparing', 'ready', 'served', 'paid', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE public.payment_method AS ENUM ('cash', 'card', 'transfer', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- Tablas base (autocontenidas, sin FK a esquemas externos)
-- =============================================================================

-- 1. Categorías del menú
CREATE TABLE IF NOT EXISTS public.restaurant_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Ingredientes (inventario de cocina)
CREATE TABLE IF NOT EXISTS public.restaurant_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'unidad',
  stock NUMERIC(12,2) NOT NULL DEFAULT 0,
  min_stock NUMERIC(12,2) NOT NULL DEFAULT 0,
  cost NUMERIC(10,2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Recetas (cabecera)
CREATE TABLE IF NOT EXISTS public.restaurant_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  instructions TEXT,
  yield_qty NUMERIC(10,2) NOT NULL DEFAULT 1,
  yield_unit TEXT NOT NULL DEFAULT 'porción',
  cost NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Ingredientes por receta
CREATE TABLE IF NOT EXISTS public.restaurant_recipe_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES public.restaurant_recipes(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES public.restaurant_ingredients(id) ON DELETE RESTRICT,
  quantity NUMERIC(12,4) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'unidad',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recipe_items_recipe ON public.restaurant_recipe_items(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_items_ingredient ON public.restaurant_recipe_items(ingredient_id);

-- 5. Items del menú (platillos)
CREATE TABLE IF NOT EXISTS public.restaurant_menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.restaurant_categories(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  cost NUMERIC(10,2),
  recipe_id UUID REFERENCES public.restaurant_recipes(id) ON DELETE SET NULL,
  image_url TEXT,
  is_available BOOLEAN NOT NULL DEFAULT true,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  preparation_time_min INT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_menu_items_category ON public.restaurant_menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_available ON public.restaurant_menu_items(is_available);

-- 6. Pedidos
CREATE TABLE IF NOT EXISTS public.restaurant_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number INT NOT NULL,
  customer_name TEXT,
  order_type order_type NOT NULL DEFAULT 'dine_in',
  status order_status NOT NULL DEFAULT 'pending',
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON public.restaurant_orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON public.restaurant_orders(created_at DESC);

-- 7. Líneas de pedido
CREATE TABLE IF NOT EXISTS public.restaurant_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.restaurant_orders(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES public.restaurant_menu_items(id) ON DELETE RESTRICT,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  status order_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.restaurant_order_items(order_id);

-- 8. Pagos
CREATE TABLE IF NOT EXISTS public.restaurant_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.restaurant_orders(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  method payment_method NOT NULL DEFAULT 'cash',
  reference TEXT,
  processed_by TEXT,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_order ON public.restaurant_payments(order_id);

-- =============================================================================
-- Secuencia + Triggers
-- =============================================================================
CREATE SEQUENCE IF NOT EXISTS public.restaurant_order_number_seq START 1;

CREATE OR REPLACE FUNCTION public.assign_order_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.order_number := nextval('public.restaurant_order_number_seq');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_assign_order_number ON public.restaurant_orders;
CREATE TRIGGER trg_assign_order_number
BEFORE INSERT ON public.restaurant_orders
FOR EACH ROW
EXECUTE FUNCTION public.assign_order_number();

-- updated_at automático
CREATE OR REPLACE FUNCTION public.set_restaurant_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_restaurant_categories_updated_at
  BEFORE UPDATE ON public.restaurant_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_restaurant_updated_at();

CREATE TRIGGER trg_restaurant_menu_items_updated_at
  BEFORE UPDATE ON public.restaurant_menu_items
  FOR EACH ROW EXECUTE FUNCTION public.set_restaurant_updated_at();

CREATE TRIGGER trg_restaurant_ingredients_updated_at
  BEFORE UPDATE ON public.restaurant_ingredients
  FOR EACH ROW EXECUTE FUNCTION public.set_restaurant_updated_at();

CREATE TRIGGER trg_restaurant_recipes_updated_at
  BEFORE UPDATE ON public.restaurant_recipes
  FOR EACH ROW EXECUTE FUNCTION public.set_restaurant_updated_at();

CREATE TRIGGER trg_restaurant_orders_updated_at
  BEFORE UPDATE ON public.restaurant_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_restaurant_updated_at();

CREATE TRIGGER trg_restaurant_order_items_updated_at
  BEFORE UPDATE ON public.restaurant_order_items
  FOR EACH ROW EXECUTE FUNCTION public.set_restaurant_updated_at();

-- =============================================================================
-- Seed data
-- =============================================================================
INSERT INTO public.restaurant_categories (name, description, sort_order) VALUES
  ('Entradas', 'Entradas y aperitivos', 1),
  ('Principales', 'Platos principales', 2),
  ('Bebidas', 'Bebidas y refrescos', 3),
  ('Postres', 'Postres y dulces', 4)
ON CONFLICT DO NOTHING;

INSERT INTO public.restaurant_menu_items (category_id, name, description, price, sort_order)
SELECT c.id, 'Plato de prueba', 'Descripción del plato demo', 10.00, 1
FROM public.restaurant_categories c
WHERE c.name = 'Principales'
  AND NOT EXISTS (SELECT 1 FROM public.restaurant_menu_items WHERE name = 'Plato de prueba');

INSERT INTO public.restaurant_ingredients (name, unit, stock, min_stock) VALUES
  ('Agua', 'litro', 10, 2),
  ('Sal', 'kg', 5, 1),
  ('Aceite', 'litro', 8, 2)
ON CONFLICT DO NOTHING;

INSERT INTO public.restaurant_recipes (name, description, instructions) VALUES
  ('Receta base', 'Receta demo', 'Instrucciones de preparación')
ON CONFLICT DO NOTHING;

-- NOTIFY solo si existe el canal (Supabase opcional)
DO $$ BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
