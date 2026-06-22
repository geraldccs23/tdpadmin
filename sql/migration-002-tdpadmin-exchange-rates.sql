-- Migration 002: TDP Admin — Tasas de Cambio
-- PostgreSQL 17 — idempotente
-- =============================================================================

CREATE TABLE IF NOT EXISTS tdpadmin.exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_date DATE NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  rate NUMERIC(18,6) NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  notes TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES tdpadmin.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_rate_date_currency UNIQUE (rate_date, currency)
);

CREATE INDEX IF NOT EXISTS idx_tdp_exchange_rates_date ON tdpadmin.exchange_rates(rate_date DESC);
CREATE INDEX IF NOT EXISTS idx_tdp_exchange_rates_currency ON tdpadmin.exchange_rates(currency);

DROP TRIGGER IF EXISTS trg_tdp_exchange_rates_updated_at ON tdpadmin.exchange_rates;
CREATE TRIGGER trg_tdp_exchange_rates_updated_at BEFORE UPDATE ON tdpadmin.exchange_rates
  FOR EACH ROW EXECUTE FUNCTION tdpadmin.set_updated_at();
