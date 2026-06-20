-- Migration 014: Configuración Fiscal y Cumplimiento
-- PostgreSQL 17 — idempotente, sin Supabase
-- =============================================================================

-- =============================================================================
-- 1. fiscal_entities — ampliar columnas
-- =============================================================================
ALTER TABLE public.fiscal_entities ADD COLUMN IF NOT EXISTS taxpayer_type TEXT NOT NULL DEFAULT 'ordinario'
  CHECK (taxpayer_type IN ('ordinario','formal','especial','ocasional'));
ALTER TABLE public.fiscal_entities ADD COLUMN IF NOT EXISTS seniat_rif_certificate_url TEXT NOT NULL DEFAULT '';
ALTER TABLE public.fiscal_entities ADD COLUMN IF NOT EXISTS seniat_username TEXT NOT NULL DEFAULT '';
ALTER TABLE public.fiscal_entities ADD COLUMN IF NOT EXISTS special_taxpayer_since DATE;
ALTER TABLE public.fiscal_entities ADD COLUMN IF NOT EXISTS special_taxpayer_providence TEXT NOT NULL DEFAULT '';
ALTER TABLE public.fiscal_entities ADD COLUMN IF NOT EXISTS is_iva_withholding_agent BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.fiscal_entities ADD COLUMN IF NOT EXISTS is_igtf_applicable BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.fiscal_entities ADD COLUMN IF NOT EXISTS igtf_rate NUMERIC(8,4) NOT NULL DEFAULT 3.0000;

-- =============================================================================
-- 2. national_tax_settings — Impuestos Nacionales
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.national_tax_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_entity_id UUID REFERENCES public.fiscal_entities(id) ON DELETE CASCADE,
  tax_code TEXT NOT NULL,
  name TEXT NOT NULL,
  rate NUMERIC(10,4),
  applies BOOLEAN NOT NULL DEFAULT true,
  frequency TEXT NOT NULL DEFAULT 'mensual',
  notes TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_national_tax_fiscal_entity ON public.national_tax_settings(fiscal_entity_id);

INSERT INTO public.national_tax_settings (tax_code, name, rate, applies, frequency, notes) VALUES
  ('IVA', 'IVA — Impuesto al Valor Agregado', 16.0000, true, 'mensual', 'Declaración mensual de IVA. Formulario SENIAT.'),
  ('IGTF', 'IGTF — Impuesto a Grandes Transacciones Financieras', 3.0000, false, 'mensual', 'Aplica solo si sujeto pasivo.'),
  ('ISLR', 'ISLR — Impuesto Sobre la Renta', 25.0000, true, 'anual', 'Declaración anual. Ejercicio fiscal enero-diciembre.')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 3. parafiscal_obligations — Obligaciones Parafiscales
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.parafiscal_obligations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_entity_id UUID REFERENCES public.fiscal_entities(id) ON DELETE CASCADE,
  obligation_code TEXT NOT NULL,
  name TEXT NOT NULL,
  employer_rate NUMERIC(10,4),
  employee_rate NUMERIC(10,4),
  frequency TEXT NOT NULL DEFAULT 'mensual',
  applies BOOLEAN NOT NULL DEFAULT true,
  notes TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parafiscal_fiscal_entity ON public.parafiscal_obligations(fiscal_entity_id);

INSERT INTO public.parafiscal_obligations (obligation_code, name, employer_rate, employee_rate, frequency, notes) VALUES
  ('IVSS', 'Seguro Social (IVSS)', 11.0000, 5.0000, 'mensual', 'Ley del Seguro Social. Aportes patronal + trabajador.'),
  ('FAOV', 'Fondo de Ahorro Obligatorio (FAOV)', 3.0000, 3.0000, 'mensual', 'Ley del Régimen Prestacional de Vivienda.'),
  ('INCES', 'Instituto Nacional de Capacitación (INCES)', 2.0000, 0.5000, 'mensual', 'Ley del INCES. Aporte patronal obligatorio.')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 4. compliance_calendar — Calendario de Cumplimiento
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.compliance_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_entity_id UUID REFERENCES public.fiscal_entities(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.company_branches(id) ON DELETE SET NULL,
  obligation_type TEXT NOT NULL,
  title TEXT NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'mensual',
  due_day INTEGER,
  next_due_date DATE,
  responsible_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','overdue','cancelled')),
  notes TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compliance_fiscal_entity ON public.compliance_calendar(fiscal_entity_id);
CREATE INDEX IF NOT EXISTS idx_compliance_due_date ON public.compliance_calendar(next_due_date);

-- =============================================================================
-- 5. legal_permits — asegurar columnas
-- =============================================================================
ALTER TABLE public.legal_permits ADD COLUMN IF NOT EXISTS fiscal_entity_id UUID REFERENCES public.fiscal_entities(id) ON DELETE SET NULL;
ALTER TABLE public.legal_permits ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.company_branches(id) ON DELETE SET NULL;
ALTER TABLE public.legal_permits ADD COLUMN IF NOT EXISTS issued_by TEXT NOT NULL DEFAULT '';
ALTER TABLE public.legal_permits ADD COLUMN IF NOT EXISTS expiration_date DATE;
ALTER TABLE public.legal_permits ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','pending'));
ALTER TABLE public.legal_permits ADD COLUMN IF NOT EXISTS attachment_url TEXT NOT NULL DEFAULT '';
ALTER TABLE public.legal_permits ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '';

-- Actualizar CHECK permit_type
ALTER TABLE public.legal_permits DROP CONSTRAINT IF EXISTS legal_permits_permit_type_check;
ALTER TABLE public.legal_permits ADD CONSTRAINT legal_permits_permit_type_check
  CHECK (permit_type IN ('bomberos','sanidad','licores','manipulacion_alimentos','proteccion_civil','otro'));

CREATE INDEX IF NOT EXISTS idx_legal_permits_fiscal_entity ON public.legal_permits(fiscal_entity_id);
CREATE INDEX IF NOT EXISTS idx_legal_permits_expiry ON public.legal_permits(expiration_date);

-- =============================================================================
-- 6. municipal_tax_settings — asegurar columnas
-- =============================================================================
ALTER TABLE public.municipal_tax_settings ADD COLUMN IF NOT EXISTS fiscal_entity_id UUID REFERENCES public.fiscal_entities(id) ON DELETE SET NULL;
ALTER TABLE public.municipal_tax_settings ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.company_branches(id) ON DELETE SET NULL;
ALTER TABLE public.municipal_tax_settings ADD COLUMN IF NOT EXISTS mayor_office TEXT NOT NULL DEFAULT '';
ALTER TABLE public.municipal_tax_settings ADD COLUMN IF NOT EXISTS license_number TEXT NOT NULL DEFAULT '';
ALTER TABLE public.municipal_tax_settings ADD COLUMN IF NOT EXISTS economic_activity_code TEXT NOT NULL DEFAULT '';
ALTER TABLE public.municipal_tax_settings ADD COLUMN IF NOT EXISTS economic_activity_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.municipal_tax_settings ADD COLUMN IF NOT EXISTS gross_income_rate NUMERIC(10,4);
ALTER TABLE public.municipal_tax_settings ADD COLUMN IF NOT EXISTS advertising_tax_applies BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.municipal_tax_settings ADD COLUMN IF NOT EXISTS urban_cleaning_fee_applies BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.municipal_tax_settings ADD COLUMN IF NOT EXISTS payment_frequency TEXT NOT NULL DEFAULT 'trimestral';
ALTER TABLE public.municipal_tax_settings ADD COLUMN IF NOT EXISTS issue_date DATE;
ALTER TABLE public.municipal_tax_settings ADD COLUMN IF NOT EXISTS expiration_date DATE;

CREATE INDEX IF NOT EXISTS idx_municipal_tax_fiscal_entity ON public.municipal_tax_settings(fiscal_entity_id);

-- =============================================================================
-- 7. document_sequences — asegurar columnas
-- =============================================================================
ALTER TABLE public.document_sequences ADD COLUMN IF NOT EXISTS fiscal_entity_id UUID REFERENCES public.fiscal_entities(id) ON DELETE SET NULL;
ALTER TABLE public.document_sequences ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.company_branches(id) ON DELETE SET NULL;
ALTER TABLE public.document_sequences ADD COLUMN IF NOT EXISTS serie TEXT NOT NULL DEFAULT 'A';
ALTER TABLE public.document_sequences ADD COLUMN IF NOT EXISTS current_number BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.document_sequences ADD COLUMN IF NOT EXISTS next_number BIGINT NOT NULL DEFAULT 1;
ALTER TABLE public.document_sequences ADD COLUMN IF NOT EXISTS control_number BIGINT;
ALTER TABLE public.document_sequences ADD COLUMN IF NOT EXISTS format_template TEXT NOT NULL DEFAULT '';
ALTER TABLE public.document_sequences ALTER COLUMN current_number TYPE BIGINT USING current_number::bigint;
ALTER TABLE public.document_sequences ALTER COLUMN next_number TYPE BIGINT USING next_number::bigint;

-- Agregar unique compuesto
CREATE UNIQUE INDEX IF NOT EXISTS idx_document_sequences_unique
  ON public.document_sequences(COALESCE(fiscal_entity_id, '00000000-0000-0000-0000-000000000000'::uuid),
                               COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
                               document_type, serie)
  WHERE fiscal_entity_id IS NOT NULL;

-- =============================================================================
-- 8. fiscal_printers_or_providers — asegurar columnas
-- =============================================================================
ALTER TABLE public.fiscal_printers_or_providers ADD COLUMN IF NOT EXISTS fiscal_entity_id UUID REFERENCES public.fiscal_entities(id) ON DELETE SET NULL;
ALTER TABLE public.fiscal_printers_or_providers ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.company_branches(id) ON DELETE SET NULL;
ALTER TABLE public.fiscal_printers_or_providers ADD COLUMN IF NOT EXISTS authorization_number TEXT NOT NULL DEFAULT '';
ALTER TABLE public.fiscal_printers_or_providers ADD COLUMN IF NOT EXISTS provider_rif TEXT NOT NULL DEFAULT '';

-- Actualizar CHECK provider_type
ALTER TABLE public.fiscal_printers_or_providers DROP CONSTRAINT IF EXISTS fiscal_printers_or_providers_provider_type_check;
ALTER TABLE public.fiscal_printers_or_providers ADD CONSTRAINT fiscal_printers_or_providers_provider_type_check
  CHECK (provider_type IN ('impresora_fiscal','proveedor_digital','forma_libre','maquina_fiscal'));

CREATE INDEX IF NOT EXISTS idx_fiscal_providers_fiscal_entity ON public.fiscal_printers_or_providers(fiscal_entity_id);

-- =============================================================================
-- Triggers updated_at (nuevas tablas)
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
  FOR t IN SELECT unnest(ARRAY['company_settings','fiscal_entities','company_branches','company_warehouses',
                               'tax_rates','document_sequences','fiscal_printers_or_providers',
                               'municipal_tax_settings','legal_permits',
                               'national_tax_settings','parafiscal_obligations','compliance_calendar'])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON public.%s', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON public.%s FOR EACH ROW EXECUTE FUNCTION public.set_settings_updated_at()', t, t);
  END LOOP;
END $$;
