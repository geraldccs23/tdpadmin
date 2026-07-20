-- Migration 008: Dashboard views for TDP Admin
-- =============================================================================

-- 1. Support stats
CREATE OR REPLACE VIEW tdpadmin.vw_support_stats AS
SELECT
  COUNT(*) FILTER (WHERE status = 'open') AS open_tickets,
  COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress_tickets,
  COUNT(*) FILTER (WHERE status = 'waiting_client') AS waiting_client_tickets,
  COUNT(*) FILTER (WHERE status IN ('resolved','closed')) AS resolved_tickets,
  COUNT(*) AS total_tickets,
  COUNT(*) FILTER (WHERE created_at >= date_trunc('month', NOW())) AS tickets_this_month,
  COUNT(*) FILTER (WHERE assigned_to IS NULL AND status NOT IN ('resolved','closed','cancelled')) AS unassigned_tickets,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS tickets_this_week
FROM tdpadmin.support_tickets;

-- 2. Project stats
CREATE OR REPLACE VIEW tdpadmin.vw_project_stats AS
SELECT
  COUNT(*) FILTER (WHERE status = 'active') AS active_projects,
  COUNT(*) FILTER (WHERE status = 'draft') AS draft_projects,
  COUNT(*) FILTER (WHERE status = 'paused') AS paused_projects,
  COUNT(*) FILTER (WHERE status = 'completed') AS completed_projects,
  COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled_projects,
  COUNT(*) AS total_projects,
  COUNT(*) FILTER (WHERE status = 'active' AND end_date IS NOT NULL AND end_date < NOW()) AS overdue_projects,
  COUNT(*) FILTER (WHERE status = 'completed' AND updated_at >= date_trunc('month', NOW())) AS completed_this_month,
  COALESCE(SUM(budget) FILTER (WHERE status = 'active'), 0) AS active_budget,
  COALESCE(SUM(actual_cost) FILTER (WHERE status = 'active'), 0) AS active_actual_cost,
  COALESCE(SUM(actual_cost) FILTER (WHERE updated_at >= date_trunc('month', NOW())), 0) AS cost_this_month
FROM tdpadmin.projects;

-- 3. CRM / Client pipeline stats
CREATE OR REPLACE VIEW tdpadmin.vw_crm_stats AS
SELECT
  COUNT(*) FILTER (WHERE kind = 'prospect') AS total_prospects,
  COUNT(*) FILTER (WHERE kind = 'client') AS total_clients,
  COUNT(*) FILTER (WHERE kind = 'partner') AS total_partners,
  COUNT(*) FILTER (WHERE kind = 'provider') AS total_providers,
  COUNT(*) FILTER (WHERE status = 'lead') AS leads,
  COUNT(*) FILTER (WHERE status = 'contacted') AS contacted,
  COUNT(*) FILTER (WHERE status = 'qualified') AS qualified,
  COUNT(*) FILTER (WHERE status = 'proposal_sent') AS proposal_sent,
  COUNT(*) FILTER (WHERE status = 'won') AS won,
  COUNT(*) FILTER (WHERE status = 'lost') AS lost,
  COUNT(*) FILTER (WHERE status IN ('active','won')) AS active_clients,
  COUNT(*) FILTER (WHERE status = 'inactive') AS inactive,
  COUNT(*) AS total_clients_all,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS new_clients_7d,
  COUNT(*) FILTER (WHERE created_at >= date_trunc('month', NOW())) AS new_clients_month,
  COALESCE(SUM(estimated_budget) FILTER (WHERE status IN ('lead','contacted','qualified','proposal_sent')), 0) AS pipeline_total
FROM tdpadmin.clients;

-- 4. Quote stats
CREATE OR REPLACE VIEW tdpadmin.vw_quote_stats AS
SELECT
  COUNT(*) FILTER (WHERE status = 'draft') AS draft_quotes,
  COUNT(*) FILTER (WHERE status = 'sent') AS sent_quotes,
  COUNT(*) FILTER (WHERE status = 'approved') AS approved_quotes,
  COUNT(*) FILTER (WHERE status = 'rejected') AS rejected_quotes,
  COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled_quotes,
  COUNT(*) AS total_quotes,
  COUNT(*) FILTER (WHERE created_at >= date_trunc('month', NOW())) AS quotes_this_month,
  COUNT(*) FILTER (WHERE status = 'approved' AND updated_at >= date_trunc('month', NOW())) AS approved_this_month,
  COALESCE(SUM(total) FILTER (WHERE status = 'approved'), 0) AS approved_total,
  COALESCE(SUM(total) FILTER (WHERE status = 'approved' AND updated_at >= date_trunc('month', NOW())), 0) AS approved_this_month_total,
  COALESCE(SUM(total) FILTER (WHERE status IN ('draft','sent')), 0) AS pipeline_value
FROM tdpadmin.quotes;

-- 5. TDP Connect leads stats
CREATE OR REPLACE VIEW tdpadmin.vw_connect_stats AS
SELECT
  COUNT(*) AS total_leads,
  COUNT(*) FILTER (WHERE status IN ('lead','contacted','qualified')) AS active_leads,
  COUNT(*) FILTER (WHERE status = 'won') AS converted_leads,
  COUNT(*) FILTER (WHERE status = 'lost') AS lost_leads,
  COUNT(*) FILTER (WHERE status = 'contacted') AS contacted_leads,
  COUNT(*) FILTER (WHERE status = 'proposal_sent') AS proposal_leads,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS new_leads_7d,
  COUNT(*) FILTER (WHERE created_at >= date_trunc('month', NOW())) AS new_leads_month,
  COALESCE(SUM(estimated_budget) FILTER (WHERE status IN ('lead','contacted','qualified','proposal_sent')), 0) AS pipeline_value
FROM tdpadmin.clients
WHERE interest ILIKE '%TDP Connect%' OR source = 'web';

-- 6. Commission stats
CREATE OR REPLACE VIEW tdpadmin.vw_commission_stats AS
SELECT
  COUNT(*) FILTER (WHERE status = 'pending') AS pending_commissions,
  COUNT(*) FILTER (WHERE status = 'approved') AS approved_commissions,
  COUNT(*) FILTER (WHERE status = 'paid') AS paid_commissions,
  COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled_commissions,
  COUNT(*) AS total_commissions,
  COALESCE(SUM(commission_amount) FILTER (WHERE status = 'pending'), 0) AS pending_amount,
  COALESCE(SUM(commission_amount) FILTER (WHERE status = 'approved'), 0) AS approved_amount,
  COALESCE(SUM(commission_amount) FILTER (WHERE status = 'paid'), 0) AS paid_amount,
  COALESCE(SUM(commission_amount) FILTER (WHERE status = 'paid' AND paid_at >= date_trunc('month', NOW())), 0) AS paid_this_month_amount,
  COALESCE(SUM(commission_amount) FILTER (WHERE status = 'pending'), 0) +
  COALESCE(SUM(commission_amount) FILTER (WHERE status = 'approved'), 0) AS total_unpaid_amount
FROM tdpadmin.commissions;

-- 7. Recent activity (union of recent tickets, projects, quotes)
CREATE OR REPLACE VIEW tdpadmin.vw_recent_activity AS
SELECT
  id::TEXT,
  'support_ticket' AS entity_type,
  title AS title,
  status,
  created_at
FROM tdpadmin.support_tickets
UNION ALL
SELECT
  id::TEXT,
  'project' AS entity_type,
  name AS title,
  status,
  created_at
FROM tdpadmin.projects
UNION ALL
SELECT
  id::TEXT,
  'quote' AS entity_type,
  quote_number || ' - ' || title AS title,
  status,
  created_at
FROM tdpadmin.quotes
ORDER BY created_at DESC
LIMIT 20;
