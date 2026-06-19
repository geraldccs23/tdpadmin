-- Fase 1: Stock Comprometido
-- Ejecutar en Supabase Studio → SQL Editor

-- 1. Agregar columna stock_comprometido
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS stock_comprometido numeric NOT NULL DEFAULT 0;

-- 2. Actualizar trigger function
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

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
