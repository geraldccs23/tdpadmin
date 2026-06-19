-- ============================================================================
-- RG7 ERP — DEFINITIVE COMPLETE SCHEMA
-- ============================================================================
-- Run this in Supabase SQL Editor to recreate the entire database schema.
-- Safe for repeated execution (idempotent).
-- ============================================================================

-- ============================================================================
-- SCHEMAS
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS rg7_hist;

-- ============================================================================
-- TABLES (ordered by FK dependency)
-- ============================================================================

-- 1. BRANDS
CREATE TABLE IF NOT EXISTS public.brands (
  brand_code integer NOT NULL,
  brand_name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT brands_pkey PRIMARY KEY (brand_code)
);

CREATE TABLE IF NOT EXISTS public.product_brands (
  brand_code integer NOT NULL,
  brand_name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT product_brands_pkey PRIMARY KEY (brand_code)
);

-- 2. SUPPLIERS
CREATE TABLE IF NOT EXISTS public.suppliers (
  supplier_code text NOT NULL,
  supplier_name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  rif text UNIQUE,
  phone text,
  email text,
  address text,
  contact_name text,
  updated_at timestamp with time zone,
  CONSTRAINT suppliers_pkey PRIMARY KEY (supplier_code)
);

-- 3. BRAND DEFAULT SUPPLIERS
CREATE TABLE IF NOT EXISTS public.brand_default_suppliers (
  brand_code integer NOT NULL,
  supplier_code text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT brand_default_suppliers_pkey PRIMARY KEY (brand_code),
  CONSTRAINT brand_default_suppliers_brand_code_fkey FOREIGN KEY (brand_code) REFERENCES public.brands(brand_code),
  CONSTRAINT brand_default_suppliers_supplier_code_fkey FOREIGN KEY (supplier_code) REFERENCES public.suppliers(supplier_code)
);

-- 4. VEHICLE CATEGORIES
CREATE TABLE IF NOT EXISTS public.vehicle_categories (
  code text NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT vehicle_categories_pkey PRIMARY KEY (code)
);

-- 5. PRODUCTS
CREATE SEQUENCE IF NOT EXISTS products_id_seq;
CREATE TABLE IF NOT EXISTS public.products (
  id bigint NOT NULL DEFAULT nextval('products_id_seq'),
  codigo_producto text NOT NULL UNIQUE,
  vehicle_brand_code text DEFAULT split_part(codigo_producto, '-'::text, 1),
  category_code text DEFAULT split_part(codigo_producto, '-'::text, 2),
  supplier_code text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  brand_code integer DEFAULT (NULLIF(regexp_replace(split_part(codigo_producto, '-'::text, 3), '\D'::text, ''::text, 'g'::text), ''::text))::integer,
  stock_boleita numeric NOT NULL DEFAULT 0,
  stock_sabana_grande numeric NOT NULL DEFAULT 0,
  stock_comprometido numeric NOT NULL DEFAULT 0,
  descripcion text,
  precio_referencia numeric,
  costo numeric(12,2),
  CONSTRAINT products_pkey PRIMARY KEY (id),
  CONSTRAINT products_brand_code_fk FOREIGN KEY (brand_code) REFERENCES public.brands(brand_code)
);
ALTER SEQUENCE products_id_seq OWNED BY public.products.id;

-- 6. STOCK SNAPSHOTS
CREATE SEQUENCE IF NOT EXISTS stock_snapshots_id_seq;
CREATE TABLE IF NOT EXISTS public.stock_snapshots (
  id bigint NOT NULL DEFAULT nextval('stock_snapshots_id_seq'),
  source text NOT NULL DEFAULT 'PROFIT'::text,
  branch text NOT NULL,
  captured_at timestamp with time zone NOT NULL DEFAULT now(),
  warehouses text[] NOT NULL DEFAULT '{}'::text[],
  rows_count integer NOT NULL DEFAULT 0,
  CONSTRAINT stock_snapshots_pkey PRIMARY KEY (id)
);
ALTER SEQUENCE stock_snapshots_id_seq OWNED BY public.stock_snapshots.id;

-- 7. STOCK SNAPSHOT LINES
CREATE SEQUENCE IF NOT EXISTS stock_snapshot_lines_id_seq;
CREATE TABLE IF NOT EXISTS public.stock_snapshot_lines (
  id bigint NOT NULL DEFAULT nextval('stock_snapshot_lines_id_seq'),
  snapshot_id bigint NOT NULL,
  codigo_producto text NOT NULL,
  codigo_almacen text NOT NULL,
  stock numeric NOT NULL DEFAULT 0,
  descripcion text,
  modelo text,
  ref text,
  precio_usd numeric,
  precio_bs numeric,
  tasa_ref numeric,
  CONSTRAINT stock_snapshot_lines_pkey PRIMARY KEY (id),
  CONSTRAINT stock_snapshot_lines_snapshot_id_fkey FOREIGN KEY (snapshot_id) REFERENCES public.stock_snapshots(id)
);
ALTER SEQUENCE stock_snapshot_lines_id_seq OWNED BY public.stock_snapshot_lines.id;

-- 8. BANKS
CREATE TABLE IF NOT EXISTS public.banks (
  code text NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT banks_pkey PRIMARY KEY (code)
);

-- 9. BANK ACCOUNTS
CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  bank_code text NOT NULL,
  reference text NOT NULL,
  balance numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  payment_types text[] NOT NULL DEFAULT '{}',
  sucursal text NOT NULL DEFAULT 'Boleita',
  CONSTRAINT bank_accounts_pkey PRIMARY KEY (id),
  CONSTRAINT bank_accounts_bank_code_fkey FOREIGN KEY (bank_code) REFERENCES public.banks(code)
);

-- 10. BANK INITIAL BALANCES
CREATE TABLE IF NOT EXISTS public.bank_initial_balances (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  bank_account_id bigint NOT NULL,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  user_email text,
  CONSTRAINT bank_initial_balances_pkey PRIMARY KEY (id),
  CONSTRAINT bank_initial_balances_bank_account_id_fkey FOREIGN KEY (bank_account_id) REFERENCES public.bank_accounts(id)
);

-- 11. BANK AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.bank_audit_logs (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  table_name text NOT NULL,
  record_id text NOT NULL,
  action text NOT NULL,
  old_data jsonb,
  new_data jsonb,
  user_email text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT bank_audit_logs_pkey PRIMARY KEY (id)
);

-- 12. EXPENSE RECIPIENTS
CREATE TABLE IF NOT EXISTS public.expense_recipients (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  type text NOT NULL CHECK (type IN ('Proveedor', 'Servicios', 'Persona Natural', 'Nómina', 'Otro')),
  name text NOT NULL,
  document_id text,
  phone text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT expense_recipients_pkey PRIMARY KEY (id)
);

-- 13. EXPENSES
CREATE TABLE IF NOT EXISTS public.expenses (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  branch text NOT NULL CHECK (branch IN ('Boleita', 'Sabana Grande')),
  recipient_id bigint NOT NULL,
  concept text NOT NULL,
  payment_type text NOT NULL,
  bank_account_id bigint,
  amount numeric NOT NULL CHECK (amount > 0),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  exchange_rate numeric,
  amount_bs numeric,
  CONSTRAINT expenses_pkey PRIMARY KEY (id),
  CONSTRAINT expenses_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.expense_recipients(id),
  CONSTRAINT expenses_bank_account_id_fkey FOREIGN KEY (bank_account_id) REFERENCES public.bank_accounts(id)
);

-- 14. SELLERS
CREATE TABLE IF NOT EXISTS public.sellers (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  name text NOT NULL UNIQUE,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT sellers_pkey PRIMARY KEY (id)
);

-- 15. COURIERS
CREATE TABLE IF NOT EXISTS public.couriers (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  name text NOT NULL UNIQUE,
  phone text,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT couriers_pkey PRIMARY KEY (id)
);

-- 16. CUSTOMERS
CREATE TABLE IF NOT EXISTS public.customers (
  id text NOT NULL,
  name text NOT NULL,
  phone text,
  created_at timestamp with time zone DEFAULT now(),
  seller_id bigint,
  CONSTRAINT customers_pkey PRIMARY KEY (id),
  CONSTRAINT customers_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.sellers(id)
);

-- 17. INCOMES
CREATE TABLE IF NOT EXISTS public.incomes (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  branch text NOT NULL CHECK (branch IN ('Boleita', 'Sabana Grande')),
  document_type text NOT NULL,
  document_number text NOT NULL,
  payment_condition text NOT NULL CHECK (payment_condition IN ('Contado', 'Inicial de Cashea', 'Credito')),
  customer_id text,
  customer_name text,
  customer_phone text,
  total_amount numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  seller_id bigint,
  delivery_method text DEFAULT 'Retira en Tienda',
  courier_id bigint,
  cash_register text,
  shipping_agency text,
  created_by_email text,
  created_by_id uuid,
  type text DEFAULT 'Venta' CHECK (type IN ('Venta', 'Devolucion')),
  discount_usd numeric DEFAULT 0,
  CONSTRAINT incomes_pkey PRIMARY KEY (id),
  CONSTRAINT incomes_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.sellers(id),
  CONSTRAINT incomes_courier_id_fkey FOREIGN KEY (courier_id) REFERENCES public.couriers(id),
  CONSTRAINT fk_incomes_customer FOREIGN KEY (customer_id) REFERENCES public.customers(id)
);

-- 18. INCOME LINES
CREATE TABLE IF NOT EXISTS public.income_lines (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  income_id bigint NOT NULL,
  codigo_producto text NOT NULL,
  descripcion text,
  cantidad numeric NOT NULL,
  precio_unitario_usd numeric NOT NULL,
  total_linea_usd numeric NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  precio_original_usd numeric DEFAULT 0,
  descuento_usd numeric DEFAULT 0,
  CONSTRAINT income_lines_pkey PRIMARY KEY (id),
  CONSTRAINT income_lines_income_id_fkey FOREIGN KEY (income_id) REFERENCES public.incomes(id)
);

-- 19. INCOME PAYMENTS
CREATE TABLE IF NOT EXISTS public.income_payments (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  income_id bigint NOT NULL,
  payment_type text NOT NULL,
  amount numeric NOT NULL,
  bank_account_id bigint,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  exchange_rate numeric,
  amount_bs numeric,
  batch_number text,
  status text DEFAULT 'available',
  CONSTRAINT income_payments_pkey PRIMARY KEY (id),
  CONSTRAINT income_payments_income_id_fkey FOREIGN KEY (income_id) REFERENCES public.incomes(id) ON DELETE CASCADE,
  CONSTRAINT income_payments_bank_account_id_fkey FOREIGN KEY (bank_account_id) REFERENCES public.bank_accounts(id)
);

-- 20. CASHEA INSTALLMENTS
CREATE TABLE IF NOT EXISTS public.cashea_installments (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  income_id bigint,
  installment_number integer NOT NULL,
  amount_usd numeric NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  created_at timestamp with time zone DEFAULT now(),
  paid_at timestamp with time zone,
  due_date timestamp with time zone,
  CONSTRAINT cashea_installments_pkey PRIMARY KEY (id),
  CONSTRAINT cashea_installments_income_id_fkey FOREIGN KEY (income_id) REFERENCES public.incomes(id) ON DELETE CASCADE
);

-- 21. PURCHASE ORDERS (FORDMAC version — merged with the simplified version)
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  numero_orden text NOT NULL UNIQUE,
  supplier_code text,
  fecha_emision timestamp with time zone NOT NULL DEFAULT now(),
  fecha_prometida timestamp with time zone,
  es_urgente boolean DEFAULT false,
  status text DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PARTIAL', 'COMPLETED', 'CANCELLED')),
  created_at timestamp with time zone DEFAULT now(),
  sucursal text DEFAULT 'Boleita',
  notes text,
  total_amount_usd numeric DEFAULT 0,
  CONSTRAINT purchase_orders_pkey PRIMARY KEY (id),
  CONSTRAINT purchase_orders_supplier_code_fkey FOREIGN KEY (supplier_code) REFERENCES public.suppliers(supplier_code)
);

-- 22. PURCHASE ORDER LINES
CREATE TABLE IF NOT EXISTS public.purchase_order_lines (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  order_id bigint,
  codigo_producto text NOT NULL,
  cantidad_pedida numeric NOT NULL,
  precio_unitario_usd numeric,
  created_at timestamp with time zone DEFAULT now(),
  description text,
  cantidad_recibida numeric DEFAULT 0,
  total_linea_usd numeric DEFAULT 0,
  CONSTRAINT purchase_order_lines_pkey PRIMARY KEY (id),
  CONSTRAINT purchase_order_lines_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE
);

-- 23. PURCHASE LINES (from Profit ERP sync)
CREATE SEQUENCE IF NOT EXISTS purchase_lines_id_seq;
CREATE TABLE IF NOT EXISTS public.purchase_lines (
  id bigint NOT NULL DEFAULT nextval('purchase_lines_id_seq'),
  fuente text NOT NULL,
  fecha_hora timestamp without time zone NOT NULL,
  tipo_documento text NOT NULL,
  numero_documento text NOT NULL,
  sucursal text NOT NULL,
  proveedor_codigo text,
  proveedor_nombre text,
  codigo_producto text NOT NULL,
  descripcion text,
  cantidad numeric,
  costo_bs numeric,
  costo_usd numeric,
  tasa_original numeric,
  tasa_ref_dia numeric,
  tasa_final numeric,
  tasa_es_valida boolean,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  extracted_at timestamp with time zone NOT NULL DEFAULT now(),
  uniq_key text NOT NULL UNIQUE,
  line_seq integer,
  order_id bigint,
  status text,
  origen text,
  tasa_historica numeric,
  total_costo_bs numeric,
  total_costo_usd numeric,
  CONSTRAINT purchase_lines_pkey PRIMARY KEY (id),
  CONSTRAINT purchase_lines_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.purchase_orders(id)
);
ALTER SEQUENCE purchase_lines_id_seq OWNED BY public.purchase_lines.id;

-- 24. SALES LINES (from Profit ERP sync)
CREATE SEQUENCE IF NOT EXISTS sales_lines_id_seq;
CREATE TABLE IF NOT EXISTS public.sales_lines (
  id bigint NOT NULL DEFAULT nextval('sales_lines_id_seq'),
  fuente text NOT NULL,
  fecha_hora timestamp without time zone NOT NULL,
  tipo_documento text NOT NULL,
  numero_documento text NOT NULL,
  sucursal text NOT NULL,
  codigo_cliente text,
  nombre_cliente text,
  codigo_vendedor text,
  vendedor text,
  codigo_producto text NOT NULL,
  descripcion text,
  barra_referencia text,
  marca_producto text,
  categoria_mapeada text,
  categoria_tipo text,
  tasa numeric,
  precio_bs numeric,
  precio_usd numeric,
  cantidad numeric,
  total_bs numeric,
  total_usd numeric,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  extracted_at timestamp with time zone NOT NULL DEFAULT now(),
  uniq_key text NOT NULL UNIQUE,
  CONSTRAINT sales_lines_pkey PRIMARY KEY (id)
);
ALTER SEQUENCE sales_lines_id_seq OWNED BY public.sales_lines.id;

-- 25. USER ROLES (RBAC)
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'cajero' CHECK (role IN ('director', 'supervisor', 'supervisor_ventas', 'supervisor_compras', 'administrador', 'cajero', 'vendedor', 'compras', 'soporte', 'delivery', 'supervisor_almacen', 'almacenista')),
  created_at timestamp with time zone DEFAULT now(),
  email text,
  CONSTRAINT user_roles_pkey PRIMARY KEY (user_id),
  CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 26. SUPPORT TICKETS
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  category text NOT NULL DEFAULT 'support' CHECK (category IN ('bug', 'feature_request', 'support', 'other')),
  user_id uuid NOT NULL,
  assigned_to uuid,
  branch text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  image_url text,
  CONSTRAINT support_tickets_pkey PRIMARY KEY (id),
  CONSTRAINT support_tickets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT support_tickets_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES auth.users(id)
);

-- 27. SUPPORT MESSAGES
CREATE TABLE IF NOT EXISTS public.support_messages (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  ticket_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  sender_email text,
  message text NOT NULL,
  image_url text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT support_messages_pkey PRIMARY KEY (id),
  CONSTRAINT support_messages_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  CONSTRAINT support_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id)
);

-- 28. DELIVERIES
CREATE SEQUENCE IF NOT EXISTS deliveries_id_seq;
CREATE TABLE IF NOT EXISTS public.deliveries (
  id integer NOT NULL DEFAULT nextval('deliveries_id_seq'),
  income_id integer,
  courier_id integer,
  municipio text NOT NULL,
  zona text NOT NULL,
  delivery_status text NOT NULL DEFAULT 'EN_PREPARACION',
  payment_status text NOT NULL DEFAULT 'PENDIENTE',
  notes text,
  timestamps_estados jsonb DEFAULT '{"EN_PREPARACION": null, "EN_RUTA": null, "ENTREGADO": null, "FALLIDO": null}',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  client_name text,
  client_phone text,
  amount_to_collect numeric NOT NULL DEFAULT 0.00,
  delivery_fee numeric NOT NULL DEFAULT 2.00,
  observations text,
  location_url text,
  second_phone text,
  CONSTRAINT deliveries_pkey PRIMARY KEY (id),
  CONSTRAINT deliveries_income_id_fkey FOREIGN KEY (income_id) REFERENCES public.incomes(id) ON DELETE CASCADE,
  CONSTRAINT deliveries_courier_id_fkey FOREIGN KEY (courier_id) REFERENCES public.couriers(id)
);
ALTER SEQUENCE deliveries_id_seq OWNED BY public.deliveries.id;

-- 29. DELIVERY ZONES
CREATE SEQUENCE IF NOT EXISTS delivery_zones_id_seq;
CREATE TABLE IF NOT EXISTS public.delivery_zones (
  id integer NOT NULL DEFAULT nextval('delivery_zones_id_seq'),
  municipio text NOT NULL,
  zona text NOT NULL UNIQUE,
  rate numeric NOT NULL DEFAULT 2.00,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT delivery_zones_pkey PRIMARY KEY (id)
);
ALTER SEQUENCE delivery_zones_id_seq OWNED BY public.delivery_zones.id;

-- 30. NATIONAL SHIPPINGS
CREATE TABLE IF NOT EXISTS public.envios_nacionales (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  income_id bigint NOT NULL,
  agency text NOT NULL,
  tracking_number text,
  destination_state text,
  destination_city text,
  status text NOT NULL DEFAULT 'PREPARANDO' CHECK (status IN ('PREPARANDO', 'ENVIADO', 'ENTREGADO')),
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT envios_nacionales_pkey PRIMARY KEY (id),
  CONSTRAINT envios_nacionales_income_id_fkey FOREIGN KEY (income_id) REFERENCES public.incomes(id)
);

-- 31. ACCOUNTS PAYABLE (CxP)
CREATE SEQUENCE IF NOT EXISTS accounts_payable_id_seq;
CREATE TABLE IF NOT EXISTS public.accounts_payable (
  id bigint NOT NULL DEFAULT nextval('accounts_payable_id_seq'),
  branch text NOT NULL,
  provider_name text NOT NULL,
  amount numeric NOT NULL,
  amount_bs numeric NOT NULL,
  concept text NOT NULL,
  bank_account_id bigint,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  exchange_rate numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  due_date date,
  purchase_order_id bigint,
  received_by text,
  total_items_received numeric DEFAULT 0,
  purchase_doc text,
  purchase_source text,
  CONSTRAINT accounts_payable_pkey PRIMARY KEY (id),
  CONSTRAINT accounts_payable_bank_account_id_fkey FOREIGN KEY (bank_account_id) REFERENCES public.bank_accounts(id),
  CONSTRAINT accounts_payable_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id),
  CONSTRAINT accounts_payable_doc_unique UNIQUE (purchase_source, branch, purchase_doc)
);
ALTER SEQUENCE accounts_payable_id_seq OWNED BY public.accounts_payable.id;

-- 32. PAYABLE PAYMENTS
CREATE SEQUENCE IF NOT EXISTS payable_payments_id_seq;
CREATE TABLE IF NOT EXISTS public.payable_payments (
  id bigint NOT NULL DEFAULT nextval('payable_payments_id_seq'),
  payable_id bigint,
  amount numeric NOT NULL,
  amount_bs numeric NOT NULL,
  payment_type text NOT NULL,
  bank_account_id bigint,
  exchange_rate numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT payable_payments_pkey PRIMARY KEY (id),
  CONSTRAINT payable_payments_payable_id_fkey FOREIGN KEY (payable_id) REFERENCES public.accounts_payable(id) ON DELETE CASCADE,
  CONSTRAINT payable_payments_bank_account_id_fkey FOREIGN KEY (bank_account_id) REFERENCES public.bank_accounts(id)
);
ALTER SEQUENCE payable_payments_id_seq OWNED BY public.payable_payments.id;

-- 33. INVENTORY MOVEMENTS (Warehouse)
CREATE SEQUENCE IF NOT EXISTS inventory_movements_id_seq;
CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id integer NOT NULL DEFAULT nextval('inventory_movements_id_seq'),
  branch varchar(50) NOT NULL,
  product_code varchar(100) NOT NULL,
  product_description varchar(255),
  movement_type varchar(20) NOT NULL,
  quantity numeric(10, 2) NOT NULL,
  reason varchar(50) NOT NULL,
  notes text,
  user_email varchar(255),
  reference_id text,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT inventory_movements_pkey PRIMARY KEY (id),
  CONSTRAINT fk_product FOREIGN KEY (product_code) REFERENCES public.products(codigo_producto) ON DELETE CASCADE
);
ALTER SEQUENCE inventory_movements_id_seq OWNED BY public.inventory_movements.id;

-- 34. CASHIER CLOSINGS
CREATE TABLE IF NOT EXISTS public.cashier_closings (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  branch text NOT NULL,
  cash_register text NOT NULL,
  cajero_email text NOT NULL,
  closing_date date NOT NULL,
  system_amounts jsonb NOT NULL,
  real_amounts jsonb NOT NULL,
  total_difference numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'PENDIENTE' CHECK (status IN ('PENDIENTE', 'APROBADO', 'RECHAZADO')),
  reviewed_by text,
  review_notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT cashier_closings_pkey PRIMARY KEY (id),
  CONSTRAINT cashier_closings_branch_cashier_cajero_date_key UNIQUE (branch, cash_register, cajero_email, closing_date)
);

-- 35. INTERNAL TRANSFERS
CREATE TABLE IF NOT EXISTS public.transferencias_internas_v4 (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  from_account_id bigint NOT NULL,
  to_account_id bigint NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  reference text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT transferencias_internas_v4_pkey PRIMARY KEY (id),
  CONSTRAINT transferencias_internas_v4_from_account_id_fkey FOREIGN KEY (from_account_id) REFERENCES public.bank_accounts(id),
  CONSTRAINT transferencias_internas_v4_to_account_id_fkey FOREIGN KEY (to_account_id) REFERENCES public.bank_accounts(id)
);

-- 36. FORDMAC CONFIG
CREATE TABLE IF NOT EXISTS public.fordmac_config (
  id integer NOT NULL DEFAULT 1 CHECK (id = 1),
  weight_lead_time numeric DEFAULT 0.40,
  weight_fill_rate numeric DEFAULT 0.35,
  weight_punctuality numeric DEFAULT 0.25,
  last_updated timestamp with time zone DEFAULT now(),
  CONSTRAINT fordmac_config_pkey PRIMARY KEY (id)
);

-- 37. FORDMAC RUNS
CREATE SEQUENCE IF NOT EXISTS fordmac_runs_id_seq;
CREATE TABLE IF NOT EXISTS public.fordmac_runs (
  id bigint NOT NULL DEFAULT nextval('fordmac_runs_id_seq'),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  lookback_days integer NOT NULL DEFAULT 30,
  lead_time_days integer NOT NULL DEFAULT 7,
  review_days integer NOT NULL DEFAULT 7,
  safety_factor numeric NOT NULL DEFAULT 0.20,
  notes text,
  CONSTRAINT fordmac_runs_pkey PRIMARY KEY (id)
);
ALTER SEQUENCE fordmac_runs_id_seq OWNED BY public.fordmac_runs.id;

-- 38. FORDMAC RUN ITEMS
CREATE SEQUENCE IF NOT EXISTS fordmac_run_items_id_seq;
CREATE TABLE IF NOT EXISTS public.fordmac_run_items (
  id bigint NOT NULL DEFAULT nextval('fordmac_run_items_id_seq'),
  run_id bigint NOT NULL,
  codigo_producto text NOT NULL,
  CONSTRAINT fordmac_run_items_pkey PRIMARY KEY (id),
  CONSTRAINT fordmac_run_items_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.fordmac_runs(id)
);
ALTER SEQUENCE fordmac_run_items_id_seq OWNED BY public.fordmac_run_items.id;

-- 39. FORDMAC RESULTS
CREATE SEQUENCE IF NOT EXISTS fordmac_results_id_seq;
CREATE TABLE IF NOT EXISTS public.fordmac_results (
  id bigint NOT NULL DEFAULT nextval('fordmac_results_id_seq'),
  run_id bigint NOT NULL,
  codigo_producto text NOT NULL,
  avg_daily_demand numeric,
  min_qty numeric,
  max_qty numeric,
  reorder_point numeric,
  suggested_buy_qty numeric,
  stock_total numeric,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT fordmac_results_pkey PRIMARY KEY (id),
  CONSTRAINT fordmac_results_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.fordmac_runs(id)
);
ALTER SEQUENCE fordmac_results_id_seq OWNED BY public.fordmac_results.id;

-- 40. WHATSAPP INSTANCES
CREATE TABLE IF NOT EXISTS public.wa_instances (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  seller_id bigint NOT NULL,
  instance_name text NOT NULL UNIQUE,
  phone_number text NOT NULL,
  apikey text,
  connection_status text DEFAULT 'disconnected' CHECK (connection_status IN ('open', 'close', 'disconnected', 'connecting')),
  qr_code text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT wa_instances_pkey PRIMARY KEY (id),
  CONSTRAINT wa_instances_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.sellers(id)
);

-- 41. WHATSAPP CONVERSATIONS
CREATE TABLE IF NOT EXISTS public.wa_conversations (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  instance_id bigint,
  remote_jid text,
  customer_id text,
  customer_name text,
  customer_phone text,
  last_message_at timestamp with time zone,
  last_message_preview text,
  unread_count integer DEFAULT 0,
  status text DEFAULT 'active' CHECK (status IN ('active', 'closed', 'archived')),
  assigned_to bigint,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT wa_conversations_pkey PRIMARY KEY (id),
  CONSTRAINT wa_conversations_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES public.wa_instances(id),
  CONSTRAINT wa_conversations_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id),
  CONSTRAINT wa_conversations_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.sellers(id)
);

-- 42. WHATSAPP MESSAGES
CREATE TABLE IF NOT EXISTS public.wa_messages (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  conversation_id bigint NOT NULL,
  wa_message_id text,
  from_me boolean NOT NULL DEFAULT false,
  message_type text DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'audio', 'video', 'document', 'location', 'contact', 'sticker', 'system')),
  content text,
  media_url text,
  mimetype text,
  caption text,
  metadata jsonb,
  timestamp timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT wa_messages_pkey PRIMARY KEY (id),
  CONSTRAINT wa_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.wa_conversations(id) ON DELETE CASCADE
);

-- 43. WHATSAPP QUICK REPLIES
CREATE TABLE IF NOT EXISTS public.wa_quick_replies (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  category text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT wa_quick_replies_pkey PRIMARY KEY (id)
);

-- 44. DAILY RATES
CREATE TABLE IF NOT EXISTS public.daily_rates (
  date date NOT NULL,
  rate numeric NOT NULL,
  set_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT daily_rates_pkey PRIMARY KEY (date),
  CONSTRAINT daily_rates_set_by_fkey FOREIGN KEY (set_by) REFERENCES auth.users(id)
);

-- 45. EMPLOYEES
CREATE TABLE IF NOT EXISTS public.employees (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  branch text NOT NULL,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT employees_pkey PRIMARY KEY (id)
);

-- 46. ATTENDANCE LOGS
CREATE TABLE IF NOT EXISTS public.attendance_logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  employee_id uuid,
  branch text NOT NULL,
  type text NOT NULL,
  timestamp timestamp with time zone DEFAULT now(),
  device_info text,
  CONSTRAINT attendance_logs_pkey PRIMARY KEY (id),
  CONSTRAINT attendance_logs_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES auth.users(id)
);

-- 47. SYNC LOGS
CREATE TABLE IF NOT EXISTS public.sync_logs (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL CHECK (status IN ('PENDING', 'SENT', 'ERROR')),
  last_error text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT sync_logs_pkey PRIMARY KEY (id)
);

-- 48. rg7_hist.cxc_lines (Historical CxC)
CREATE TABLE IF NOT EXISTS rg7_hist.cxc_lines (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  uniq_key text UNIQUE NOT NULL,
  fuente text,
  sucursal text,
  codigo_cliente text,
  nombre_cliente text,
  tipo_documento text,
  numero_documento text,
  fecha_emision timestamptz,
  fecha_vencimiento timestamptz,
  monto_total numeric(18,4),
  saldo_pendiente numeric(18,4),
  codigo_vendedor text,
  vendedor text,
  raw jsonb,
  extracted_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT cxc_lines_pkey PRIMARY KEY (id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_cashea_income_id ON public.cashea_installments(income_id);
CREATE INDEX IF NOT EXISTS idx_cashea_status ON public.cashea_installments(status);
CREATE INDEX IF NOT EXISTS idx_customers_seller_id ON public.customers(seller_id);
CREATE INDEX IF NOT EXISTS idx_cxc_lines_cliente ON rg7_hist.cxc_lines(codigo_cliente);
CREATE INDEX IF NOT EXISTS idx_cxc_lines_extracted ON rg7_hist.cxc_lines(extracted_at);
CREATE INDEX IF NOT EXISTS idx_wa_conversations_instance ON public.wa_conversations(instance_id);
CREATE INDEX IF NOT EXISTS idx_wa_conversations_remote_jid ON public.wa_conversations(remote_jid);
CREATE INDEX IF NOT EXISTS idx_wa_conversations_customer ON public.wa_conversations(customer_id);
CREATE INDEX IF NOT EXISTS idx_wa_conversations_assigned ON public.wa_conversations(assigned_to);
CREATE INDEX IF NOT EXISTS idx_wa_messages_conversation ON public.wa_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_wa_messages_timestamp ON public.wa_messages(timestamp DESC);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- 1. parse_supplier_code: extract supplier code from product code (e.g., "AAM-AAA-00001")
CREATE OR REPLACE FUNCTION public.parse_supplier_code(p_codigo text)
RETURNS text AS $$
BEGIN
  RETURN CASE
    WHEN p_codigo ~ '^[A-Z]+-' THEN substring(p_codigo, '^([A-Z]+)-')
    WHEN p_codigo ~ '^[A-Z]+[0-9]+-' THEN substring(p_codigo, '^([A-Z0-9]+)-')
    ELSE NULL
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Update product stock from inventory movement (warehouse trigger)
CREATE OR REPLACE FUNCTION public.update_product_stock_from_movement()
RETURNS TRIGGER AS $$
DECLARE
    stock_change NUMERIC;
BEGIN
    IF NEW.movement_type = 'CARGO' THEN
        stock_change := NEW.quantity;
        IF NEW.branch IN ('01', 'BOLEITA', 'Boleíta') THEN
            UPDATE public.products
            SET stock_boleita = stock_boleita + stock_change
            WHERE codigo_producto = NEW.product_code;
        ELSIF NEW.branch IN ('03', 'SABANA GRANDE', 'Sabana Grande') THEN
            UPDATE public.products
            SET stock_sabana_grande = stock_sabana_grande + stock_change
            WHERE codigo_producto = NEW.product_code;
        END IF;
    ELSIF NEW.movement_type = 'DESCARGO' THEN
        stock_change := -NEW.quantity;
        IF NEW.branch IN ('01', 'BOLEITA', 'Boleíta') THEN
            UPDATE public.products
            SET stock_boleita = stock_boleita + stock_change
            WHERE codigo_producto = NEW.product_code;
        ELSIF NEW.branch IN ('03', 'SABANA GRANDE', 'Sabana Grande') THEN
            UPDATE public.products
            SET stock_sabana_grande = stock_sabana_grande + stock_change
            WHERE codigo_producto = NEW.product_code;
        END IF;
    ELSIF NEW.movement_type IN ('TRASPASO') THEN
        -- Subtract from origin branch, add to comprometido
        IF NEW.branch IN ('01', 'BOLEITA', 'Boleíta') THEN
            UPDATE public.products
            SET stock_boleita = stock_boleita - NEW.quantity,
                stock_comprometido = stock_comprometido + NEW.quantity
            WHERE codigo_producto = NEW.product_code;
        ELSIF NEW.branch IN ('03', 'SABANA GRANDE', 'Sabana Grande') THEN
            UPDATE public.products
            SET stock_sabana_grande = stock_sabana_grande - NEW.quantity,
                stock_comprometido = stock_comprometido + NEW.quantity
            WHERE codigo_producto = NEW.product_code;
        END IF;
    ELSIF NEW.movement_type = 'RECEPCION' THEN
        -- Receive from comprometido → add to destination branch
        IF NEW.branch IN ('01', 'BOLEITA', 'Boleíta') THEN
            UPDATE public.products
            SET stock_comprometido = GREATEST(stock_comprometido - NEW.quantity, 0),
                stock_boleita = stock_boleita + NEW.quantity
            WHERE codigo_producto = NEW.product_code;
        ELSIF NEW.branch IN ('03', 'SABANA GRANDE', 'Sabana Grande') THEN
            UPDATE public.products
            SET stock_comprometido = GREATEST(stock_comprometido - NEW.quantity, 0),
                stock_sabana_grande = stock_sabana_grande + NEW.quantity
            WHERE codigo_producto = NEW.product_code;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2b. Revert stock comprometido when PO is cancelled
CREATE OR REPLACE FUNCTION public.revert_stock_on_po_cancel()
RETURNS TRIGGER AS $$
DECLARE
    mov RECORD;
BEGIN
    IF NEW.status = 'CANCELLED' AND OLD.status != 'CANCELLED' THEN
        FOR mov IN 
            SELECT product_code, quantity, branch 
            FROM public.inventory_movements 
            WHERE reference_id = NEW.numero_orden 
              AND movement_type = 'TRASPASO'
        LOOP
            IF mov.branch IN ('01', 'BOLEITA', 'Boleíta') THEN
                UPDATE public.products
                SET stock_comprometido = GREATEST(stock_comprometido - mov.quantity, 0),
                    stock_boleita = stock_boleita + mov.quantity
                WHERE codigo_producto = mov.product_code;
            ELSIF mov.branch IN ('03', 'SABANA GRANDE', 'Sabana Grande') THEN
                UPDATE public.products
                SET stock_comprometido = GREATEST(stock_comprometido - mov.quantity, 0),
                    stock_sabana_grande = stock_sabana_grande + mov.quantity
                WHERE codigo_producto = mov.product_code;
            END IF;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Sync product from stock snapshot (for auto-creating products)
CREATE OR REPLACE FUNCTION public.sync_product_from_snapshot()
RETURNS TRIGGER AS $$
DECLARE
    v_brand_code integer;
    v_supplier_code text;
BEGIN
    v_brand_code := (NULLIF(regexp_replace(split_part(NEW.codigo_producto, '-', 3), '\D', '', 'g'), ''))::integer;
    v_supplier_code := public.parse_supplier_code(NEW.codigo_producto);
    IF v_brand_code IS NOT NULL THEN
        INSERT INTO public.brands (brand_code, brand_name)
        VALUES (v_brand_code, 'Marca Nueva ' || v_brand_code)
        ON CONFLICT (brand_code) DO NOTHING;
    END IF;
    IF v_supplier_code IS NOT NULL THEN
        INSERT INTO public.suppliers (supplier_code, supplier_name)
        VALUES (v_supplier_code, 'Proveedor Nuevo ' || v_supplier_code)
        ON CONFLICT (supplier_code) DO NOTHING;
    END IF;
    INSERT INTO public.products (codigo_producto, descripcion, precio_referencia)
    VALUES (NEW.codigo_producto, NEW.descripcion, NEW.precio_usd)
    ON CONFLICT (codigo_producto) DO UPDATE SET
        descripcion = COALESCE(EXCLUDED.descripcion, products.descripcion),
        precio_referencia = COALESCE(NULLIF(EXCLUDED.precio_referencia, 0), products.precio_referencia);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Sync purchase to accounts_payable
CREATE OR REPLACE FUNCTION public.sync_purchase_to_cxp()
RETURNS TRIGGER AS $$
DECLARE
    total_usd numeric;
    total_bs numeric;
    p_name text;
    p_branch text;
    p_tasa numeric;
BEGIN
    SELECT
        COALESCE(SUM(costo_usd * cantidad), 0),
        COALESCE(SUM(costo_bs * cantidad), 0),
        MAX(proveedor_nombre),
        MAX(sucursal),
        MAX(tasa_final)
    INTO total_usd, total_bs, p_name, p_branch, p_tasa
    FROM public.purchase_lines
    WHERE numero_documento = NEW.numero_documento
      AND sucursal = NEW.sucursal
      AND fuente = NEW.fuente;
    IF total_usd > 0 THEN
        INSERT INTO public.accounts_payable (branch, provider_name, amount, amount_bs, concept, exchange_rate, status, purchase_doc, purchase_source)
        VALUES (p_branch, p_name, total_usd, total_bs, 'Compra de Inventario: ' || NEW.numero_documento, COALESCE(p_tasa, 1), 'pending', NEW.numero_documento, NEW.fuente)
        ON CONFLICT (purchase_source, branch, purchase_doc) DO UPDATE SET
            amount = EXCLUDED.amount,
            amount_bs = EXCLUDED.amount_bs,
            exchange_rate = EXCLUDED.exchange_rate,
            provider_name = EXCLUDED.provider_name;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Process CxP payment (create expense, update status)
CREATE OR REPLACE FUNCTION public.process_cxp_payment()
RETURNS TRIGGER AS $$
DECLARE
    v_provider_name text;
    v_branch text;
    v_normalized_branch text;
    v_recipient_id bigint;
    v_concept text;
    v_total_paid numeric;
    v_total_amount numeric;
BEGIN
    SELECT provider_name, branch, amount, concept
    INTO v_provider_name, v_branch, v_total_amount, v_concept
    FROM public.accounts_payable
    WHERE id = NEW.payable_id;
    v_normalized_branch := CASE
        WHEN UPPER(v_branch) IN ('01', 'BOLEITA', 'BOLEÍTA') THEN 'Boleita'
        WHEN UPPER(v_branch) IN ('03', 'SABANA GRANDE', 'SABANA') THEN 'Sabana Grande'
        ELSE 'Boleita'
    END;
    SELECT id INTO v_recipient_id
    FROM public.expense_recipients
    WHERE UPPER(name) = UPPER(v_provider_name)
    LIMIT 1;
    IF v_recipient_id IS NULL THEN
        INSERT INTO public.expense_recipients (type, name)
        VALUES ('Proveedor', v_provider_name)
        RETURNING id INTO v_recipient_id;
    END IF;
    INSERT INTO public.expenses (branch, recipient_id, concept, payment_type, bank_account_id, amount, created_at)
    VALUES (v_normalized_branch, v_recipient_id, 'PAGO CXP: ' || v_concept, NEW.payment_type, NEW.bank_account_id, NEW.amount, NEW.created_at);
    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
    FROM public.payable_payments
    WHERE payable_id = NEW.payable_id;
    IF v_total_paid >= v_total_amount THEN
        UPDATE public.accounts_payable
        SET status = 'paid'
        WHERE id = NEW.payable_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Update bank balance on income payment INSERT / UPDATE / DELETE
CREATE OR REPLACE FUNCTION public.update_bank_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
      IF NEW.bank_account_id IS NOT NULL AND NEW.status = 'available' THEN
        UPDATE public.bank_accounts
        SET balance = balance + NEW.amount
        WHERE id = NEW.bank_account_id;
      END IF;
      RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
      IF OLD.bank_account_id IS NOT NULL AND OLD.status = 'available' THEN
        UPDATE public.bank_accounts
        SET balance = balance - OLD.amount
        WHERE id = OLD.bank_account_id;
      END IF;
      RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
      IF OLD.bank_account_id IS NOT NULL THEN
        UPDATE public.bank_accounts SET balance = balance - OLD.amount WHERE id = OLD.bank_account_id;
      END IF;
      IF NEW.bank_account_id IS NOT NULL AND NEW.status = 'available' THEN
        UPDATE public.bank_accounts SET balance = balance + NEW.amount WHERE id = NEW.bank_account_id;
      END IF;
      RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 7. Handle income payment status change (for batch reconciliation)
CREATE OR REPLACE FUNCTION public.on_payment_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.status IS NULL OR OLD.status != 'available') AND NEW.status = 'available' AND NEW.bank_account_id IS NOT NULL THEN
    UPDATE public.bank_accounts
    SET balance = balance + NEW.amount
    WHERE id = NEW.bank_account_id;
  END IF;
  IF OLD.status = 'available' AND NEW.status != 'available' AND NEW.bank_account_id IS NOT NULL THEN
     UPDATE public.bank_accounts
     SET balance = balance - NEW.amount
     WHERE id = NEW.bank_account_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Handle income payment delete (reverse bank balance)
CREATE OR REPLACE FUNCTION public.on_payment_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.bank_account_id IS NOT NULL AND OLD.status = 'available' THEN
    UPDATE public.bank_accounts
    SET balance = balance - OLD.amount
    WHERE id = OLD.bank_account_id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 9. Deduct bank balance on expense INSERT / UPDATE / DELETE
CREATE OR REPLACE FUNCTION public.deduct_bank_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
      IF NEW.bank_account_id IS NOT NULL THEN
        UPDATE public.bank_accounts
        SET balance = balance - NEW.amount
        WHERE id = NEW.bank_account_id;
      END IF;
      RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
      IF OLD.bank_account_id IS NOT NULL THEN
        UPDATE public.bank_accounts
        SET balance = balance + OLD.amount
        WHERE id = OLD.bank_account_id;
      END IF;
      RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
      IF OLD.bank_account_id IS NOT NULL THEN
        UPDATE public.bank_accounts SET balance = balance + OLD.amount WHERE id = OLD.bank_account_id;
      END IF;
      IF NEW.bank_account_id IS NOT NULL THEN
        UPDATE public.bank_accounts SET balance = balance - NEW.amount WHERE id = NEW.bank_account_id;
      END IF;
      RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 10. Process initial balance (set bank balance)
CREATE OR REPLACE FUNCTION public.process_initial_balance()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT' AND NEW.status = 'approved') OR
       (TG_OP = 'UPDATE' AND NEW.status = 'approved' AND OLD.status = 'pending') THEN
        UPDATE public.bank_accounts
        SET balance = NEW.amount
        WHERE id = NEW.bank_account_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 11. Bank audit logging
CREATE OR REPLACE FUNCTION public.process_bank_audit()
RETURNS TRIGGER AS $$
DECLARE
    v_user_email text;
    v_record_id text;
BEGIN
    SELECT email INTO v_user_email FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
    IF v_user_email IS NULL THEN
        v_user_email := 'Sistema / Desconocido';
    END IF;
    IF (TG_TABLE_NAME = 'banks') THEN
        IF (TG_OP = 'DELETE') THEN v_record_id := OLD.code; ELSE v_record_id := NEW.code; END IF;
    ELSE
        IF (TG_OP = 'DELETE') THEN v_record_id := OLD.id::text; ELSE v_record_id := NEW.id::text; END IF;
    END IF;
    IF (TG_OP = 'DELETE') THEN
        INSERT INTO public.bank_audit_logs (table_name, record_id, action, old_data, user_email)
        VALUES (TG_TABLE_NAME, v_record_id, 'DELETE', row_to_json(OLD)::jsonb, v_user_email);
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO public.bank_audit_logs (table_name, record_id, action, old_data, new_data, user_email)
        VALUES (TG_TABLE_NAME, v_record_id, 'UPDATE', row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb, v_user_email);
        RETURN NEW;
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO public.bank_audit_logs (table_name, record_id, action, new_data, user_email)
        VALUES (TG_TABLE_NAME, v_record_id, 'INSERT', row_to_json(NEW)::jsonb, v_user_email);
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Process internal transfer (v4)
CREATE OR REPLACE FUNCTION public.process_v4_transfer()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.bank_accounts SET balance = balance - NEW.amount WHERE id = NEW.from_account_id;
    UPDATE public.bank_accounts SET balance = balance + NEW.amount WHERE id = NEW.to_account_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 13. Update modified column trigger helper
CREATE OR REPLACE FUNCTION public.update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 14. Set updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Inventory movements → update product stock
DROP TRIGGER IF EXISTS trg_update_stock_on_movement ON public.inventory_movements;
CREATE TRIGGER trg_update_stock_on_movement
AFTER INSERT ON public.inventory_movements
FOR EACH ROW EXECUTE FUNCTION public.update_product_stock_from_movement();

-- Stock snapshot insert → sync products
DROP TRIGGER IF EXISTS trigger_update_products_from_snapshot ON public.stock_snapshot_lines;
CREATE TRIGGER trigger_update_products_from_snapshot
AFTER INSERT ON public.stock_snapshot_lines
FOR EACH ROW EXECUTE FUNCTION public.sync_product_from_snapshot();

-- Purchase insert/update → sync to CxP
DROP TRIGGER IF EXISTS trg_sync_purchase_to_cxp ON public.purchase_lines;
CREATE TRIGGER trg_sync_purchase_to_cxp
AFTER INSERT OR UPDATE ON public.purchase_lines
FOR EACH ROW EXECUTE FUNCTION public.sync_purchase_to_cxp();

-- Payable payment insert → create expense
DROP TRIGGER IF EXISTS trg_process_cxp_payment ON public.payable_payments;
CREATE TRIGGER trg_process_cxp_payment
AFTER INSERT ON public.payable_payments
FOR EACH ROW EXECUTE FUNCTION public.process_cxp_payment();

-- Income payment insert/update/delete → update bank balance
DROP TRIGGER IF EXISTS after_income_payment_action ON public.income_payments;
CREATE TRIGGER after_income_payment_action
AFTER INSERT OR DELETE OR UPDATE ON public.income_payments
FOR EACH ROW EXECUTE FUNCTION public.update_bank_balance();

-- Income payment status change → reconcile bank balance
DROP TRIGGER IF EXISTS after_income_payment_status_update ON public.income_payments;
CREATE TRIGGER after_income_payment_status_update
AFTER UPDATE OF status ON public.income_payments
FOR EACH ROW EXECUTE FUNCTION public.on_payment_status_change();

-- Income payment delete → reverse bank balance
DROP TRIGGER IF EXISTS after_income_payment_delete ON public.income_payments;
CREATE TRIGGER after_income_payment_delete
AFTER DELETE ON public.income_payments
FOR EACH ROW EXECUTE FUNCTION public.on_payment_delete();

-- Expense insert/update/delete → update bank balance
DROP TRIGGER IF EXISTS after_expense_action ON public.expenses;
CREATE TRIGGER after_expense_action
AFTER INSERT OR DELETE OR UPDATE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.deduct_bank_balance();

-- Bank initial balance approval → set balance
DROP TRIGGER IF EXISTS trg_initial_balance_approval ON public.bank_initial_balances;
CREATE TRIGGER trg_initial_balance_approval
AFTER INSERT OR UPDATE ON public.bank_initial_balances
FOR EACH ROW EXECUTE FUNCTION public.process_initial_balance();

-- Bank audit triggers
DROP TRIGGER IF EXISTS trg_audit_banks ON public.banks;
CREATE TRIGGER trg_audit_banks
AFTER UPDATE OR DELETE ON public.banks
FOR EACH ROW EXECUTE FUNCTION public.process_bank_audit();

DROP TRIGGER IF EXISTS trg_audit_bank_accounts ON public.bank_accounts;
CREATE TRIGGER trg_audit_bank_accounts
AFTER UPDATE OR DELETE ON public.bank_accounts
FOR EACH ROW EXECUTE FUNCTION public.process_bank_audit();

-- Internal transfer → update both account balances
DROP TRIGGER IF EXISTS trg_v4_transfer ON public.transferencias_internas_v4;
CREATE TRIGGER trg_v4_transfer
AFTER INSERT ON public.transferencias_internas_v4
FOR EACH ROW EXECUTE FUNCTION public.process_v4_transfer();

-- Purchase order updated_at
DROP TRIGGER IF EXISTS trg_purchase_orders_updated_at ON public.purchase_orders;
CREATE TRIGGER trg_purchase_orders_updated_at
BEFORE UPDATE ON public.purchase_orders
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Support ticket updated_at
DROP TRIGGER IF EXISTS update_support_tickets_modtime ON public.support_tickets;
CREATE TRIGGER update_support_tickets_modtime
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

-- ============================================================================
-- VIEWS
-- ============================================================================

-- 1. Latest stock snapshot per product per branch
CREATE OR REPLACE VIEW public.v_latest_stock_by_branch AS
SELECT DISTINCT ON (ssl.codigo_producto, ss.branch)
    ss.branch,
    ssl.codigo_producto,
    ssl.descripcion,
    ssl.modelo,
    ssl.ref,
    ssl.precio_usd,
    ssl.stock
FROM public.stock_snapshot_lines ssl
JOIN public.stock_snapshots ss ON ss.id = ssl.snapshot_id
ORDER BY ssl.codigo_producto, ss.branch, ss.captured_at DESC;

-- 2. ERP stock breakdown (Profit + Local Adjustments)
CREATE OR REPLACE VIEW public.v_erp_stock_by_branch AS
SELECT
    ps.branch,
    ps.codigo_producto,
    ps.descripcion,
    ps.modelo,
    ps.ref,
    ps.precio_usd,
    ps.stock AS profit_stock,
    COALESCE(SUM(CASE WHEN m.movement_type = 'CARGO' THEN m.quantity
                      WHEN m.movement_type = 'DESCARGO' THEN -m.quantity
                      WHEN m.movement_type = 'TRASPASO' THEN -m.quantity
                      ELSE 0 END), 0) AS local_adjustments,
    CASE WHEN ps.branch IN ('01', 'BOLEITA', 'Boleíta') THEN p.stock_boleita
         WHEN ps.branch IN ('03', 'SABANA GRANDE', 'Sabana Grande') THEN p.stock_sabana_grande
         ELSE 0 END AS erp_stock
FROM public.v_latest_stock_by_branch ps
LEFT JOIN public.products p ON p.codigo_producto = ps.codigo_producto
LEFT JOIN public.inventory_movements m ON ps.codigo_producto = m.product_code AND ps.branch = m.branch
GROUP BY
    ps.branch, ps.codigo_producto, ps.descripcion, ps.modelo, ps.ref,
    ps.precio_usd, ps.stock, p.stock_boleita, p.stock_sabana_grande;

-- 3. Support tickets with creator/assignee emails
CREATE OR REPLACE VIEW public.v_support_tickets AS
SELECT
    t.*,
    u_creator.email as creator_email,
    u_assigned.email as assigned_email
FROM public.support_tickets t
LEFT JOIN auth.users u_creator ON t.user_id = u_creator.id
LEFT JOIN auth.users u_assigned ON t.assigned_to = u_assigned.id;

-- 4. Internal transfers with bank names
CREATE OR REPLACE VIEW public.v_transferencias_final_v4 AS
SELECT
    t.*,
    jsonb_build_object('reference', fa.reference, 'banks', jsonb_build_object('name', fb.name)) as "from",
    jsonb_build_object('reference', ta.reference, 'banks', jsonb_build_object('name', tb.name)) as "to"
FROM public.transferencias_internas_v4 t
JOIN public.bank_accounts fa ON t.from_account_id = fa.id
JOIN public.banks fb ON fa.bank_code = fb.code
JOIN public.bank_accounts ta ON t.to_account_id = ta.id
JOIN public.banks tb ON ta.bank_code = tb.code;

-- 5. Inter-company transfer orders with receipt summary
CREATE OR REPLACE VIEW public.vw_intercompany_orders AS
SELECT
  po.id,
  po.numero_orden,
  po.supplier_code,
  CASE po.supplier_code
    WHEN 'RG7-INTER' THEN 'AUTOPARTES RG7, C.A.'
    WHEN 'IMS-INTER' THEN 'IMPORTMOTOSIETE, C.A.'
  END AS provider_name,
  po.sucursal,
  po.status,
  po.total_amount_usd,
  po.notes,
  po.created_at,
  (SELECT COUNT(*) FROM purchase_order_lines pol WHERE pol.order_id = po.id) AS item_count,
  (SELECT COUNT(*) FROM purchase_order_lines pol WHERE pol.order_id = po.id AND pol.cantidad_recibida > 0) AS items_partially_received,
  (SELECT COUNT(*) FROM purchase_order_lines pol WHERE pol.order_id = po.id AND pol.cantidad_recibida >= pol.cantidad_pedida) AS items_completed
FROM purchase_orders po
WHERE po.supplier_code IN ('RG7-INTER', 'IMS-INTER')
ORDER BY po.created_at DESC;

-- 6. Inter-company product movement summary
CREATE OR REPLACE VIEW public.vw_intercompany_product_movements AS
SELECT
  m.product_code,
  m.product_description,
  COUNT(*) FILTER (WHERE m.movement_type = 'TRASPASO') AS traslados_count,
  SUM(m.quantity) FILTER (WHERE m.movement_type = 'TRASPASO') AS total_enviado,
  COUNT(*) FILTER (WHERE m.movement_type = 'RECEPCION') AS recepciones_count,
  SUM(m.quantity) FILTER (WHERE m.movement_type = 'RECEPCION') AS total_recibido,
  COALESCE(SUM(m.quantity) FILTER (WHERE m.movement_type = 'TRASPASO'), 0) -
  COALESCE(SUM(m.quantity) FILTER (WHERE m.movement_type = 'RECEPCION'), 0) AS diferencia,
  MAX(m.created_at) AS ultimo_movimiento
FROM inventory_movements m
WHERE m.movement_type IN ('TRASPASO', 'RECEPCION')
GROUP BY m.product_code, m.product_description
HAVING COUNT(*) > 0
ORDER BY diferencia DESC;

-- 7. Pending inter-company payables
CREATE OR REPLACE VIEW public.vw_intercompany_payables AS
SELECT
  ap.id,
  ap.provider_name,
  ap.amount,
  ap.amount_bs,
  ap.branch,
  ap.concept,
  ap.status,
  ap.created_at,
  ap.purchase_doc
FROM accounts_payable ap
WHERE ap.provider_name IN ('AUTOPARTES RG7, C.A.', 'IMPORTMOTOSIETE, C.A.')
  AND ap.status = 'pending'
ORDER BY ap.created_at DESC;

-- 8. Monthly inter-company transfer summary
CREATE OR REPLACE VIEW public.vw_intercompany_monthly_summary AS
SELECT
  TO_CHAR(m.created_at, 'YYYY-MM') AS mes,
  COUNT(DISTINCT m.id) FILTER (WHERE m.movement_type = 'TRASPASO') AS traslados,
  COUNT(DISTINCT m.id) FILTER (WHERE m.movement_type = 'RECEPCION') AS recepciones,
  SUM(m.quantity) FILTER (WHERE m.movement_type = 'TRASPASO') AS uds_enviadas,
  SUM(m.quantity) FILTER (WHERE m.movement_type = 'RECEPCION') AS uds_recibidas
FROM inventory_movements m
WHERE m.movement_type IN ('TRASPASO', 'RECEPCION')
GROUP BY TO_CHAR(m.created_at, 'YYYY-MM')
ORDER BY mes DESC;

-- 9. Top transferred products by volume
CREATE OR REPLACE VIEW public.vw_intercompany_top_products AS
SELECT
  m.product_code,
  m.product_description,
  COUNT(*) FILTER (WHERE m.movement_type = 'TRASPASO') AS veces_enviado,
  COUNT(*) FILTER (WHERE m.movement_type = 'RECEPCION') AS veces_recibido,
  SUM(m.quantity) FILTER (WHERE m.movement_type = 'TRASPASO') AS total_enviado,
  SUM(m.quantity) FILTER (WHERE m.movement_type = 'RECEPCION') AS total_recibido,
  COALESCE(SUM(m.quantity) FILTER (WHERE m.movement_type = 'TRASPASO'), 0) -
  COALESCE(SUM(m.quantity) FILTER (WHERE m.movement_type = 'RECEPCION'), 0) AS diferencia,
  (SELECT COALESCE(precio_referencia, 0) FROM products p WHERE p.codigo_producto = m.product_code LIMIT 1) AS precio_referencia
FROM inventory_movements m
WHERE m.movement_type IN ('TRASPASO', 'RECEPCION')
GROUP BY m.product_code, m.product_description
ORDER BY (COALESCE(SUM(m.quantity) FILTER (WHERE m.movement_type = 'TRASPASO'), 0) +
           COALESCE(SUM(m.quantity) FILTER (WHERE m.movement_type = 'RECEPCION'), 0)) DESC;

-- 10. Monthly transfer value with estimated pricing
CREATE OR REPLACE VIEW public.vw_intercompany_monthly_value AS
SELECT
  TO_CHAR(m.created_at, 'YYYY-MM') AS mes,
  SUM(m.quantity) FILTER (WHERE m.movement_type = 'TRASPASO') AS uds_enviadas,
  SUM(m.quantity) FILTER (WHERE m.movement_type = 'RECEPCION') AS uds_recibidas,
  COUNT(*) FILTER (WHERE m.movement_type = 'TRASPASO') AS traslados,
  COUNT(*) FILTER (WHERE m.movement_type = 'RECEPCION') AS recepciones,
  SUM(m.quantity * COALESCE(p.precio_referencia, 0)) FILTER (WHERE m.movement_type = 'TRASPASO') AS valor_enviado_usd,
  SUM(m.quantity * COALESCE(p.precio_referencia, 0)) FILTER (WHERE m.movement_type = 'RECEPCION') AS valor_recibido_usd
FROM inventory_movements m
LEFT JOIN products p ON p.codigo_producto = m.product_code
WHERE m.movement_type IN ('TRASPASO', 'RECEPCION')
GROUP BY TO_CHAR(m.created_at, 'YYYY-MM')
ORDER BY mes DESC;

-- 11. Inventory impact of transfers
CREATE OR REPLACE VIEW public.vw_intercompany_inventory_impact AS
WITH product_stock AS (
  SELECT codigo_producto,
    COALESCE(stock_boleita, 0) AS stock_boleita,
    COALESCE(stock_sabana_grande, 0) AS stock_sabana_grande
  FROM products
),
transfer_totals AS (
  SELECT
    m.product_code,
    COALESCE(SUM(m.quantity) FILTER (WHERE m.movement_type = 'TRASPASO' AND m.branch = 'BOLEITA'), 0) AS enviado_desde_boleita,
    COALESCE(SUM(m.quantity) FILTER (WHERE m.movement_type = 'RECEPCION' AND m.branch = 'BOLEITA'), 0) AS recibido_en_boleita,
    COALESCE(SUM(m.quantity) FILTER (WHERE m.movement_type = 'TRASPASO' AND m.branch = 'SABANA GRANDE'), 0) AS enviado_desde_sabana,
    COALESCE(SUM(m.quantity) FILTER (WHERE m.movement_type = 'RECEPCION' AND m.branch = 'SABANA GRANDE'), 0) AS recibido_en_sabana
  FROM inventory_movements m
  WHERE m.movement_type IN ('TRASPASO', 'RECEPCION')
  GROUP BY m.product_code
)
SELECT
  ps.codigo_producto,
  ps.stock_boleita,
  ps.stock_sabana_grande,
  tt.enviado_desde_boleita,
  tt.recibido_en_boleita,
  tt.enviado_desde_sabana,
  tt.recibido_en_sabana,
  CASE WHEN ps.stock_boleita > 0
    THEN ROUND((tt.recibido_en_boleita::numeric / GREATEST(ps.stock_boleita, 1)) * 100, 1)
    ELSE 0 END AS pct_stock_boleita_desde_traspasos,
  CASE WHEN ps.stock_sabana_grande > 0
    THEN ROUND((tt.recibido_en_sabana::numeric / GREATEST(ps.stock_sabana_grande, 1)) * 100, 1)
    ELSE 0 END AS pct_stock_sabana_desde_traspasos
FROM product_stock ps
LEFT JOIN transfer_totals tt ON tt.product_code = ps.codigo_producto
WHERE (tt.enviado_desde_boleita + tt.recibido_en_boleita + tt.enviado_desde_sabana + tt.recibido_en_sabana) > 0
ORDER BY (tt.enviado_desde_boleita + tt.enviado_desde_sabana) DESC;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.accounts_payable ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_initial_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashea_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashier_closings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.couriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.envios_nacionales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payable_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transferencias_internas_v4 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_quick_replies ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow all on accounts_payable" ON public.accounts_payable;
  DROP POLICY IF EXISTS "Allow all on payable_payments" ON public.payable_payments;
  DROP POLICY IF EXISTS "Allow authenticated users to select inventory_movements" ON public.inventory_movements;
  DROP POLICY IF EXISTS "Allow authenticated users to insert inventory_movements" ON public.inventory_movements;
  DROP POLICY IF EXISTS "Allow authenticated read for cashea" ON public.cashea_installments;
  DROP POLICY IF EXISTS "Allow authenticated update for cashea" ON public.cashea_installments;
  DROP POLICY IF EXISTS "Allow authenticated insert for cashea" ON public.cashea_installments;
  DROP POLICY IF EXISTS "Allow public read for customers" ON public.customers;
  DROP POLICY IF EXISTS "Allow all for customers" ON public.customers;
  DROP POLICY IF EXISTS "Allow public read for sellers" ON public.sellers;
  DROP POLICY IF EXISTS "Allow public read for couriers" ON public.couriers;
  DROP POLICY IF EXISTS "Allow authenticated insert for couriers" ON public.couriers;
  DROP POLICY IF EXISTS "Allow all for wa_instances" ON public.wa_instances;
  DROP POLICY IF EXISTS "Allow all for wa_conversations" ON public.wa_conversations;
  DROP POLICY IF EXISTS "Allow all for wa_messages" ON public.wa_messages;
  DROP POLICY IF EXISTS "Allow all for wa_quick_replies" ON public.wa_quick_replies;
  DROP POLICY IF EXISTS "Todos pueden ver envios nacionales" ON public.envios_nacionales;
  DROP POLICY IF EXISTS "Todos pueden crear envios nacionales" ON public.envios_nacionales;
  DROP POLICY IF EXISTS "Todos pueden actualizar envios nacionales" ON public.envios_nacionales;
  DROP POLICY IF EXISTS "Allow all operations on deliveries" ON public.deliveries;
  DROP POLICY IF EXISTS "Supervisores pueden ver todo" ON public.cashier_closings;
  DROP POLICY IF EXISTS "Cajeros pueden ver sus propios cierres" ON public.cashier_closings;
  DROP POLICY IF EXISTS "Cajeros pueden crear sus propios cierres" ON public.cashier_closings;
  DROP POLICY IF EXISTS "Allow all for authenticated v4" ON public.transferencias_internas_v4;
  DROP POLICY IF EXISTS "Allow all for anon v4" ON public.transferencias_internas_v4;
  DROP POLICY IF EXISTS "Enable read for admin on bank_audit_logs" ON public.bank_audit_logs;
  DROP POLICY IF EXISTS "Enable all admin on bank_initial_balances" ON public.bank_initial_balances;
  DROP POLICY IF EXISTS "Permitir lectura a usuarios autenticados" ON public.support_messages;
  DROP POLICY IF EXISTS "Permitir inserción a usuarios autenticados" ON public.support_messages;
EXCEPTION WHEN undefined_table THEN null;
END $$;

-- Recreate policies
CREATE POLICY "Allow all on accounts_payable" ON public.accounts_payable FOR ALL USING (true);
CREATE POLICY "Allow all on payable_payments" ON public.payable_payments FOR ALL USING (true);
CREATE POLICY "Allow authenticated users to select inventory_movements" ON public.inventory_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to insert inventory_movements" ON public.inventory_movements FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated read for cashea" ON public.cashea_installments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated update for cashea" ON public.cashea_installments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated insert for cashea" ON public.cashea_installments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow public read for customers" ON public.customers FOR SELECT USING (true);
CREATE POLICY "Allow all for customers" ON public.customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read for sellers" ON public.sellers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow public read for couriers" ON public.couriers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert for couriers" ON public.couriers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow all for wa_instances" ON public.wa_instances FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for wa_conversations" ON public.wa_conversations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for wa_messages" ON public.wa_messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for wa_quick_replies" ON public.wa_quick_replies FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Todos pueden ver envios nacionales" ON public.envios_nacionales FOR SELECT USING (true);
CREATE POLICY "Todos pueden crear envios nacionales" ON public.envios_nacionales FOR INSERT WITH CHECK (true);
CREATE POLICY "Todos pueden actualizar envios nacionales" ON public.envios_nacionales FOR UPDATE USING (true);
CREATE POLICY "Allow all operations on deliveries" ON public.deliveries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Supervisores pueden ver todo" ON public.cashier_closings FOR ALL USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND role IN ('director', 'supervisor', 'administrador')));
CREATE POLICY "Cajeros pueden ver sus propios cierres" ON public.cashier_closings FOR SELECT USING (cajero_email = auth.jwt()->>'email');
CREATE POLICY "Cajeros pueden crear sus propios cierres" ON public.cashier_closings FOR INSERT WITH CHECK (cajero_email = auth.jwt()->>'email');
CREATE POLICY "Allow all for authenticated v4" ON public.transferencias_internas_v4 FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon v4" ON public.transferencias_internas_v4 FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Enable read for admin on bank_audit_logs" ON public.bank_audit_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable all admin on bank_initial_balances" ON public.bank_initial_balances FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permitir lectura a usuarios autenticados" ON public.support_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir inserción a usuarios autenticados" ON public.support_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);

-- Grant permissions on views
GRANT SELECT ON public.v_erp_stock_by_branch TO anon, authenticated;
GRANT SELECT ON public.v_latest_stock_by_branch TO anon, authenticated;
GRANT SELECT ON public.v_support_tickets TO anon, authenticated;
GRANT SELECT ON public.v_transferencias_final_v4 TO anon, authenticated, service_role;

-- Grant all on audit/initial balance tables
GRANT ALL ON public.bank_audit_logs TO authenticated, service_role;
GRANT ALL ON public.bank_initial_balances TO authenticated, service_role;
GRANT ALL ON public.transferencias_internas_v4 TO postgres, anon, authenticated, service_role;

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Sellers
INSERT INTO public.sellers (name) VALUES
('ANAITZA FUENTES'), ('Vendedor'), ('LUIS DELGADO'), ('ML'), ('ROBERTO ARRIOJA'),
('ENGERLYNT BELLO'), ('Antoan Ysea'), ('DANIELA ESCALONA'), ('TIENDA BOLEITA'),
('CARLOS VALBUENA'), ('VENTAS MOTOSIETE'), ('MARKETPLACE'), ('YESENIA ACOSTA'),
('VENTAS INTERNAS A MOTOSIETE'), ('TIENDA CHACAO'), ('TIENDA SABANA GRANDE'),
('OSCAR PEREZ'), ('VENTAS INTERNAS A CHACAO'), ('YUKKAZO')
ON CONFLICT (name) DO NOTHING;

-- FORDMAC default config
INSERT INTO public.fordmac_config (id, weight_lead_time, weight_fill_rate, weight_punctuality)
VALUES (1, 0.40, 0.35, 0.25)
ON CONFLICT (id) DO NOTHING;

-- WhatsApp quick replies
INSERT INTO public.wa_quick_replies (category, title, content) VALUES
('precios', 'Solicitar CI/RIF', 'Hola, para poder cotizarte necesito que me indiques tu cédula o RIF para buscar en el sistema.'),
('precios', 'Precio no disponible', 'Disculpa, ese producto no lo tenemos disponible actualmente. ¿Te interesa alguna alternativa similar?'),
('precios', 'Consultar precio', 'Déjame consultar el precio actualizado y te confirmo en breves.'),
('horarios', 'Horarios Boleita', 'Estamos en Boleita de Lun-Vie 8am-5pm y Sáb 8am-1pm.'),
('horarios', 'Horarios Sabana Grande', 'Estamos en Sabana Grande de Lun-Vie 8am-5pm y Sáb 8am-1pm.'),
('horarios', 'Ambos horarios', 'Nuestro horario es: Lun-Vie 8am-5pm, Sáb 8am-1pm. Ambos locales.'),
('delivery', 'Costo delivery', 'El delivery tiene un costo de $2.00, depende de la zona. ¿Cuál es tu dirección para confirmar?'),
('delivery', 'Tiempo delivery', 'Normalmente los entregamos el mismo día o al día siguiente, dependiendo de la zona y la hora del pedido.'),
('delivery', 'Zonas disponibles', 'Hacemos entregas en toda Caracas. Dime tu municipio y zona para confirmar la cobertura.'),
('pagos', 'Métodos de pago', 'Aceptamos: Efectivo ($ o Bs), Punto de Venta, Pago Móvil, Transferencia y Zelle.'),
('pagos', 'Transferencia datos', 'Nuestros datos bancarios te los envía el cajero al momento de generar la factura.'),
('pagos', 'Cashea explicación', 'Manejamos Cashea: pagas un inicial y el saldo lo cancelas después. Pregunta por las condiciones con tu vendedor.'),
('promociones', 'Enviar promos', 'Te envío las promociones que tenemos disponibles actualmente. ¿Qué tipo de pieza buscas?'),
('promociones', 'Sin promos activas', 'Por ahora no tenemos promociones activas, pero los precios ya están competitivos. ¿Qué necesitas?'),
('general', 'Derivar a vendedor', 'Déjame pasarte con el vendedor para que te dé una atención más personalizada.'),
('general', 'Solicitar datos cliente', '¿Me indicas tu nombre completo y teléfono para abrirte un expediente en nuestro sistema?'),
('general', 'Agradecimiento', 'Gracias por tu preferencia. Quedamos atentos a cualquier otra consulta.')
ON CONFLICT DO NOTHING;

-- 49. API TOKENS (for machine-to-machine integrations)
CREATE TABLE IF NOT EXISTS public.api_tokens (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  name text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone,
  last_used_at timestamp with time zone,
  last_ip text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  CONSTRAINT api_tokens_pkey PRIMARY KEY (id)
);

-- Inter-company suppliers for transfers between branches
INSERT INTO public.suppliers (supplier_code, supplier_name, is_active) VALUES
('RG7-INTER', 'AUTOPARTES RG7, C.A.', true),
('IMS-INTER', 'IMPORTMOTOSIETE, C.A.', true)
ON CONFLICT (supplier_code) DO NOTHING;

-- Realtime publication (ensure support_messages is included)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.support_messages;

-- 39. TRANSFER DRAFTS (Inter-empresas)
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
CREATE POLICY "users_own_drafts" ON public.transfer_drafts
  USING (created_by = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- 40. PHYSICAL INVENTORY (Conteo Físico)
CREATE TABLE IF NOT EXISTS public.physical_inventory (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  branch text NOT NULL,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'completed')),
  created_by text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT physical_inventory_pkey PRIMARY KEY (id)
);
ALTER TABLE public.physical_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "physical_inventory_all" ON public.physical_inventory
  FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS public.physical_inventory_lines (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  inventory_id bigint NOT NULL REFERENCES physical_inventory(id) ON DELETE CASCADE,
  codigo_producto text NOT NULL REFERENCES products(codigo_producto),
  descripcion text,
  sistema_qty numeric NOT NULL DEFAULT 0,
  fisico_qty numeric,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT physical_inventory_lines_pkey PRIMARY KEY (id),
  CONSTRAINT pil_unique UNIQUE (inventory_id, codigo_producto)
);
ALTER TABLE public.physical_inventory_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "physical_inventory_lines_all" ON public.physical_inventory_lines
  FOR ALL USING (true);

CREATE OR REPLACE VIEW public.vw_physical_inventory_suggestions AS
SELECT p.codigo_producto, p.descripcion, p.stock_boleita, p.stock_sabana_grande,
       MAX(pi.completed_at) as last_counted_at
FROM products p
LEFT JOIN physical_inventory_lines pil ON pil.codigo_producto = p.codigo_producto
LEFT JOIN physical_inventory pi ON pi.id = pil.inventory_id AND pi.status = 'completed'
GROUP BY p.codigo_producto, p.descripcion, p.stock_boleita, p.stock_sabana_grande
HAVING MAX(pi.completed_at) IS NULL 
    OR MAX(pi.completed_at) < NOW() - INTERVAL '7 days';

-- Dashboard de inventario para directores
DROP VIEW IF EXISTS public.vw_inventory_dashboard_stats;
CREATE OR REPLACE VIEW public.vw_inventory_dashboard_stats AS
WITH inventory_value AS (
    SELECT
        SUM(COALESCE(p.stock_boleita, 0) * COALESCE(p.precio_referencia, 0)) AS valor_boleita,
        SUM(COALESCE(p.stock_sabana_grande, 0) * COALESCE(p.precio_referencia, 0)) AS valor_sabana,
        SUM(COALESCE(p.stock_boleita, 0) * COALESCE(p.costo, 0)) AS valor_costo_boleita,
        SUM(COALESCE(p.stock_sabana_grande, 0) * COALESCE(p.costo, 0)) AS valor_costo_sabana,
        COUNT(*) FILTER (WHERE COALESCE(p.stock_boleita, 0) = 0 AND COALESCE(p.stock_sabana_grande, 0) = 0) AS sku_cero,
        COUNT(*) FILTER (
            WHERE COALESCE(p.stock_boleita, 0) + COALESCE(p.stock_sabana_grande, 0) > 0
            AND COALESCE(p.stock_boleita, 0) + COALESCE(p.stock_sabana_grande, 0) < 7
        ) AS sku_bajo,
        COUNT(*) AS total_sku,
        COUNT(*) FILTER (WHERE p.costo IS NOT NULL AND p.costo > 0) AS sku_con_costo
    FROM public.products p
), last_count AS (
    SELECT
        COALESCE(COUNT(DISTINCT pil.codigo_producto), 0) AS productos_contados,
        COALESCE(COUNT(DISTINCT pil.codigo_producto) FILTER (WHERE pil.fisico_qty = pil.sistema_qty), 0) AS productos_ok,
        COALESCE(SUM(ABS(COALESCE(pil.fisico_qty, 0) - pil.sistema_qty)), 0) AS discrepancia_total,
        MAX(pi.completed_at) AS ultimo_conteo
    FROM public.physical_inventory pi
    JOIN public.physical_inventory_lines pil ON pil.inventory_id = pi.id
    WHERE pi.status = 'completed'
), recent_movements AS (
    SELECT
        COUNT(*) AS movs_semana,
        COUNT(*) FILTER (WHERE movement_type = 'CARGO') AS cargos_semana,
        COUNT(*) FILTER (WHERE movement_type = 'DESCARGO') AS descargos_semana
    FROM public.inventory_movements
    WHERE created_at >= NOW() - INTERVAL '7 days'
)
SELECT
    iv.valor_boleita, iv.valor_sabana, iv.valor_boleita + iv.valor_sabana AS valor_total,
    iv.valor_costo_boleita, iv.valor_costo_sabana, iv.valor_costo_boleita + iv.valor_costo_sabana AS valor_costo_total,
    iv.total_sku, iv.sku_cero, iv.sku_bajo, iv.sku_con_costo,
    ROUND(100.0 * iv.sku_cero / NULLIF(iv.total_sku, 0), 1) AS pct_sku_cero,
    ROUND(100.0 * iv.sku_bajo / NULLIF(iv.total_sku, 0), 1) AS pct_sku_bajo,
    ROUND(100.0 * iv.sku_con_costo / NULLIF(iv.total_sku, 0), 1) AS pct_con_costo,
    COALESCE(lc.productos_contados, 0) AS productos_contados,
    COALESCE(lc.productos_ok, 0) AS productos_ok,
    ROUND(100.0 * COALESCE(lc.productos_ok, 0) / NULLIF(COALESCE(lc.productos_contados, 0), 0), 1) AS precision_pct,
    COALESCE(lc.discrepancia_total, 0) AS discrepancia_total,
    lc.ultimo_conteo,
    COALESCE(rm.movs_semana, 0) AS movs_semana,
    COALESCE(rm.cargos_semana, 0) AS cargos_semana,
    COALESCE(rm.descargos_semana, 0) AS descargos_semana
FROM inventory_value iv
CROSS JOIN last_count lc
CROSS JOIN recent_movements rm;

CREATE OR REPLACE VIEW public.vw_inventory_top_discrepancias AS
SELECT
    pil.codigo_producto,
    p.descripcion,
    pil.sistema_qty,
    pil.fisico_qty,
    ABS(pil.fisico_qty - pil.sistema_qty) AS diferencia,
    pil.fisico_qty - pil.sistema_qty AS neto,
    pi.branch,
    pi.completed_at
FROM public.physical_inventory_lines pil
JOIN public.physical_inventory pi ON pi.id = pil.inventory_id
LEFT JOIN public.products p ON p.codigo_producto = pil.codigo_producto
WHERE pi.status = 'completed' AND pil.fisico_qty IS NOT NULL
ORDER BY ABS(pil.fisico_qty - pil.sistema_qty) DESC;

-- Physical inventory complete → create CARGO/DESCARGO movements
CREATE OR REPLACE FUNCTION public.sync_inventory_to_movements()
RETURNS TRIGGER AS $$
DECLARE
    line RECORD;
    diff NUMERIC;
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        FOR line IN 
            SELECT pil.codigo_producto, pil.descripcion, pil.sistema_qty, pil.fisico_qty
            FROM public.physical_inventory_lines pil
            WHERE pil.inventory_id = NEW.id AND pil.fisico_qty IS NOT NULL
        LOOP
            diff := line.fisico_qty - line.sistema_qty;
            IF diff != 0 THEN
                INSERT INTO public.inventory_movements
                    (branch, product_code, product_description, movement_type, quantity, reason, notes, user_email)
                VALUES (
                    NEW.branch, line.codigo_producto, line.descripcion,
                    CASE WHEN diff > 0 THEN 'CARGO' ELSE 'DESCARGO' END,
                    ABS(diff), 'Inventario Físico',
                    'Ajuste por conteo. Sistema: ' || line.sistema_qty || ', Físico: ' || line.fisico_qty,
                    NEW.created_by
                );
            END IF;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_inventory_to_movements ON public.physical_inventory;
CREATE TRIGGER trg_sync_inventory_to_movements
AFTER UPDATE OF status ON public.physical_inventory
FOR EACH ROW
EXECUTE FUNCTION public.sync_inventory_to_movements();

-- PO complete → sync costo from unit price
CREATE OR REPLACE FUNCTION public.sync_costo_on_po_complete()
RETURNS TRIGGER AS $$
DECLARE
    line RECORD;
BEGIN
    IF NEW.status = 'COMPLETED' AND OLD.status != 'COMPLETED' THEN
        FOR line IN 
            SELECT pol.codigo_producto, pol.precio_unitario_usd
            FROM public.purchase_order_lines pol
            WHERE pol.order_id = NEW.id AND pol.precio_unitario_usd IS NOT NULL
        LOOP
            IF line.precio_unitario_usd > 0 THEN
                UPDATE public.products
                SET costo = line.precio_unitario_usd
                WHERE codigo_producto = line.codigo_producto
                  AND (costo IS NULL OR costo != line.precio_unitario_usd);
            END IF;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_costo_on_po_complete ON public.purchase_orders;
CREATE TRIGGER trg_sync_costo_on_po_complete
AFTER UPDATE OF status ON public.purchase_orders
FOR EACH ROW
EXECUTE FUNCTION public.sync_costo_on_po_complete();

-- PO cancel → revert stock comprometido
DROP TRIGGER IF EXISTS trg_revert_stock_on_po_cancel ON public.purchase_orders;
CREATE TRIGGER trg_revert_stock_on_po_cancel
AFTER UPDATE OF status ON public.purchase_orders
FOR EACH ROW
EXECUTE FUNCTION public.revert_stock_on_po_cancel();

-- ============================================================================
-- NOTIFY PostgREST to reload schema cache
-- ============================================================================
NOTIFY pgrst, 'reload schema';
