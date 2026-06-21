-- Migration 016: Recetas — ampliar columnas
ALTER TABLE public.restaurant_recipes ADD COLUMN IF NOT EXISTS code TEXT NOT NULL DEFAULT '';
ALTER TABLE public.restaurant_recipes ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT '';
ALTER TABLE public.restaurant_recipes ADD COLUMN IF NOT EXISTS preparation_time_minutes INT;
ALTER TABLE public.restaurant_recipes ADD COLUMN IF NOT EXISTS portions INT NOT NULL DEFAULT 1;
ALTER TABLE public.restaurant_recipes ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.restaurant_recipe_items ADD COLUMN IF NOT EXISTS cost_snapshot NUMERIC(12,4);
CREATE INDEX IF NOT EXISTS idx_recipes_code ON public.restaurant_recipes(code);
CREATE INDEX IF NOT EXISTS idx_recipes_category ON public.restaurant_recipes(category);
