-- ============================================================================
-- restaurantdp — PostgreSQL 17 Init Script
-- Ejecutar en DB vacía: psql -h postgres -U tdp_admin -d tdp_main -f init.sql
-- Orden: extensiones → compat auth → schema-final → migrations
-- ============================================================================

-- 1. Extensiones
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Capa de compatibilidad para schema-final.sql (originario de Supabase)
--    Provee auth.users, auth.uid(), auth.jwt() para que no fallen las FK ni RLS
CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY,
  email TEXT,
  raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000001', 'admin@restaurantdp.local')
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID
  LANGUAGE SQL STABLE AS $$ SELECT '00000000-0000-0000-0000-000000000001'::uuid; $$;

CREATE OR REPLACE FUNCTION auth.jwt() RETURNS JSONB
  LANGUAGE SQL STABLE AS $$ SELECT jsonb_build_object('role', 'authenticated', 'email', 'admin@restaurantdp.local'); $$;

-- 3. Schema completo (tablas existentes del ERP)
\i schema-final.sql

-- 4. Migraciones incrementales pre-restaurant
\i migration-006-transfer-drafts.sql
\i migration-007-physical-inventory.sql
\i migration-008-inventory-dashboard.sql
\i migration-009-costo-productos.sql

-- 5. Migración: remover Supabase auth, crear tabla users propia
\i migration-011-remove-supabase.sql

-- 6. Migración: esquema de restaurante
\i migration-010-restaurant-schema.sql
