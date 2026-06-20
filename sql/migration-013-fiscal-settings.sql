-- Migration 013: Configuración — Expediente fiscal y operativo
-- PostgreSQL 17 — completamente idempotente
-- =============================================================================

-- 1. Marca / Organización (company_settings)
CREATE TABLE IF NOT EXISTS public.company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL DEFAULT '',
  trade_name TEXT NOT NULL DEFAULT '',
  rif TEXT NOT NULL DEFAULT '',
  business_name TEXT NOT NULL DEFAULT '',
  fiscal_address TEXT NOT NULL DEFAULT '',
  economic_activity TEXT NOT NULL DEFAULT '',
  legal_representative TEXT NOT NULL DEFAULT '',
  legal_rep_id TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  logo_url TEXT NOT NULL DEFAULT '',
  currency TEXT NOT NULL DEFAULT 'VES'
);

-- Agregar columnas de marca/organización (compatibilidad hacia atrás)
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS brand_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS commercial_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS primary_color TEXT NOT NULL DEFAULT '#009FE3';
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS support_email TEXT NOT NULL DEFAULT '';
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/Caracas';
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS default_currency TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Migrar datos de columnas antiguas a nuevas si están vacías
DO $$ BEGIN
  UPDATE public.company_settings SET brand_name = company_name WHERE brand_name = '' AND company_name != '';
  UPDATE public.company_settings SET commercial_name = trade_name WHERE commercial_name = '' AND trade_name != '';
  UPDATE public.company_settings SET default_currency = currency WHERE default_currency = 'USD' AND currency != '';
END $$;

-- 2. Empresas fiscales / Razones sociales
CREATE TABLE IF NOT EXISTS public.fiscal_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name TEXT NOT NULL,
  commercial_name TEXT,
  rif TEXT NOT NULL UNIQUE,
  fiscal_address TEXT NOT NULL DEFAULT '',
  tax_responsibility TEXT NOT NULL DEFAULT '',
  economic_activity TEXT NOT NULL DEFAULT '',
  legal_representative TEXT NOT NULL DEFAULT '',
  legal_rep_id TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Migrar datos existentes de company_settings a fiscal_entities
INSERT INTO public.fiscal_entities (legal_name, commercial_name, rif, fiscal_address, economic_activity, legal_representative, is_default)
SELECT
  COALESCE(NULLIF(company_name, ''), 'Empresa Principal'),
  COALESCE(NULLIF(trade_name, ''), NULLIF(company_name, ''), 'Empresa Principal'),
  COALESCE(NULLIF(rif, ''), 'PENDIENTE'),
  COALESCE(NULLIF(fiscal_address, ''), ''),
  COALESCE(NULLIF(economic_activity, ''), ''),
  COALESCE(NULLIF(legal_representative, ''), ''),
  true
FROM public.company_settings
WHERE EXISTS (SELECT 1 FROM public.company_settings)
  AND NOT EXISTS (SELECT 1 FROM public.fiscal_entities WHERE rif IN (SELECT COALESCE(NULLIF(rif, ''), 'PENDIENTE') FROM public.company_settings))
LIMIT 1;

-- 3. Sucursales
CREATE TABLE IF NOT EXISTS public.company_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  address TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.company_branches ADD COLUMN IF NOT EXISTS fiscal_entity_id UUID REFERENCES public.fiscal_entities(id) ON DELETE SET NULL;
ALTER TABLE public.company_branches ADD COLUMN IF NOT EXISTS city TEXT NOT NULL DEFAULT '';
ALTER TABLE public.company_branches ADD COLUMN IF NOT EXISTS state TEXT NOT NULL DEFAULT '';
ALTER TABLE public.company_branches ADD COLUMN IF NOT EXISTS municipality TEXT NOT NULL DEFAULT '';
ALTER TABLE public.company_branches ADD COLUMN IF NOT EXISTS manager TEXT NOT NULL DEFAULT '';

UPDATE public.company_branches SET fiscal_entity_id = (SELECT id FROM public.fiscal_entities WHERE is_default LIMIT 1) WHERE fiscal_entity_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_company_branches_fiscal_entity ON public.company_branches(fiscal_entity_id);

-- 4. Depósitos / Almacenes
CREATE TABLE IF NOT EXISTS public.company_warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES public.company_branches(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  address TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Tasas impositivas (IVA)
CREATE TABLE IF NOT EXISTS public.tax_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'iva' CHECK (type IN ('iva','municipal','other')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.tax_rates (name, rate, type) VALUES
  ('IVA General 16%', 16.00, 'iva'),
  ('IVA Reducido 8%', 8.00, 'iva')
ON CONFLICT DO NOTHING;

-- 6. Correlativos de facturación
CREATE TABLE IF NOT EXISTS public.document_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES public.company_branches(id) ON DELETE SET NULL,
  document_type TEXT NOT NULL DEFAULT 'invoice' CHECK (document_type IN ('invoice','credit_note','debit_note','purchase','other')),
  prefix TEXT NOT NULL DEFAULT '',
  suffix TEXT NOT NULL DEFAULT '',
  current_number INT NOT NULL DEFAULT 1,
  next_number INT NOT NULL DEFAULT 1,
  control_number TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.document_sequences ADD COLUMN IF NOT EXISTS fiscal_entity_id UUID REFERENCES public.fiscal_entities(id) ON DELETE SET NULL;
ALTER TABLE public.document_sequences ADD COLUMN IF NOT EXISTS serie TEXT NOT NULL DEFAULT 'A';
CREATE INDEX IF NOT EXISTS idx_document_sequences_fiscal_entity ON public.document_sequences(fiscal_entity_id);

-- 7. Impresoras fiscales / Proveedores
CREATE TABLE IF NOT EXISTS public.fiscal_printers_or_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  provider_type TEXT NOT NULL DEFAULT 'printer' CHECK (provider_type IN ('printer','provider','software')),
  model TEXT NOT NULL DEFAULT '',
  serial_number TEXT NOT NULL DEFAULT '',
  branch_id UUID REFERENCES public.company_branches(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fiscal_printers_or_providers ADD COLUMN IF NOT EXISTS fiscal_entity_id UUID REFERENCES public.fiscal_entities(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_fiscal_providers_fiscal_entity ON public.fiscal_printers_or_providers(fiscal_entity_id);

-- 8. Patente municipal / Alcaldía
CREATE TABLE IF NOT EXISTS public.municipal_tax_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality TEXT NOT NULL DEFAULT '',
  patent_number TEXT NOT NULL DEFAULT '',
  patent_expiry DATE,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.municipal_tax_settings ADD COLUMN IF NOT EXISTS fiscal_entity_id UUID REFERENCES public.fiscal_entities(id) ON DELETE SET NULL;
ALTER TABLE public.municipal_tax_settings ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.company_branches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_municipal_tax_fiscal_entity ON public.municipal_tax_settings(fiscal_entity_id);

-- 9. Permisos legales
CREATE TABLE IF NOT EXISTS public.legal_permits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  permit_type TEXT NOT NULL CHECK (permit_type IN ('bomberos','sanidad','licores','gobernacion','other')),
  permit_number TEXT NOT NULL DEFAULT '',
  issue_date DATE,
  expiry_date DATE,
  file_url TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.legal_permits ADD COLUMN IF NOT EXISTS fiscal_entity_id UUID REFERENCES public.fiscal_entities(id) ON DELETE SET NULL;
ALTER TABLE public.legal_permits ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.company_branches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_legal_permits_fiscal_entity ON public.legal_permits(fiscal_entity_id);

-- =============================================================================
-- Trigger updated_at para todas las tablas
-- =============================================================================
CREATE OR REPLACE FUNCTION public.set_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['company_settings','fiscal_entities','company_branches','company_warehouses','tax_rates','document_sequences','fiscal_printers_or_providers','municipal_tax_settings','legal_permits'])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON public.%s', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON public.%s FOR EACH ROW EXECUTE FUNCTION public.set_settings_updated_at()', t, t);
  END LOOP;
END $$;
