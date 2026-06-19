-- Migration 005: Revertir stock comprometido al cancelar PO inter-empresa
-- Ejecutar en Supabase Studio → SQL Editor

-- 1. Agregar columna reference_id a inventory_movements para vincular movements con PO
ALTER TABLE public.inventory_movements
ADD COLUMN IF NOT EXISTS reference_id text;

-- 2. Función: revertir stock comprometido al cancelar PO
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

-- 3. Trigger: ejecutar al cancelar PO
DROP TRIGGER IF EXISTS trg_revert_stock_on_po_cancel ON public.purchase_orders;
CREATE TRIGGER trg_revert_stock_on_po_cancel
AFTER UPDATE OF status ON public.purchase_orders
FOR EACH ROW
EXECUTE FUNCTION public.revert_stock_on_po_cancel();

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
