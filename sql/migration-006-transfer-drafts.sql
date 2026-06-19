-- Migration 006: Borradores de Traslados Inter-empresas
-- Ejecutar en Supabase Studio → SQL Editor

CREATE TABLE IF NOT EXISTS public.transfer_drafts (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  origin_branch text NOT NULL,
  items jsonb NOT NULL,
  notes text,
  created_by text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT transfer_drafts_pkey PRIMARY KEY (id)
);

ALTER TABLE public.transfer_drafts ENABLE ROW LEVEL SECURITY;

-- Permitir SELECT/INSERT/UPDATE/DELETE solo al propio usuario
CREATE POLICY "users_own_drafts" ON public.transfer_drafts
  USING (created_by = (SELECT email FROM auth.users WHERE id = auth.uid()));

NOTIFY pgrst, 'reload schema';
