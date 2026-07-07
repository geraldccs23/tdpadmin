-- Seed datos demo para Restaurant TDP
-- Ejecutar contra tdp_main (donde están las tablas public.restaurant_*)
-- psql -h postgres -U tdp_lidel -d tdp_main -f sql/seed-demo-restaurant.sql

-- =============================================================================
-- Categorías
-- =============================================================================
INSERT INTO public.restaurant_categories (name, description, sort_order) VALUES
  ('Entradas', 'Aperitivos y entradas', 1),
  ('Principales', 'Platos fuertes', 2),
  ('Bebidas', 'Bebidas y refrescos', 3),
  ('Postres', 'Postres y dulces', 4),
  ('Desayunos', 'Desayunos y brunch', 5)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- Ingredientes
-- =============================================================================
INSERT INTO public.restaurant_ingredients (code, name, category, unit, cost, stock, min_stock, is_active) VALUES
  ('HAR001', 'Harina de trigo', 'Secos', 'kg', 1.50, 25, 5, true),
  ('HUE001', 'Huevos', 'Frescos', 'unidad', 0.20, 120, 30, true),
  ('LEC001', 'Leche completa', 'Frescos', 'litro', 1.20, 15, 5, true),
  ('AZU001', 'Azúcar', 'Secos', 'kg', 0.90, 20, 5, true),
  ('MAN001', 'Mantequilla', 'Frescos', 'kg', 3.00, 8, 3, true),
  ('CAR001', 'Carne de res', 'Carnes', 'kg', 8.00, 12, 3, true),
  ('POL001', 'Pollo', 'Carnes', 'kg', 4.50, 10, 3, true),
  ('PES001', 'Pescado fresco', 'Carnes', 'kg', 6.00, 6, 2, true),
  ('ARR001', 'Arroz', 'Secos', 'kg', 1.00, 30, 5, true),
  ('FRI001', 'Frijoles negros', 'Secos', 'kg', 1.20, 15, 5, true),
  ('TOM001', 'Tomate', 'Frescos', 'kg', 1.80, 10, 3, true),
  ('CEB001', 'Cebolla', 'Frescos', 'kg', 0.80, 12, 3, true),
  ('AJI001', 'Ají dulce', 'Frescos', 'kg', 2.00, 5, 2, true),
  ('PIM001', 'Pimentón', 'Frescos', 'kg', 1.50, 8, 2, true),
  ('QUE001', 'Queso mozzarella', 'Frescos', 'kg', 5.00, 5, 2, true),
  ('PAN001', 'Pan de molde', 'Panadería', 'unidad', 1.50, 15, 5, true),
  ('PAS001', 'Pasta', 'Secos', 'kg', 1.00, 20, 5, true),
  ('ACE001', 'Aceite vegetal', 'Secos', 'litro', 2.50, 10, 3, true),
  ('SAL001', 'Sal', 'Secos', 'kg', 0.50, 10, 2, true),
  ('CAF001', 'Café', 'Secos', 'kg', 8.00, 5, 2, true)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- Recetas
-- =============================================================================
INSERT INTO public.restaurant_recipes (code, name, category, description, preparation_time_minutes, portions, instructions, is_active) VALUES
  ('RCP-ARE', 'Arepas clásicas', 'Desayunos', 'Arepas tradicionales venezolanas', 20, 4, '1. Mezclar harina con agua y sal. 2. Amasar hasta consistencia suave. 3. Formar arepas. 4. Cocinar en budare 5 min cada lado.', true),
  ('RCP-PAB', 'Pabellón criollo', 'Principales', 'Plato tradicional venezolano', 45, 4, '1. Cocinar caraotas negras con aliño. 2. Preparar arroz blanco. 3. Freír plátanos maduros. 4. Preparar carne mechada deshebrada.', true),
  ('RCP-CAC', 'Cachapas', 'Desayunos', 'Cachapas de jojoto con queso', 25, 4, '1. Licuar granos de maíz. 2. Cocinar en budare. 3. Agregar queso mozzarella. 4. Doblar y servir caliente.', true),
  ('RCP-TEQ', 'Tequeños', 'Entradas', 'Tequeños de queso', 30, 6, '1. Cortar queso en tiras. 2. Preparar masa. 3. Enrollar el queso en la masa. 4. Freír en aceite caliente.', true),
  ('RCP-MER', 'Merengadas', 'Bebidas', 'Malteadas cremosas de frutas', 10, 2, '1. Agregar leche, fruta y azúcar a la licuadora. 2. Licuar hasta cremoso. 3. Servir frío.', true)
ON CONFLICT DO NOTHING;

-- Items de recetas
INSERT INTO public.restaurant_recipe_items (recipe_id, ingredient_id, quantity, unit)
SELECT r.id, i.id, 0.5, 'kg'
FROM public.restaurant_recipes r, public.restaurant_ingredients i
WHERE r.code = 'RCP-ARE' AND i.code = 'HAR001'
AND NOT EXISTS (SELECT 1 FROM public.restaurant_recipe_items WHERE recipe_id = r.id);

INSERT INTO public.restaurant_recipe_items (recipe_id, ingredient_id, quantity, unit)
SELECT r.id, i.id, 2, 'unidad'
FROM public.restaurant_recipes r, public.restaurant_ingredients i
WHERE r.code = 'RCP-ARE' AND i.code = 'HUE001'
AND NOT EXISTS (SELECT 1 FROM public.restaurant_recipe_items WHERE recipe_id = r.id AND ingredient_id = i.id);

INSERT INTO public.restaurant_recipe_items (recipe_id, ingredient_id, quantity, unit)
SELECT r.id, i.id, 1, 'kg'
FROM public.restaurant_recipes r, public.restaurant_ingredients i
WHERE r.code = 'RCP-PAB' AND i.code = 'ARR001'
AND NOT EXISTS (SELECT 1 FROM public.restaurant_recipe_items WHERE recipe_id = r.id AND ingredient_id = i.id);

INSERT INTO public.restaurant_recipe_items (recipe_id, ingredient_id, quantity, unit)
SELECT r.id, i.id, 0.5, 'kg'
FROM public.restaurant_recipes r, public.restaurant_ingredients i
WHERE r.code = 'RCP-PAB' AND i.code = 'FRI001'
AND NOT EXISTS (SELECT 1 FROM public.restaurant_recipe_items WHERE recipe_id = r.id AND ingredient_id = i.id);

INSERT INTO public.restaurant_recipe_items (recipe_id, ingredient_id, quantity, unit)
SELECT r.id, i.id, 0.5, 'kg'
FROM public.restaurant_recipes r, public.restaurant_ingredients i
WHERE r.code = 'RCP-CAC' AND i.code = 'QUE001'
AND NOT EXISTS (SELECT 1 FROM public.restaurant_recipe_items WHERE recipe_id = r.id AND ingredient_id = i.id);

INSERT INTO public.restaurant_recipe_items (recipe_id, ingredient_id, quantity, unit)
SELECT r.id, i.id, 0.25, 'kg'
FROM public.restaurant_recipes r, public.restaurant_ingredients i
WHERE r.code = 'RCP-TEQ' AND i.code = 'QUE001'
AND NOT EXISTS (SELECT 1 FROM public.restaurant_recipe_items WHERE recipe_id = r.id AND ingredient_id = i.id);

INSERT INTO public.restaurant_recipe_items (recipe_id, ingredient_id, quantity, unit)
SELECT r.id, i.id, 1, 'litro'
FROM public.restaurant_recipes r, public.restaurant_ingredients i
WHERE r.code = 'RCP-MER' AND i.code = 'LEC001'
AND NOT EXISTS (SELECT 1 FROM public.restaurant_recipe_items WHERE recipe_id = r.id AND ingredient_id = i.id);

-- =============================================================================
-- Items del menú
-- =============================================================================
INSERT INTO public.restaurant_menu_items (category_id, recipe_id, code, name, description, price, cost, item_type, is_available, display_order)
SELECT c.id, r.id, 'PLA-001', 'Arepa Reina Pepiada', 'Arepa de maíz rellena de pollo, aguacate y mayonesa', 8.50, 2.50, 'recipe', true, 1
FROM public.restaurant_categories c, public.restaurant_recipes r
WHERE c.name = 'Desayunos' AND r.code = 'RCP-ARE'
AND NOT EXISTS (SELECT 1 FROM public.restaurant_menu_items WHERE code = 'PLA-001');

INSERT INTO public.restaurant_menu_items (category_id, recipe_id, code, name, description, price, cost, item_type, is_available, display_order)
SELECT c.id, r.id, 'PLA-002', 'Pabellón Criollo', 'Arroz blanco, carne mechada, caraotas negras y plátano maduro', 14.00, 5.00, 'recipe', true, 1
FROM public.restaurant_categories c, public.restaurant_recipes r
WHERE c.name = 'Principales' AND r.code = 'RCP-PAB'
AND NOT EXISTS (SELECT 1 FROM public.restaurant_menu_items WHERE code = 'PLA-002');

INSERT INTO public.restaurant_menu_items (category_id, recipe_id, code, name, description, price, cost, item_type, is_available, display_order)
SELECT c.id, r.id, 'PLA-003', 'Cachapa con Queso', 'Cachapa de maíz dulce con queso mozzarella derretido', 9.00, 2.80, 'recipe', true, 2
FROM public.restaurant_categories c, public.restaurant_recipes r
WHERE c.name = 'Desayunos' AND r.code = 'RCP-CAC'
AND NOT EXISTS (SELECT 1 FROM public.restaurant_menu_items WHERE code = 'PLA-003');

INSERT INTO public.restaurant_menu_items (category_id, recipe_id, code, name, description, price, cost, item_type, is_available, display_order)
SELECT c.id, r.id, 'PLA-004', 'Tequeños (6 u.)', 'Palitos de queso envueltos en masa frita', 6.50, 2.00, 'recipe', true, 1
FROM public.restaurant_categories c, public.restaurant_recipes r
WHERE c.name = 'Entradas' AND r.code = 'RCP-TEQ'
AND NOT EXISTS (SELECT 1 FROM public.restaurant_menu_items WHERE code = 'PLA-004');

INSERT INTO public.restaurant_menu_items (category_id, code, name, description, price, cost, item_type, is_available, display_order)
SELECT c.id, 'BEB-001', 'Agua Mineral', 'Agua mineral 500ml', 1.50, 0.50, 'inventory_product', true, 1
FROM public.restaurant_categories c WHERE c.name = 'Bebidas'
AND NOT EXISTS (SELECT 1 FROM public.restaurant_menu_items WHERE code = 'BEB-001');

INSERT INTO public.restaurant_menu_items (category_id, code, name, description, price, cost, item_type, is_available, display_order)
SELECT c.id, 'BEB-002', 'Jugo Natural', 'Jugo de fruta natural del día', 3.50, 1.00, 'inventory_product', true, 2
FROM public.restaurant_categories c WHERE c.name = 'Bebidas'
AND NOT EXISTS (SELECT 1 FROM public.restaurant_menu_items WHERE code = 'BEB-002');

INSERT INTO public.restaurant_menu_items (category_id, code, name, description, price, cost, item_type, is_available, display_order)
SELECT c.id, 'BEB-003', 'Café negro', 'Café venezolano recién colado', 2.00, 0.50, 'recipe', true, 3
FROM public.restaurant_categories c WHERE c.name = 'Bebidas'
AND NOT EXISTS (SELECT 1 FROM public.restaurant_menu_items WHERE code = 'BEB-003');
