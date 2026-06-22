-- Migration 001: TDP Admin — Core Schema
-- PostgreSQL 17 — idempotente, sin Supabase
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS tdpadmin;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- Función updated_at
-- =============================================================================
CREATE OR REPLACE FUNCTION tdpadmin.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Usuarios
-- =============================================================================
CREATE TABLE IF NOT EXISTS tdpadmin.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('superadmin','admin','sales','support','finance','staff')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','suspended')),
  avatar_url TEXT NOT NULL DEFAULT '',
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tdp_users_email ON tdpadmin.users(email);
CREATE INDEX IF NOT EXISTS idx_tdp_users_role ON tdpadmin.users(role);
CREATE INDEX IF NOT EXISTS idx_tdp_users_status ON tdpadmin.users(status);

DROP TRIGGER IF EXISTS trg_tdp_users_updated_at ON tdpadmin.users;
CREATE TRIGGER trg_tdp_users_updated_at BEFORE UPDATE ON tdpadmin.users
  FOR EACH ROW EXECUTE FUNCTION tdpadmin.set_updated_at();

-- =============================================================================
-- Empresas / Organizaciones
-- =============================================================================
CREATE TABLE IF NOT EXISTS tdpadmin.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  trade_name TEXT NOT NULL DEFAULT '',
  rif TEXT UNIQUE,
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  logo_url TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES tdpadmin.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_tdp_companies_updated_at ON tdpadmin.companies;
CREATE TRIGGER trg_tdp_companies_updated_at BEFORE UPDATE ON tdpadmin.companies
  FOR EACH ROW EXECUTE FUNCTION tdpadmin.set_updated_at();

-- =============================================================================
-- Clientes
-- =============================================================================
CREATE TABLE IF NOT EXISTS tdpadmin.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES tdpadmin.companies(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  document_id TEXT,
  address TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','lead','lost')),
  notes TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES tdpadmin.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tdp_clients_status ON tdpadmin.clients(status);
CREATE INDEX IF NOT EXISTS idx_tdp_clients_email ON tdpadmin.clients(email);
CREATE INDEX IF NOT EXISTS idx_tdp_clients_phone ON tdpadmin.clients(phone);

DROP TRIGGER IF EXISTS trg_tdp_clients_updated_at ON tdpadmin.clients;
CREATE TRIGGER trg_tdp_clients_updated_at BEFORE UPDATE ON tdpadmin.clients
  FOR EACH ROW EXECUTE FUNCTION tdpadmin.set_updated_at();

-- =============================================================================
-- Proyectos
-- =============================================================================
CREATE TABLE IF NOT EXISTS tdpadmin.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES tdpadmin.companies(id) ON DELETE SET NULL,
  client_id UUID REFERENCES tdpadmin.clients(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','completed','cancelled')),
  start_date DATE,
  end_date DATE,
  budget NUMERIC(14,2),
  owner_id UUID REFERENCES tdpadmin.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES tdpadmin.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tdp_projects_status ON tdpadmin.projects(status);

DROP TRIGGER IF EXISTS trg_tdp_projects_updated_at ON tdpadmin.projects;
CREATE TRIGGER trg_tdp_projects_updated_at BEFORE UPDATE ON tdpadmin.projects
  FOR EACH ROW EXECUTE FUNCTION tdpadmin.set_updated_at();

-- =============================================================================
-- Cotizaciones / Presupuestos
-- =============================================================================
CREATE SEQUENCE IF NOT EXISTS tdpadmin.seq_quote_number START 1;

CREATE TABLE IF NOT EXISTS tdpadmin.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number TEXT NOT NULL UNIQUE DEFAULT 'COT-' || LPAD(nextval('tdpadmin.seq_quote_number')::TEXT, 6, '0'),
  company_id UUID REFERENCES tdpadmin.companies(id) ON DELETE SET NULL,
  client_id UUID REFERENCES tdpadmin.clients(id) ON DELETE SET NULL,
  project_id UUID REFERENCES tdpadmin.projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','approved','rejected','cancelled')),
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  valid_until DATE,
  notes TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES tdpadmin.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tdp_quotes_status ON tdpadmin.quotes(status);
CREATE INDEX IF NOT EXISTS idx_tdp_quotes_number ON tdpadmin.quotes(quote_number);

DROP TRIGGER IF EXISTS trg_tdp_quotes_updated_at ON tdpadmin.quotes;
CREATE TRIGGER trg_tdp_quotes_updated_at BEFORE UPDATE ON tdpadmin.quotes
  FOR EACH ROW EXECUTE FUNCTION tdpadmin.set_updated_at();

-- =============================================================================
-- Items de cotización
-- =============================================================================
CREATE TABLE IF NOT EXISTS tdpadmin.quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES tdpadmin.quotes(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(12,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tdp_quote_items_quote ON tdpadmin.quote_items(quote_id);
