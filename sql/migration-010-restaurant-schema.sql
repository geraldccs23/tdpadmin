-- Migration 010: Esquema de Restaurante
-- Ejecutar en Supabase Studio → SQL Editor

-- 1. Categorías de menú
CREATE TABLE IF NOT EXISTS public.restaurant_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.restaurant_categories ENABLE ROW LEVEL SECURITY;

-- 2. Items del menú (platillos)
CREATE TABLE IF NOT EXISTS public.restaurant_menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.restaurant_categories(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  cost NUMERIC(10,2),
  recipe_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
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
ALTER TABLE public.restaurant_menu_items ENABLE ROW LEVEL SECURITY;

-- 3. Mesas
CREATE TABLE IF NOT EXISTS public.restaurant_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_number INT NOT NULL,
  capacity INT NOT NULL DEFAULT 4,
  location TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tables_number ON public.restaurant_tables(table_number);
ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;

-- 4. Pedidos
CREATE TYPE IF NOT EXISTS public.order_type AS ENUM ('dine_in', 'takeaway', 'delivery');
CREATE TYPE IF NOT EXISTS public.order_status AS ENUM ('pending', 'preparing', 'ready', 'served', 'paid', 'cancelled');

CREATE TABLE IF NOT EXISTS public.restaurant_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number INT NOT NULL,
  table_id UUID REFERENCES public.restaurant_tables(id) ON DELETE SET NULL,
  customer_name TEXT,
  order_type order_type NOT NULL DEFAULT 'dine_in',
  status order_status NOT NULL DEFAULT 'pending',
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON public.restaurant_orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_table ON public.restaurant_orders(table_id);
CREATE INDEX IF NOT EXISTS idx_orders_created ON public.restaurant_orders(created_at DESC);
ALTER TABLE public.restaurant_orders ENABLE ROW LEVEL SECURITY;

-- 5. Líneas de pedido
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
ALTER TABLE public.restaurant_order_items ENABLE ROW LEVEL SECURITY;

-- 6. Pagos
CREATE TYPE IF NOT EXISTS public.payment_method AS ENUM ('cash', 'card', 'transfer', 'other');

CREATE TABLE IF NOT EXISTS public.restaurant_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.restaurant_orders(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  method payment_method NOT NULL DEFAULT 'cash',
  reference TEXT,
  processed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_order ON public.restaurant_payments(order_id);
ALTER TABLE public.restaurant_payments ENABLE ROW LEVEL SECURITY;

-- 7. Secuencia de número de pedido
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

-- 8. Autopartición: created_at / updated_at
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

CREATE TRIGGER trg_restaurant_tables_updated_at
  BEFORE UPDATE ON public.restaurant_tables
  FOR EACH ROW EXECUTE FUNCTION public.set_restaurant_updated_at();

CREATE TRIGGER trg_restaurant_orders_updated_at
  BEFORE UPDATE ON public.restaurant_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_restaurant_updated_at();

CREATE TRIGGER trg_restaurant_order_items_updated_at
  BEFORE UPDATE ON public.restaurant_order_items
  FOR EACH ROW EXECUTE FUNCTION public.set_restaurant_updated_at();

NOTIFY pgrst, 'reload schema';
