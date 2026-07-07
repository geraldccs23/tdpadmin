-- =============================================================================
-- Seed datos demo para TDP Admin
-- Ejecutar: psql -h postgres -U tdp_lidel -d tdpadmin -f sql/seed-demo.sql
-- =============================================================================

-- 1. Usuario demo (password: demo123)
INSERT INTO tdpadmin.users (email, password_hash, full_name, role)
VALUES ('demo@tallerdepixeles.com', '$2b$10$cT6VEbY1kUCtjDCMbiT7hOjjmlHnfdsct4MKgpB/HsEKODGtmgWo2', 'Usuario Demo', 'director')
ON CONFLICT (email) DO NOTHING;

-- 2. Clientes demo
INSERT INTO tdpadmin.clients (name, email, phone, company_name, city, interest, kind, status, source, estimated_budget, notes, created_by)
SELECT * FROM (VALUES
  ('Carlos Mendoza', 'carlos@distribuidoramendoza.com', '0412-1234567', 'Distribuidora Mendoza CA', 'Caracas', 'sistema de gestion', 'client', 'active', 'referido', 8500, 'Requiere sistema completo con facturacion, inventario y compras.'),
  ('Maria Gutierrez', 'maria@pasteleria.com', '0414-7654321', 'Pasteleria Delicias CA', 'Caracas', 'ecommerce', 'prospect', 'qualified', 'instagram', 3500, 'Tienda online para venta de pasteles y postres.'),
  ('Jesus Rojas', 'jesus@autolujo.com', '0426-9876543', 'Autolujo Import CA', 'Valencia', 'pagina web', 'client', 'active', 'web', 2200, 'Pagina corporativa con catalogo de vehiculos.'),
  ('Ana Silva', 'ana@clinicadental.com', '0416-5554433', 'Clinica Dental Silva', 'Caracas', 'sistema de gestion', 'client', 'active', 'cliente_actual', 12000, 'Sistema de gestion de pacientes, historias clinicas y facturacion.'),
  ('Pedro Torres', 'pedro@techsolutions.com', '0412-1122334', 'Tech Solutions CA', 'Maracaibo', 'soporte', 'prospect', 'proposal_sent', 'referido', 1800, 'Soporte tecnico mensual para 15 equipos.'),
  ('Laura Jimenez', 'laura@eventos.com', '0414-8877665', 'Eventos y Fiestas LA', 'Caracas', 'automatizacion', 'prospect', 'lead', 'whatsapp', 4500, 'Automatizacion de reservas y cotizaciones.'),
  ('Roberto Diaz', 'roberto@constructora.com', '0424-3344556', 'Constructora Diaz Hermanos', 'Barquisimeto', 'sistema de gestion', 'client', 'won', 'referido', 15000, 'ERP completo para constructora. Proyecto facturado.')
) AS c(name, email, phone, company_name, city, interest, kind, status, source, estimated_budget, notes, created_by)
WHERE NOT EXISTS (SELECT 1 FROM tdpadmin.clients WHERE email = c.email);

-- 3. Presupuestos demo
INSERT INTO tdpadmin.quotes (quote_number, client_id, title, status, subtotal, discount, total, currency, notes, created_by)
SELECT * FROM (VALUES
  ('PRE-202607-00001', (SELECT id FROM tdpadmin.clients WHERE email = 'maria@pasteleria.com'), 'Tienda Online Pasteleria Delicias', 'sent', 3500, 350, 3150, 'USD', 'Incluye: diseño UI/UX, desarrollo frontend, panel administrador, pasarela de pago, hosting 1 año.', (SELECT id FROM tdpadmin.users WHERE email = 'demo@tallerdepixeles.com')),
  ('PRE-202607-00002', (SELECT id FROM tdpadmin.clients WHERE email = 'carlos@distribuidoramendoza.com'), 'Sistema de Gestion Distribuidora Mendoza', 'draft', 8500, 850, 7650, 'USD', 'Incluye: modulo de facturacion, inventario, compras, reportes, capacitacion del personal.', (SELECT id FROM tdpadmin.users WHERE email = 'demo@tallerdepixeles.com'))
) AS q(quote_number, client_id, title, status, subtotal, discount, total, currency, notes, created_by)
WHERE NOT EXISTS (SELECT 1 FROM tdpadmin.quotes WHERE quote_number = q.quote_number);

-- Items del presupuesto 1
INSERT INTO tdpadmin.quote_items (quote_id, item_type, description, quantity, unit_price, total_price, display_order)
SELECT q.id, 'service', d.description, d.quantity, d.unit_price, d.quantity * d.unit_price, d.display_order
FROM tdpadmin.quotes q
CROSS JOIN (VALUES
  ('Diseño UI/UX', 1, 800, 1),
  ('Desarrollo frontend', 1, 1200, 2),
  ('Panel administrador', 1, 800, 3),
  ('Pasarela de pago', 1, 300, 4),
  ('Hosting 1 año', 1, 250, 5),
  ('Capacitacion', 1, 150, 6)
) AS d(description, quantity, unit_price, display_order)
WHERE q.quote_number = 'PRE-202607-00001'
AND NOT EXISTS (SELECT 1 FROM tdpadmin.quote_items WHERE quote_id = q.id);

-- Items del presupuesto 2
INSERT INTO tdpadmin.quote_items (quote_id, item_type, description, quantity, unit_price, total_price, display_order)
SELECT q.id, 'service', d.description, d.quantity, d.unit_price, d.quantity * d.unit_price, d.display_order
FROM tdpadmin.quotes q
CROSS JOIN (VALUES
  ('Modulo de facturacion', 1, 2500, 1),
  ('Modulo de inventario', 1, 2000, 2),
  ('Modulo de compras', 1, 1500, 3),
  ('Modulo de reportes', 1, 1000, 4),
  ('Base de datos', 1, 500, 5),
  ('Capacitacion del personal', 1, 1000, 6)
) AS d(description, quantity, unit_price, display_order)
WHERE q.quote_number = 'PRE-202607-00002'
AND NOT EXISTS (SELECT 1 FROM tdpadmin.quote_items WHERE quote_id = q.id);
