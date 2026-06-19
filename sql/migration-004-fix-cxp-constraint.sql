-- Fase 4: Fix unique constraint para ON CONFLICT en sync_purchase_to_cxp
-- Ejecutar DESPUÉS de migration-001, migration-002, migration-003

-- 1. Eliminar duplicados si existen (por si acaso)
DELETE FROM public.accounts_payable a
WHERE a.ctid <> (
  SELECT min(b.ctid)
  FROM public.accounts_payable b
  WHERE (b.purchase_source, b.branch, b.purchase_doc) IS NOT NULL
    AND (b.purchase_source, b.branch, b.purchase_doc) = (a.purchase_source, a.branch, a.purchase_doc)
);

-- 2. Agregar unique constraint que necesita el ON CONFLICT del trigger
ALTER TABLE public.accounts_payable
ADD CONSTRAINT accounts_payable_doc_unique UNIQUE (purchase_source, branch, purchase_doc);

NOTIFY pgrst, 'reload schema';
