import { Product, Supplier, PurchaseLine, SalesLine, SyncLog } from '../types';

export const mockProducts: Product[] = [
  { id: '1', codigo_producto: 'TOY-FIL-001', descripcion: 'Filtro de Aceite Toyota', brand_name: 'Toyota', stock: 15, minStock: 10 },
  { id: '2', codigo_producto: 'FOR-BRA-005', descripcion: 'Pastillas de Freno F-150', brand_name: 'Ford', stock: 5, minStock: 12 },
  { id: '3', codigo_producto: 'CHV-SPA-010', descripcion: 'Bujías Chevrolet Spark', brand_name: 'Chevrolet', stock: 45, minStock: 20 },
  { id: '4', codigo_producto: 'MAZ-SHK-002', descripcion: 'Amortiguador Mazda 3', brand_name: 'Mazda', stock: 8, minStock: 10 },
  { id: '5', codigo_producto: 'HYU-BEL-008', descripcion: 'Correa de Tiempo Tucson', brand_name: 'Hyundai', stock: 3, minStock: 5 }
];

export const mockSuppliers: Supplier[] = [
  { supplier_code: 's1', supplier_name: 'Importadora Automotriz CA', is_active: true, avgLeadTime: 7.2, fillRate: 0.95, punctuality: 0.98, stars: 4.8 },
  { supplier_code: 's2', supplier_name: 'Ford Motors de Venezuela', is_active: true, avgLeadTime: 22.5, fillRate: 0.88, punctuality: 0.82, stars: 4.1 },
  { supplier_code: 's3', supplier_name: 'Repuestos Chinos Express', is_active: true, avgLeadTime: 48.0, fillRate: 0.40, punctuality: 0.35, stars: 1.5 }
];

export const mockPurchaseLines: PurchaseLine[] = [
  { id: 'oc-001', fuente: 'MOCK', sucursal: 'Boleita', proveedor_codigo: 's1', proveedor_nombre: 'Importadora Automotriz CA', numero_documento: 'OC-001', fecha_hora: '2023-11-01', codigo_producto: 'TOY-FIL-001', descripcion: 'Filtro de Aceite Toyota', cantidad: 10, costo_usd: 125.00, tipo_documento: 'ORDEN' },
  { id: 'oc-002', fuente: 'MOCK', sucursal: 'Boleita', proveedor_codigo: 's2', proveedor_nombre: 'Ford Motors de Venezuela', numero_documento: 'OC-002', fecha_hora: '2023-10-15', codigo_producto: 'FOR-BRA-005', descripcion: 'Pastillas de Freno F-150', cantidad: 20, costo_usd: 840.00, tipo_documento: 'COMPRA' }
];

export const mockSalesLines: SalesLine[] = [
  { id: 'ne-001', fuente: 'MOCK', sucursal: 'Boleita', numero_documento: 'NE-001', fecha_hora: '2023-11-10', nombre_cliente: 'Taller Perez', codigo_producto: 'TOY-FIL-001', descripcion: 'Filtro de Aceite Toyota', cantidad: 2, total_usd: 30.00, tipo_documento: 'NOTA_ENTREGA' }
];

export const mockSyncLogs: SyncLog[] = [
  { id: '1', eventType: 'ERP_NE_SALE_POSTED', payload: { id: 'NE-001' }, status: 'SENT', createdAt: '2023-11-10 09:00:00' },
  { id: '2', eventType: 'ERP_NE_PURCHASE_POSTED', payload: { id: 'OC-001' }, status: 'SENT', createdAt: '2023-11-10 10:30:00' },
  { id: '3', eventType: 'SAINT_FISCAL_INVOICE_POSTED', payload: { id: 'FAC-001' }, status: 'ERROR', lastError: 'Timeout', createdAt: '2023-11-10 11:15:00' }
];
