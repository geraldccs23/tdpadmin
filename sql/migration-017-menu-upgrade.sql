-- Migration 017: Menú — columnas adicionales
ALTER TABLE public.restaurant_menu_items ADD COLUMN IF NOT EXISTS code TEXT NOT NULL DEFAULT '';
ALTER TABLE public.restaurant_menu_items ADD COLUMN IF NOT EXISTS margin_percent NUMERIC(5,2);
ALTER TABLE public.restaurant_menu_items ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.restaurant_menu_items ADD COLUMN IF NOT EXISTS display_order INT NOT NULL DEFAULT 0;
ALTER TABLE public.restaurant_categories ADD COLUMN IF NOT EXISTS display_order INT NOT NULL DEFAULT 0;
UPDATE public.restaurant_categories SET display_order = sort_order WHERE display_order = 0;
