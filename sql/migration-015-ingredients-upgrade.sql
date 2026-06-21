-- Migration 015: Ingredientes — código y categoría
ALTER TABLE public.restaurant_ingredients ADD COLUMN IF NOT EXISTS code TEXT NOT NULL DEFAULT '';
ALTER TABLE public.restaurant_ingredients ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_ingredients_code ON public.restaurant_ingredients(code);
CREATE INDEX IF NOT EXISTS idx_ingredients_category ON public.restaurant_ingredients(category);
