-- Migration 003: Inter-company Dashboard Views

-- View: Transfer orders with receipt summary
CREATE OR REPLACE VIEW vw_intercompany_orders AS
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

-- View: Movement summary by product between branches
CREATE OR REPLACE VIEW vw_intercompany_product_movements AS
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

-- View: Pending inter-company payables
CREATE OR REPLACE VIEW vw_intercompany_payables AS
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

-- View: Monthly transfer summary
CREATE OR REPLACE VIEW vw_intercompany_monthly_summary AS
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

-- View: Top transferred products by volume
CREATE OR REPLACE VIEW vw_intercompany_top_products AS
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

-- View: Monthly transfer value
CREATE OR REPLACE VIEW vw_intercompany_monthly_value AS
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

-- View: Inventory impact of transfers (how much of current stock came from transfers)
CREATE OR REPLACE VIEW vw_intercompany_inventory_impact AS
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

NOTIFY pgrst, 'reload schema';
