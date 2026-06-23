-- Migration 003: TDP Admin — Central de Soporte
-- PostgreSQL 17 — idempotente
-- =============================================================================

-- =============================================================================
-- 1. Users: agregar role 'client' y client_id
-- =============================================================================
ALTER TABLE tdpadmin.users ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES tdpadmin.clients(id) ON DELETE SET NULL;
ALTER TABLE tdpadmin.users DROP CONSTRAINT IF EXISTS tdpadmin_users_role_check;
ALTER TABLE tdpadmin.users ADD CONSTRAINT tdpadmin_users_role_check
  CHECK (role IN ('superadmin','admin','sales','support','finance','staff','client'));

-- =============================================================================
-- 2. Secuencia para número de ticket
-- =============================================================================
CREATE SEQUENCE IF NOT EXISTS tdpadmin.seq_ticket_number START 1;

CREATE OR REPLACE FUNCTION tdpadmin.generate_ticket_number()
RETURNS TEXT AS $$
DECLARE
  seq_num TEXT;
BEGIN
  seq_num := LPAD(nextval('tdpadmin.seq_ticket_number')::TEXT, 5, '0');
  RETURN 'TCK-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || seq_num;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 3. Support Tickets
-- =============================================================================
CREATE TABLE IF NOT EXISTS tdpadmin.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT NOT NULL UNIQUE DEFAULT tdpadmin.generate_ticket_number(),
  client_id UUID NOT NULL REFERENCES tdpadmin.clients(id) ON DELETE CASCADE,
  project_id UUID REFERENCES tdpadmin.projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','waiting_client','waiting_internal','resolved','closed','cancelled')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('web','hosting','email','domain','system','billing','general','other')),
  source TEXT NOT NULL DEFAULT 'portal' CHECK (source IN ('portal','internal','whatsapp','email','phone')),
  assigned_to UUID REFERENCES tdpadmin.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES tdpadmin.users(id) ON DELETE SET NULL,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tdp_support_tickets_client ON tdpadmin.support_tickets(client_id);
CREATE INDEX IF NOT EXISTS idx_tdp_support_tickets_project ON tdpadmin.support_tickets(project_id);
CREATE INDEX IF NOT EXISTS idx_tdp_support_tickets_status ON tdpadmin.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_tdp_support_tickets_priority ON tdpadmin.support_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tdp_support_tickets_assigned ON tdpadmin.support_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tdp_support_tickets_created ON tdpadmin.support_tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tdp_support_tickets_number ON tdpadmin.support_tickets(ticket_number);

DROP TRIGGER IF EXISTS trg_tdp_support_tickets_updated_at ON tdpadmin.support_tickets;
CREATE TRIGGER trg_tdp_support_tickets_updated_at BEFORE UPDATE ON tdpadmin.support_tickets
  FOR EACH ROW EXECUTE FUNCTION tdpadmin.set_updated_at();

-- =============================================================================
-- 4. Support Ticket Messages
-- =============================================================================
CREATE TABLE IF NOT EXISTS tdpadmin.support_ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tdpadmin.support_tickets(id) ON DELETE CASCADE,
  author_id UUID REFERENCES tdpadmin.users(id) ON DELETE SET NULL,
  author_type TEXT NOT NULL DEFAULT 'internal' CHECK (author_type IN ('internal','client','system')),
  message TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tdp_support_msgs_ticket ON tdpadmin.support_ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_tdp_support_msgs_created ON tdpadmin.support_ticket_messages(created_at);

-- =============================================================================
-- 5. Support Ticket Attachments
-- =============================================================================
CREATE TABLE IF NOT EXISTS tdpadmin.support_ticket_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tdpadmin.support_tickets(id) ON DELETE CASCADE,
  message_id UUID REFERENCES tdpadmin.support_ticket_messages(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT '',
  size_bytes INT NOT NULL DEFAULT 0,
  uploaded_by UUID REFERENCES tdpadmin.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tdp_support_attachments_ticket ON tdpadmin.support_ticket_attachments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_tdp_support_attachments_message ON tdpadmin.support_ticket_attachments(message_id);
