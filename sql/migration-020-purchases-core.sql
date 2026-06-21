-- Migration 020: Compras — Proveedores
-- PostgreSQL 17 — idempotente
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.purchase_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE,
  name TEXT NOT NULL,
  contact_person TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  rif TEXT,
  address TEXT NOT NULL DEFAULT '',
  payment_terms TEXT NOT NULL DEFAULT '',
  lead_time_days INT,
  notes TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_purchase_suppliers_code ON public.purchase_suppliers(code);
CREATE INDEX IF NOT EXISTS idx_purchase_suppliers_name ON public.purchase_suppliers(name);
CREATE INDEX IF NOT EXISTS idx_purchase_suppliers_rif ON public.purchase_suppliers(rif);
CREATE INDEX IF NOT EXISTS idx_purchase_suppliers_active ON public.purchase_suppliers(is_active);
