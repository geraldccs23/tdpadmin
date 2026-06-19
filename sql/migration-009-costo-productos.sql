-- Migration 009: Costo de productos
-- Ejecutar en Supabase Studio → SQL Editor

-- 1. Agregar columna costo a products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS costo NUMERIC(12,2);

-- 2. Trigger: al completar PO, actualizar costo del producto desde precio_unitario_usd
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

-- 3. Actualizar vista del dashboard con valor a costo
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

NOTIFY pgrst, 'reload schema';
