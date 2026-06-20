-- Migration 011: Eliminar dependencia de Supabase auth
-- Ejecutar DESPUÉS de schema-final.sql
-- Reemplaza auth.users por tabla public.users + adapta api_tokens

-- 1. Tabla de usuarios propia (reemplaza auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'cajero' CHECK (role IN ('director', 'supervisor', 'supervisor_ventas', 'supervisor_compras', 'administrador', 'cajero', 'vendedor', 'compras', 'soporte', 'delivery', 'supervisor_almacen', 'almacenista', 'admin', 'cocina')),
  branch TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  password_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Seed: admin por defecto (password: change_me)
INSERT INTO public.users (email, name, role, password_hash)
VALUES ('admin@restaurantdp.local', 'Admin', 'admin',
  '$2b$10$cT6VEbY1kUCtjDCMbiT7hOjjmlHnfdsct4MKgpB/HsEKODGtmgWo2'
)
ON CONFLICT (email) DO NOTHING;

-- 3. Recrear api_tokens sin FK a auth.users
DROP TABLE IF EXISTS public.api_tokens CASCADE;
CREATE TABLE public.api_tokens (
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

-- 4. Remover publicaciones Supabase Realtime
DROP PUBLICATION IF EXISTS supabase_realtime;

-- 5. Limpiar RLS policies que usan auth.* (opcional — se migrarán después)
--    Se mantienen las tablas, se desactiva RLS para MVP
ALTER TABLE IF EXISTS public.api_tokens DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.support_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.support_tickets DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cashier_closings DISABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
