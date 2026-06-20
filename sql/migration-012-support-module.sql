-- Migration 012: Módulo de Soporte (standalone, sin Supabase)
-- PostgreSQL 17 — idempotente
-- Preparado para sincronización futura con Admin TDP central

-- =============================================================================
-- Soporte: Tickets
-- =============================================================================
DROP TABLE IF EXISTS public.support_messages CASCADE;
DROP TABLE IF EXISTS public.support_tickets CASCADE;
DROP VIEW IF EXISTS public.v_support_tickets;

CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'restaurantdp',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  category TEXT NOT NULL DEFAULT 'support' CHECK (category IN ('bug','feature_request','support','other')),
  user_id UUID REFERENCES public.users(id),
  user_email TEXT,
  assigned_to UUID REFERENCES public.users(id),
  assigned_email TEXT,
  branch TEXT,
  image_url TEXT,
  external_ticket_id TEXT,
  sync_status TEXT NOT NULL DEFAULT 'local' CHECK (sync_status IN ('local','pending','synced','failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_tenant ON public.support_tickets(tenant_id);

-- =============================================================================
-- Soporte: Mensajes
-- =============================================================================
CREATE TABLE public.support_messages (
  id BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.users(id),
  sender_email TEXT,
  message TEXT NOT NULL,
  image_url TEXT,
  external_message_id TEXT,
  sync_status TEXT NOT NULL DEFAULT 'local' CHECK (sync_status IN ('local','pending','synced','failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT support_messages_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_support_messages_ticket ON public.support_messages(ticket_id);

-- =============================================================================
-- Vista con emails resueltos (sin columnas duplicadas)
-- =============================================================================
DROP VIEW IF EXISTS public.v_support_tickets;
CREATE VIEW public.v_support_tickets AS
SELECT
  t.id,
  t.tenant_id,
  t.title,
  t.description,
  t.status,
  t.priority,
  t.category,
  t.user_id,
  t.user_email,
  t.assigned_to,
  COALESCE(t.assigned_email, u_assigned.email) AS assigned_email,
  t.branch,
  cb.name AS branch_name,
  t.image_url,
  t.external_ticket_id,
  t.sync_status,
  t.created_at,
  t.updated_at,
  COALESCE(t.user_email, u_creator.email) AS creator_email
FROM public.support_tickets t
LEFT JOIN public.users u_creator ON t.user_id = u_creator.id
LEFT JOIN public.users u_assigned ON t.assigned_to = u_assigned.id
LEFT JOIN public.company_branches cb ON t.branch = cb.code;

-- =============================================================================
-- Trigger: updated_at
-- =============================================================================
CREATE OR REPLACE FUNCTION public.set_support_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_support_tickets_updated_at ON public.support_tickets;
CREATE TRIGGER trg_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_support_updated_at();
