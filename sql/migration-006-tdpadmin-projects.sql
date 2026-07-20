-- Migration 006: Proyectos - full project management
-- =============================================================================

-- 1. Add columns to tdpadmin.projects
ALTER TABLE tdpadmin.projects ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent'));
ALTER TABLE tdpadmin.projects ADD COLUMN IF NOT EXISTS progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100);
ALTER TABLE tdpadmin.projects ADD COLUMN IF NOT EXISTS quote_id UUID REFERENCES tdpadmin.quotes(id) ON DELETE SET NULL;
ALTER TABLE tdpadmin.projects ADD COLUMN IF NOT EXISTS project_type TEXT NOT NULL DEFAULT 'otro' CHECK (project_type IN ('pagina_web','ecommerce','sistema_admin','app_movil','branding','marketing','consultoria','soporte','hosting','automatizacion','otro'));
ALTER TABLE tdpadmin.projects ADD COLUMN IF NOT EXISTS actual_cost NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE tdpadmin.projects ADD COLUMN IF NOT EXISTS client_name TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_tdp_projects_priority ON tdpadmin.projects(priority);
CREATE INDEX IF NOT EXISTS idx_tdp_projects_type ON tdpadmin.projects(project_type);

-- 2. Project members
CREATE TABLE IF NOT EXISTS tdpadmin.project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES tdpadmin.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES tdpadmin.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'developer' CHECK (role IN ('project_manager','designer','developer','qa','content','seo','other')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tdp_project_members_project ON tdpadmin.project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_tdp_project_members_user ON tdpadmin.project_members(user_id);

-- 3. Project milestones
CREATE TABLE IF NOT EXISTS tdpadmin.project_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES tdpadmin.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','cancelled')),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tdp_project_milestones_project ON tdpadmin.project_milestones(project_id);

DROP TRIGGER IF EXISTS trg_tdp_project_milestones_updated_at ON tdpadmin.project_milestones;
CREATE TRIGGER trg_tdp_project_milestones_updated_at BEFORE UPDATE ON tdpadmin.project_milestones
  FOR EACH ROW EXECUTE FUNCTION tdpadmin.set_updated_at();

-- 4. Project tasks
CREATE TABLE IF NOT EXISTS tdpadmin.project_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES tdpadmin.projects(id) ON DELETE CASCADE,
  milestone_id UUID REFERENCES tdpadmin.project_milestones(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','review','done','cancelled')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  assignee_id UUID REFERENCES tdpadmin.users(id) ON DELETE SET NULL,
  due_date DATE,
  estimated_hours NUMERIC(8,2),
  actual_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES tdpadmin.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tdp_project_tasks_project ON tdpadmin.project_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tdp_project_tasks_status ON tdpadmin.project_tasks(status);
CREATE INDEX IF NOT EXISTS idx_tdp_project_tasks_assignee ON tdpadmin.project_tasks(assignee_id);

DROP TRIGGER IF EXISTS trg_tdp_project_tasks_updated_at ON tdpadmin.project_tasks;
CREATE TRIGGER trg_tdp_project_tasks_updated_at BEFORE UPDATE ON tdpadmin.project_tasks
  FOR EACH ROW EXECUTE FUNCTION tdpadmin.set_updated_at();

-- 5. Project activity log
CREATE TABLE IF NOT EXISTS tdpadmin.project_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES tdpadmin.projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES tdpadmin.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tdp_project_activity_project ON tdpadmin.project_activity(project_id);
CREATE INDEX IF NOT EXISTS idx_tdp_project_activity_created ON tdpadmin.project_activity(created_at DESC);

-- 6. Project expenses
CREATE TABLE IF NOT EXISTS tdpadmin.project_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES tdpadmin.projects(id) ON DELETE CASCADE,
  concept TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  date DATE,
  created_by UUID REFERENCES tdpadmin.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tdp_project_expenses_project ON tdpadmin.project_expenses(project_id);
