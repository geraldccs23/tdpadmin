-- Fase 2: Proveedores Inter-company para Traspasos
-- Ejecutar en Supabase Studio → SQL Editor

INSERT INTO public.suppliers (supplier_code, supplier_name, is_active)
VALUES ('RG7-INTER', 'AUTOPARTES RG7, C.A.', true)
ON CONFLICT (supplier_code) DO NOTHING;

INSERT INTO public.suppliers (supplier_code, supplier_name, is_active)
VALUES ('IMS-INTER', 'IMPORTMOTOSIETE, C.A.', true)
ON CONFLICT (supplier_code) DO NOTHING;

NOTIFY pgrst, 'reload schema';
