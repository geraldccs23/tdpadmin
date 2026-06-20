-- Migration 014: Multi-entity fiscal model
-- PostgreSQL 17 — idempotente
-- Permite que una misma organización tenga varias razones sociales (RIF)
-- =============================================================================

-- 1. Refactor company_settings → marca/organización
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS brand_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS commercial_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS primary_color TEXT NOT NULL DEFAULT '#009FE3';
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS support_email TEXT NOT NULL DEFAULT '';
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/Caracas';
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS default_currency TEXT NOT NULL DEFAULT 'VES';

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
  AND NOT EXISTS (SELECT 1 FROM public.fiscal_entities WHERE rif = (SELECT COALESCE(NULLIF(rif, ''), 'PENDIENTE') FROM public.company_settings LIMIT 1))
LIMIT 1;

-- 3. Refactor company_branches
ALTER TABLE public.company_branches ADD COLUMN IF NOT EXISTS fiscal_entity_id UUID REFERENCES public.fiscal_entities(id) ON DELETE SET NULL;
ALTER TABLE public.company_branches ADD COLUMN IF NOT EXISTS city TEXT NOT NULL DEFAULT '';
ALTER TABLE public.company_branches ADD COLUMN IF NOT EXISTS state TEXT NOT NULL DEFAULT '';
ALTER TABLE public.company_branches ADD COLUMN IF NOT EXISTS municipality TEXT NOT NULL DEFAULT '';
ALTER TABLE public.company_branches ADD COLUMN IF NOT EXISTS manager TEXT NOT NULL DEFAULT '';

-- Asignar la empresa fiscal por defecto a sucursales existentes
UPDATE public.company_branches SET fiscal_entity_id = (SELECT id FROM public.fiscal_entities WHERE is_default LIMIT 1) WHERE fiscal_entity_id IS NULL;

-- 4. Refactor company_warehouses (no changes needed, already has branch_id)

-- 5. Refactor document_sequences
ALTER TABLE public.document_sequences ADD COLUMN IF NOT EXISTS fiscal_entity_id UUID REFERENCES public.fiscal_entities(id) ON DELETE SET NULL;
ALTER TABLE public.document_sequences ADD COLUMN IF NOT EXISTS serie TEXT NOT NULL DEFAULT 'A';

-- 6. Refactor fiscal_printers_or_providers
ALTER TABLE public.fiscal_printers_or_providers ADD COLUMN IF NOT EXISTS fiscal_entity_id UUID REFERENCES public.fiscal_entities(id) ON DELETE SET NULL;

-- 7. Refactor municipal_tax_settings
ALTER TABLE public.municipal_tax_settings ADD COLUMN IF NOT EXISTS fiscal_entity_id UUID REFERENCES public.fiscal_entities(id) ON DELETE SET NULL;
ALTER TABLE public.municipal_tax_settings ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.company_branches(id) ON DELETE SET NULL;

-- 8. Refactor legal_permits
ALTER TABLE public.legal_permits ADD COLUMN IF NOT EXISTS fiscal_entity_id UUID REFERENCES public.fiscal_entities(id) ON DELETE SET NULL;
ALTER TABLE public.legal_permits ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.company_branches(id) ON DELETE SET NULL;

-- =============================================================================
-- Trigger updated_at para fiscal_entities
-- =============================================================================
DROP TRIGGER IF EXISTS trg_fiscal_entities_updated_at ON public.fiscal_entities;
CREATE TRIGGER trg_fiscal_entities_updated_at BEFORE UPDATE ON public.fiscal_entities FOR EACH ROW EXECUTE FUNCTION public.set_settings_updated_at();
