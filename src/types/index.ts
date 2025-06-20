export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'director' | 'admin_contable' | 'gerente_tienda' | 'cajero' | 'asistente_admin';
  assigned_store_id?: string; // Para gerentes y cajeros
  phone?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  last_login?: string;
  permissions?: string[]; // Permisos específicos adicionales
}

export interface Store {
  id: string;
  name: string;
  location: string;
  address?: string;
  phone?: string;
  email?: string;
  manager_id: string;
  created_at: string;
  updated_at?: string;
  is_active: boolean;
  description?: string;
  opening_hours?: string;
  tax_id?: string;
}

export interface DailyIncome {
  id: string;
  store_id: string;
  date: string;
  amount_usd: number;
  payment_method: 'cash' | 'zelle' | 'mobile_payment' | 'pdv_banesco' | 'cashea';
  payment_details: string; // Account, terminal, etc.
  description: string;
  bcv_rate: number;
  amount_bs: number;
  created_by: string;
  created_at: string;
  store?: Store;
}

export interface DailyExpense {
  id: string;
  store_id: string;
  date: string;
  amount_bs: number;
  amount_usd: number;
  description: string;
  payment_source: 'cash' | 'zelle' | 'mobile_payment' | 'pdv_banesco' | 'cashea';
  bcv_rate: number;
  created_by: string;
  created_at: string;
  store?: Store;
}

export interface DailyClosure {
  id: string;
  store_id: string;
  date: string;
  bcv_rate: number;
  shift_name?: string; // Nombre del turno (ej: "Turno Mañana", "Turno Tarde")
  
  // Calculated totals from individual incomes
  total_cash_usd: number;
  total_zelle_usd: number;
  total_mobile_payment_usd: number;
  total_pdv_banesco_usd: number;
  total_cashea_usd: number;
  
  // Manual verification amounts
  declared_cash_usd: number;
  declared_zelle_usd: number;
  declared_mobile_payment_usd: number;
  declared_pdv_banesco_usd: number;
  declared_cashea_usd: number;
  
  // Additional info
  observations: string;
  surplus_notes: string;
  petty_cash_usd: number;
  stored_cash_usd: number;
  
  // Totals
  calculated_total_usd: number;
  declared_total_usd: number;
  total_expenses_usd: number;
  net_profit_usd: number;
  
  created_by: string;
  created_at: string;
  updated_at: string;
  store?: Store;
  incomes?: DailyIncome[];
  expenses?: DailyExpense[];
}

export interface Expense {
  id: string;
  closure_id: string;
  amount_bs: number;
  description: string;
  payment_source: 'cash' | 'zelle' | 'mobile_payment' | 'pdv_banesco' | 'cashea';
  created_at: string;
}

export interface DashboardStats {
  totalSales: number;
  totalExpenses: number;
  averageDailySales: number;
  storeCount: number;
  monthlyGrowth: number;
  topPerformingStore: string;
}

export interface ChartData {
  date: string;
  sales: number;
  expenses: number;
  profit: number;
}