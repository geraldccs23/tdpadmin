-- Migration 016: Soporte multi-tenant — fuente unificada para todas las implementaciones
-- =============================================================================

-- 1. Add 'api' to source CHECK constraint
ALTER TABLE tdpadmin.support_tickets DROP CONSTRAINT IF EXISTS tdpadmin_support_tickets_source_check;
ALTER TABLE tdpadmin.support_tickets ADD CONSTRAINT tdpadmin_support_tickets_source_check
  CHECK (source IN ('portal','internal','whatsapp','email','phone','api','widget'));

-- 2. Migrate legacy public messages from tdpadmin.support_messages to tdpadmin.support_ticket_messages
--    (only if support_messages table exists in tdpadmin schema)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'tdpadmin' AND table_name = 'support_messages') THEN
    INSERT INTO tdpadmin.support_ticket_messages (ticket_id, author_id, author_type, message, is_internal, created_at)
    SELECT
      m.ticket_id,
      NULL,
      CASE WHEN m.sender_email IS NOT NULL THEN 'client' ELSE 'internal' END,
      m.message,
      false,
      m.created_at
    FROM tdpadmin.support_messages m
    WHERE NOT EXISTS (SELECT 1 FROM tdpadmin.support_ticket_messages tm WHERE tm.ticket_id = m.ticket_id AND tm.created_at = m.created_at);
  END IF;
END $$;

-- 3. Add client_id lookup for public tickets: try to match client_email to existing clients
UPDATE tdpadmin.support_tickets t
SET client_id = (SELECT id FROM tdpadmin.clients WHERE email = t.client_email LIMIT 1)
WHERE t.client_id IS NULL AND t.client_email != ''
  AND EXISTS (SELECT 1 FROM tdpadmin.clients WHERE email = t.client_email);

-- 4. Add source_implementation_id and source_implementation_name for display
ALTER TABLE tdpadmin.support_tickets ADD COLUMN IF NOT EXISTS source_implementation TEXT NOT NULL DEFAULT '';

-- 5. Create view for support dashboard by implementation
CREATE OR REPLACE VIEW tdpadmin.vw_support_by_source AS
SELECT
  COALESCE(source, 'portal') AS source,
  COUNT(*) AS total_tickets,
  COUNT(*) FILTER (WHERE status IN ('open','in_progress','waiting_internal')) AS open_tickets,
  COUNT(*) FILTER (WHERE status = 'waiting_client') AS waiting_client,
  COUNT(*) FILTER (WHERE status = 'resolved') AS resolved,
  COUNT(*) FILTER (WHERE status = 'closed') AS closed,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS last_7_days,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS last_30_days
FROM tdpadmin.support_tickets
GROUP BY source
ORDER BY source;

-- Also by client
CREATE OR REPLACE VIEW tdpadmin.vw_support_by_client AS
SELECT
  COALESCE(c.name, 'Sin cliente') AS client_name,
  t.client_id,
  COUNT(*) AS total_tickets,
  COUNT(*) FILTER (WHERE t.status IN ('open','in_progress','waiting_internal')) AS open_tickets,
  COUNT(*) FILTER (WHERE t.status = 'waiting_client') AS waiting_client,
  COUNT(*) FILTER (WHERE t.status = 'resolved') AS resolved,
  MAX(t.created_at) AS last_ticket_at
FROM tdpadmin.support_tickets t
LEFT JOIN tdpadmin.clients c ON c.id = t.client_id
GROUP BY t.client_id, c.name
ORDER BY open_tickets DESC, client_name;
