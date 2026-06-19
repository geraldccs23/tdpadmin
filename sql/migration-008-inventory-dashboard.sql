-- Migration 008: Auto ajustes de inventario físico + Dashboard
-- Ejecutar en Supabase Studio → SQL Editor

-- 1. Trigger: al completar inventario físico, crear CARGO/DESCARGO por producto
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

-- 2. Vista: dashboard de inventario para directores
CREATE OR REPLACE VIEW public.vw_inventory_dashboard_stats AS
WITH inventory_value AS (
    SELECT
        SUM(COALESCE(p.stock_boleita, 0) * COALESCE(p.precio_referencia, 0)) AS valor_boleita,
        SUM(COALESCE(p.stock_sabana_grande, 0) * COALESCE(p.precio_referencia, 0)) AS valor_sabana,
        COUNT(*) FILTER (WHERE COALESCE(p.stock_boleita, 0) = 0 AND COALESCE(p.stock_sabana_grande, 0) = 0) AS sku_cero,
        COUNT(*) FILTER (
            WHERE COALESCE(p.stock_boleita, 0) + COALESCE(p.stock_sabana_grande, 0) > 0
            AND COALESCE(p.stock_boleita, 0) + COALESCE(p.stock_sabana_grande, 0) < 7
        ) AS sku_bajo,
        COUNT(*) AS total_sku
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
    iv.total_sku, iv.sku_cero, iv.sku_bajo,
    ROUND(100.0 * iv.sku_cero / NULLIF(iv.total_sku, 0), 1) AS pct_sku_cero,
    ROUND(100.0 * iv.sku_bajo / NULLIF(iv.total_sku, 0), 1) AS pct_sku_bajo,
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

-- 3. Vista: top discrepancias por producto
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

NOTIFY pgrst, 'reload schema';
