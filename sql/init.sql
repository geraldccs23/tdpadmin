-- ============================================================================
-- restaurantdp — PostgreSQL 17 Init Script (standalone)
-- Ejecutar en DB vacía: psql -h postgres -U tdp_admin -d tdp_main -f init.sql
-- ============================================================================

-- 1. Extensiones
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Usuarios + auth
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'cajero' CHECK (role IN ('director','supervisor','supervisor_ventas','supervisor_compras','administrador','cajero','vendedor','compras','soporte','delivery','supervisor_almacen','almacenista','admin','cocina','manager','cashier','kitchen','waiter')),
  branch TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  password_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.users (email, name, role, password_hash)
VALUES ('admin@restaurantdp.local', 'Admin', 'admin', '$2b$10$cT6VEbY1kUCtjDCMbiT7hOjjmlHnfdsct4MKgpB/HsEKODGtmgWo2')
ON CONFLICT (email) DO NOTHING;

-- 3. API tokens
CREATE TABLE IF NOT EXISTS public.api_tokens (
  id BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  last_ip TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by TEXT,
  CONSTRAINT api_tokens_pkey PRIMARY KEY (id)
);

-- 4. Roles dinámicos
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  permissions JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.roles (name, label, description, permissions) VALUES
  ('admin', 'Administrador', 'Acceso total al sistema', '{"dashboard":{"view":true},"pos":{"view":true,"create":true,"refund":true},"orders":{"view":true,"create":true,"update":true,"cancel":true},"kitchen":{"view":true,"update":true},"menu":{"view":true,"create":true,"update":true,"delete":true},"inventory":{"view":true,"create":true,"update":true,"adjust":true},"recipes":{"view":true,"create":true,"update":true,"delete":true},"purchases":{"view":true,"create":true,"update":true},"reports":{"view":true},"users":{"view":true,"create":true,"update":true,"delete":true},"roles":{"view":true,"create":true,"update":true,"delete":true},"settings":{"view":true,"update":true},"support":{"view":true,"update":true}}'::jsonb),
  ('manager', 'Gerente', 'Gestión operativa del restaurante', '{"dashboard":{"view":true},"pos":{"view":true,"create":true,"refund":false},"orders":{"view":true,"create":true,"update":true,"cancel":true},"kitchen":{"view":true,"update":false},"menu":{"view":true,"create":true,"update":true,"delete":false},"inventory":{"view":true,"create":true,"update":true,"adjust":true},"recipes":{"view":true,"create":true,"update":true,"delete":false},"purchases":{"view":true,"create":true,"update":true},"reports":{"view":true},"users":{"view":true,"create":false,"update":false,"delete":false},"roles":{"view":false,"create":false,"update":false,"delete":false},"settings":{"view":true,"update":false},"support":{"view":true,"update":true}}'::jsonb),
  ('cashier', 'Cajero', 'Punto de venta y cobros', '{"dashboard":{"view":true},"pos":{"view":true,"create":true,"refund":false},"orders":{"view":true,"create":true,"update":false,"cancel":false},"kitchen":{"view":false,"update":false},"menu":{"view":true,"create":false,"update":false,"delete":false},"inventory":{"view":false,"create":false,"update":false,"adjust":false},"recipes":{"view":false,"create":false,"update":false,"delete":false},"purchases":{"view":false,"create":false,"update":false},"reports":{"view":true},"users":{"view":false,"create":false,"update":false,"delete":false},"roles":{"view":false,"create":false,"update":false,"delete":false},"settings":{"view":false,"update":false},"support":{"view":true,"update":false}}'::jsonb),
  ('kitchen', 'Cocina', 'Panel de cocina y órdenes', '{"dashboard":{"view":true},"pos":{"view":false,"create":false,"refund":false},"orders":{"view":true,"create":false,"update":false,"cancel":false},"kitchen":{"view":true,"update":true},"menu":{"view":true,"create":false,"update":false,"delete":false},"inventory":{"view":false,"create":false,"update":false,"adjust":false},"recipes":{"view":true,"create":false,"update":false,"delete":false},"purchases":{"view":false,"create":false,"update":false},"reports":{"view":false},"users":{"view":false,"create":false,"update":false,"delete":false},"roles":{"view":false,"create":false,"update":false,"delete":false},"settings":{"view":false,"update":false},"support":{"view":true,"update":false}}'::jsonb),
  ('waiter', 'Mesero', 'Toma de pedidos y servicio', '{"dashboard":{"view":true},"pos":{"view":true,"create":true,"refund":false},"orders":{"view":true,"create":true,"update":false,"cancel":false},"kitchen":{"view":false,"update":false},"menu":{"view":true,"create":false,"update":false,"delete":false},"inventory":{"view":false,"create":false,"update":false,"adjust":false},"recipes":{"view":false,"create":false,"update":false,"delete":false},"purchases":{"view":false,"create":false,"update":false},"reports":{"view":false},"users":{"view":false,"create":false,"update":false,"delete":false},"roles":{"view":false,"create":false,"update":false,"delete":false},"settings":{"view":false,"update":false},"support":{"view":true,"update":false}}'::jsonb),
  ('soporte', 'Soporte', 'Soporte técnico y configuración', '{"dashboard":{"view":true},"pos":{"view":false,"create":false,"refund":false},"orders":{"view":false,"create":false,"update":false,"cancel":false},"kitchen":{"view":false,"update":false},"menu":{"view":false,"create":false,"update":false,"delete":false},"inventory":{"view":false,"create":false,"update":false,"adjust":false},"recipes":{"view":false,"create":false,"update":false,"delete":false},"purchases":{"view":false,"create":false,"update":false},"reports":{"view":false},"users":{"view":true,"create":false,"update":false,"delete":false},"roles":{"view":false,"create":false,"update":false,"delete":false},"settings":{"view":true,"update":false},"support":{"view":true,"update":true}}'::jsonb)
ON CONFLICT (name) DO UPDATE SET permissions = EXCLUDED.permissions;

-- 5. Esquema de restaurante
-- (ejecutar desde la raíz del proyecto: psql -h postgres -U tdp_admin -d tdp_main -f sql/init.sql)
\i sql/migration-010-restaurant-schema.sql
