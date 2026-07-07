-- Seed datos demo para Restaurant TDP
-- Ejecutar: docker exec -i postgres psql -U tdp_lidel -d tdp_main < sql/seed-demo-restaurant.sql

-- Categorías
INSERT INTO public.restaurant_categories (name, description, sort_order) VALUES
  ('Entradas', 'Aperitivos y entradas', 1),
  ('Principales', 'Platos fuertes', 2),
  ('Bebidas', 'Bebidas y refrescos', 3),
  ('Postres', 'Postres y dulces', 4),
  ('Desayunos', 'Desayunos y brunch', 5)
ON CONFLICT DO NOTHING;

-- Ingredientes
INSERT INTO public.restaurant_ingredients (name, category, unit, cost, stock, min_stock) VALUES
  ('Harina de trigo', 'Secos', 'kg', 1.50, 25, 5),
  ('Huevos', 'Frescos', 'unidad', 0.20, 120, 30),
  ('Leche completa', 'Frescos', 'litro', 1.20, 15, 5),
  ('Azúcar', 'Secos', 'kg', 0.90, 20, 5),
  ('Mantequilla', 'Frescos', 'kg', 3.00, 8, 3),
  ('Carne de res', 'Carnes', 'kg', 8.00, 12, 3),
  ('Pollo', 'Carnes', 'kg', 4.50, 10, 3),
  ('Arroz', 'Secos', 'kg', 1.00, 30, 5),
  ('Frijoles negros', 'Secos', 'kg', 1.20, 15, 5),
  ('Queso mozzarella', 'Frescos', 'kg', 5.00, 5, 2),
  ('Pan de molde', 'Panadería', 'unidad', 1.50, 15, 5),
  ('Pasta', 'Secos', 'kg', 1.00, 20, 5),
  ('Aceite vegetal', 'Secos', 'litro', 2.50, 10, 3),
  ('Sal', 'Secos', 'kg', 0.50, 10, 2),
  ('Café', 'Secos', 'kg', 8.00, 5, 2)
ON CONFLICT DO NOTHING;

-- Recetas
INSERT INTO public.restaurant_recipes (name, category, description, preparation_time_minutes, portions, instructions) VALUES
  ('Arepas clásicas', 'Desayunos', 'Arepas tradicionales venezolanas', 20, 4, 'Mezclar harina con agua y sal. Amasar. Formar arepas. Cocinar 5 min cada lado.'),
  ('Pabellón criollo', 'Principales', 'Plato tradicional venezolano', 45, 4, 'Cocinar caraotas. Preparar arroz. Freír plátanos. Preparar carne mechada.'),
  ('Cachapas', 'Desayunos', 'Cachapas de jojoto con queso', 25, 4, 'Licuar granos de maíz. Cocinar en budare. Agregar queso. Doblar y servir.'),
  ('Tequeños', 'Entradas', 'Tequeños de queso', 30, 6, 'Cortar queso en tiras. Enrollar en masa. Freír en aceite caliente.'),
  ('Merengadas', 'Bebidas', 'Malteadas cremosas de frutas', 10, 2, 'Agregar leche, fruta y azúcar. Licuar hasta cremoso. Servir frío.')
ON CONFLICT DO NOTHING;

-- Items de menú
INSERT INTO public.restaurant_menu_items (category_id, recipe_id, name, description, price, cost, item_type, is_available, display_order)
SELECT c.id, r.id, 'Arepa Reina Pepiada', 'Arepa de maíz rellena de pollo y aguacate', 8.50, 2.50, 'recipe', true, 1
FROM public.restaurant_categories c, public.restaurant_recipes r
WHERE c.name = 'Desayunos' AND r.name = 'Arepas clásicas';

INSERT INTO public.restaurant_menu_items (category_id, recipe_id, name, description, price, cost, item_type, is_available, display_order)
SELECT c.id, r.id, 'Pabellón Criollo', 'Arroz, carne mechada, caraotas y plátano', 14.00, 5.00, 'recipe', true, 1
FROM public.restaurant_categories c, public.restaurant_recipes r
WHERE c.name = 'Principales' AND r.name = 'Pabellón criollo';

INSERT INTO public.restaurant_menu_items (category_id, recipe_id, name, description, price, cost, item_type, is_available, display_order)
SELECT c.id, r.id, 'Cachapa con Queso', 'Cachapa de maíz dulce con queso derretido', 9.00, 2.80, 'recipe', true, 2
FROM public.restaurant_categories c, public.restaurant_recipes r
WHERE c.name = 'Desayunos' AND r.name = 'Cachapas';

INSERT INTO public.restaurant_menu_items (category_id, recipe_id, name, description, price, cost, item_type, is_available, display_order)
SELECT c.id, r.id, 'Tequeños (6 uds)', 'Palitos de queso envueltos en masa frita', 6.50, 2.00, 'recipe', true, 1
FROM public.restaurant_categories c, public.restaurant_recipes r
WHERE c.name = 'Entradas' AND r.name = 'Tequeños';

INSERT INTO public.restaurant_menu_items (category_id, name, description, price, cost, item_type, is_available, display_order)
SELECT c.id, 'Agua Mineral 500ml', 'Agua mineral', 1.50, 0.50, 'recipe', true, 1
FROM public.restaurant_categories c WHERE c.name = 'Bebidas';

INSERT INTO public.restaurant_menu_items (category_id, name, description, price, cost, item_type, is_available, display_order)
SELECT c.id, 'Jugo Natural', 'Jugo de fruta natural del día', 3.50, 1.00, 'recipe', true, 2
FROM public.restaurant_categories c WHERE c.name = 'Bebidas';

INSERT INTO public.restaurant_menu_items (category_id, name, description, price, cost, item_type, is_available, display_order)
SELECT c.id, 'Café negro', 'Café venezolano recién colado', 2.00, 0.50, 'recipe', true, 3
FROM public.restaurant_categories c WHERE c.name = 'Bebidas';
