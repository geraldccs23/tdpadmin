export interface Product {
  id: string;
  codigo_producto: string;
  descripcion?: string;
  modelo?: string;
  ref?: string;
  precio_usd?: number;
  precio_bs?: number;
  tasa_ref?: number;
  brand_code?: number;
  brand_name?: string;
  supplier_code?: string;
  stock?: number;
  minStock: number;
  precio_referencia?: number;
  stock_boleita?: number;
  stock_sabana_grande?: number;
}

export interface Supplier {
  supplier_code: string;
  supplier_name: string;
  is_active: boolean;
  rif?: string;
  phone?: string;
  email?: string;
  address?: string;
  contact_name?: string;
  avgLeadTime?: number;
  fillRate?: number;
  punctuality?: number;
  stars?: number;
}

export interface PurchaseLine {
  id: string;
  fuente: string;
  fecha_hora: string;
  tipo_documento: string;
  numero_documento: string;
  sucursal: string;
  proveedor_codigo?: string;
  proveedor_nombre?: string;
  codigo_producto: string;
  descripcion?: string;
  cantidad: number;
  costo_bs?: number;
  costo_usd: number;
  tasa_original?: number;
  tasa_ref_dia?: number;
  tasa_final?: number;
  tasa_es_valida?: boolean;
}

export interface SalesLine {
  id: string;
  fuente: string;
  fecha_hora: string;
  tipo_documento: string;
  numero_documento: string;
  sucursal: string;
  codigo_cliente?: string;
  nombre_cliente?: string;
  codigo_vendedor?: string;
  vendedor?: string;
  codigo_producto: string;
  descripcion?: string;
  barra_referencia?: string;
  marca_producto?: string;
  categoria_mapeada?: string;
  categoria_tipo?: string;
  tasa?: number;
  precio_bs?: number;
  precio_usd?: number;
  cantidad: number;
  total_bs?: number;
  total_usd: number;
}

export interface SyncLog {
  id: string;
  eventType: string;
  payload: any;
  status: 'PENDING' | 'SENT' | 'ERROR';
  lastError?: string;
  createdAt: string;
}

export interface CasheaInstallment {
  id: number;
  income_id: number;
  installment_number: number;
  amount_usd: number;
  status: 'pending' | 'paid';
  due_date?: string;
  created_at: string;
  paid_at?: string;
}

export interface Seller {
  id: number;
  name: string;
  active: boolean;
  created_at: string;
}

export interface Courier {
  id: number;
  name: string;
  phone?: string;
  active: boolean;
  created_at: string;
}

export interface Bank {
  code: string;
  name: string;
  created_at?: string;
}

export interface BankAccount {
  id: number;
  bank_code: string;
  reference: string;
  payment_types: string[];
  balance: number;
  sucursal: BranchType;
  created_at?: string;
}

export interface BankInitialBalance {
  id: number;
  bank_account_id: number;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
  bank_accounts?: BankAccount; // For joins
}

export type PaymentCondition = 'Contado' | 'Inicial de Cashea' | 'Credito';
export type BranchType = 'Boleita' | 'Sabana Grande';

export interface Income {
  id: number;
  branch: BranchType;
  type: 'Venta' | 'Devolucion';
  document_type: string;
  document_number: string;
  payment_condition: PaymentCondition;
  customer_id?: string;
  customer_name?: string;
  customer_phone?: string;
  total_amount: number;
  discount_usd?: number;
  seller_id?: number;
  delivery_method?: string;
  courier_id?: number;
  cash_register?: string;
  shipping_agency?: string;
  created_at: string;
}

export interface IncomeLine {
  id: number;
  income_id: number;
  codigo_producto: string;
  descripcion?: string;
  cantidad: number;
  precio_unitario_usd: number;
  precio_original_usd?: number;
  descuento_usd?: number;
  total_linea_usd: number;
  created_at: string;
}

export interface IncomePayment {
  id: number;
  income_id: number;
  payment_type: string;
  amount: number;
  exchange_rate?: number;
  amount_bs?: number;
  bank_account_id?: number;
  created_at: string;
}

export interface ExpenseRecipient {
  id: number;
  type: string;
  name: string;
  document_id?: string;
  phone?: string;
  created_at: string;
}

export interface Expense {
  id: number;
  branch: BranchType;
  recipient_id: number;
  concept: string;
  payment_type: string;
  bank_account_id?: number;
  amount: number;
  exchange_rate?: number;
  amount_bs?: number;
  created_at: string;
}

export interface BankTransfer {
  id: number;
  from_account_id: number;
  to_account_id: number;
  amount: number;
  reference?: string;
  notes?: string;
  created_at: string;
}

export interface PurchaseOrder {
  id: number;
  numero_orden: string;
  supplier_code?: string;
  provider_name?: string; // We'll join this or store it in a view
  status: 'PENDING' | 'PARTIAL' | 'COMPLETED' | 'CANCELLED';
  total_amount_usd: number;
  notes?: string;
  created_at: string;
  sucursal: BranchType;
  items?: PurchaseOrderLine[];
}

export interface PurchaseOrderLine {
  id: number;
  order_id: number;
  codigo_producto: string;
  description?: string;
  cantidad_pedida: number;
  cantidad_recibida: number;
  precio_unitario_usd: number;
  total_linea_usd: number;
}


export interface SupportTicket {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: 'bug' | 'feature_request' | 'support' | 'other';
  user_id: string;
  assigned_to?: string;
  branch?: string;
  created_at: string;
  updated_at: string;
  creator_email?: string;
  assigned_email?: string;
  image_url?: string;
}

export interface AccountPayable {
  id: number;
  branch: BranchType;
  provider_name: string;
  amount: number;
  amount_bs: number;
  concept: string;
  bank_account_id: number;
  status: 'pending' | 'paid';
  exchange_rate: number;
  created_at: string;
}

export interface Employee {
    id: string;
    name: string;
    branch: BranchType;
    active: boolean;
    created_at: string;
}

export interface AttendanceLog {
    id: string;
    employee_id: string;
    branch: BranchType;
    type: 'ENTRADA' | 'SALIDA';
    timestamp: string;
    device_info?: string;
    employees?: Employee; // Join
}

export interface PayablePayment {
  id: number;
  payable_id: number;
  amount: number;
  amount_bs: number;
  payment_type: string;
  exchange_rate: number;
  bank_account_id?: number;
  created_at: string;
}

export type DeliveryStatus = 'EN_PREPARACION' | 'EN_RUTA' | 'ENTREGADO' | 'FALLIDO';
export type PaymentStatus = 'PENDIENTE' | 'COBRADO' | 'LIQUIDADO';

export interface Delivery {
  id: number;
  income_id?: number | null;
  courier_id?: number;
  municipio: string;
  zona: string;
  delivery_status: DeliveryStatus;
  payment_status: PaymentStatus;
  payment_method?: string;
  notes?: string;
  timestamps_estados: {
    EN_PREPARACION?: string | null;
    EN_RUTA?: string | null;
    ENTREGADO?: string | null;
    FALLIDO?: string | null;
  };
  created_at: string;
  updated_at: string;
  incomes?: Income | null; // For joins
  couriers?: Courier; // For joins
  client_name?: string | null;
  client_phone?: string | null;
  second_phone?: string | null;
  amount_to_collect?: number;
  delivery_fee?: number;
  observations?: string | null;
  location_url?: string | null;
}

export interface DeliveryZone {
  id: number;
  municipio: string;
  zona: string;
  rate: number;
  created_at: string;
}

export interface InventoryMovement {
  id: number;
  branch: string;
  product_code: string;
  product_description?: string;
  movement_type: 'CARGO' | 'DESCARGO' | 'TRASPASO' | 'RECEPCION';
  quantity: number;
  reason: string;
  notes?: string;
  user_email?: string;
  reference_id?: string;
  created_at: string;
}
