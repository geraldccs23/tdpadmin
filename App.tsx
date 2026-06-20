import React, { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Truck,
  Settings as SettingsIcon,
  ArrowLeftRight,
  Database,
  History as HistoryIcon,
  Menu,
  X,
  LogOut,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Landmark,
  Wallet,
  Loader2,
  ShieldAlert,
  User,
  MessageSquare,
  Award,
  Users,
  Clock,
  QrCode,
  Globe,
  PieChart,
  DollarSign,
  Key,
  UtensilsCrossed,
  CookingPot,
  ScrollText,
  ClipboardList,
} from "lucide-react";
import { dbService } from "./services/dbService";
import { auth } from "./services/auth";
import { supabase } from "./services/supabase";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Inventory } from "./pages/Inventory";
import { Suppliers } from "./pages/Suppliers";
import { SalesNE } from "./pages/SalesNE";
import { Purchases } from "./pages/Purchases";
import { SyncLogs } from "./pages/SyncLogs";
import { Fordmac } from "./pages/Fordmac";
import { Income } from "./pages/Income";
import { Expenses } from "./pages/Expenses";
import { Banks } from "./pages/Banks";
import { AdminDashboard } from "./pages/AdminDashboard";
import { Settings as SettingsComponent } from "./pages/Settings";
import { CasheaManagement } from "./pages/CasheaManagement";
import { Customers } from "./pages/Customers";
import { InternalTransfers } from "./pages/InternalTransfers";
import { PurchaseOrders } from "./pages/PurchaseOrders";
import { CashierClosing } from "./pages/CashierClosing";
import { Support } from "./pages/Support";
import { Commissions } from "./pages/Commissions";
import { CxcManagement } from "./pages/CxcManagement";
import { CxpManagement } from "./pages/CxpManagement";
import { WarehouseManagement } from "./pages/WarehouseManagement";
import { SalesDashboard } from "./pages/SalesDashboard";
import { DeliveryDashboard } from "./pages/DeliveryDashboard";
import { SellerPerformance } from "./pages/SellerPerformance";
import { BankHistory } from "./pages/BankHistory";
import { AttendanceMark } from "./pages/AttendanceMark";
import { AttendanceAdmin } from "./pages/AttendanceAdmin";
import { AttendanceQR } from "./pages/AttendanceQR";
import { WAChat } from "./pages/WAChat";
import { NationalShippingDashboard } from "./pages/NationalShippingDashboard";
import { DirectorLogisticsDashboard } from "./pages/DirectorLogisticsDashboard";
import { ExpensesDashboard } from "./pages/ExpensesDashboard";
import { DeliveryPanel } from "./pages/DeliveryPanel";
import { ErpInventory } from "./pages/ErpInventory";
import { Integrations } from "./pages/Integrations";
import { IntercompanyModule } from "./pages/IntercompanyModule";
import { SupportBubble } from "./pages/SupportBubble";
import { InventoryDashboard } from "./pages/InventoryDashboard";
import { DashboardRestaurant } from "./pages/DashboardRestaurant";
import { MenuManagement } from "./pages/MenuManagement";
import { PublicMenu } from "./pages/PublicMenu";
import { POS } from "./pages/POS";
import { Orders } from "./pages/Orders";
import { KitchenPanel } from "./pages/KitchenPanel";
import { Ingredients } from "./pages/Ingredients";
import { Recipes } from "./pages/Recipes";
import { Users as UsersPage } from "./pages/Users";

type View =
  | "dashboard"
  | "inventory"
  | "erp_inventory"
  | "suppliers"
  | "sales"
  | "purchases"
  | "sync"
  | "settings"
  | "fordmac"
  | "income"
  | "expenses"
  | "banks"
  | "admin_dashboard"
  | "cashea"
  | "customers"
  | "cxc"
  | "cxp"
  | "internal_transfers"
  | "purchase_orders"
  | "cashier_closing"
  | "support"
  | "commissions"
  | "sales_dashboard"
  | "delivery_dashboard"
  | "seller_performance"
  | "bank_history"
  | "attendance_mark"
  | "attendance_admin"
  | "attendance_qr"
  | "national_shipping"
  | "director_logistics"
  | "expenses_dashboard"
  | "delivery_panel"
  | "warehouse"
  | "crm"
  | "integrations"
  | "intercompany"
  | "inventory_dashboard"
  | "dashboard_restaurant"
  | "menu_management"
  | "public_menu"
  | "pos"
  | "orders"
  | "kitchen_panel"
  | "ingredients"
  | "recipes"
  | "users";
export type Role =
  | "director"
  | "supervisor"
  | "supervisor_ventas"
  | "supervisor_compras"
  | "administrador"
  | "cajero"
  | "vendedor"
  | "compras"
  | "soporte"
  | "delivery"
  | "supervisor_almacen"
  | "almacenista"
  | "admin"
  | "cocina";

const rolePermissions: Record<Role, View[]> = {
  director: [
    "dashboard",
    "inventory",
    "erp_inventory",
    "suppliers",
    "sales",
    "purchases",
    "sync",
    "settings",
    "fordmac",
    "income",
    "expenses",
    "banks",
    "admin_dashboard",
    "cashea",
    "customers",
    "cxc",
    "cxp",
    "internal_transfers",
    "purchase_orders",
    "cashier_closing",
    "support",
    "commissions",
    "sales_dashboard",
    "delivery_dashboard",
    "seller_performance",
    "bank_history",
    "attendance_admin",
    "attendance_mark",
    "attendance_qr",
    "national_shipping",
    "director_logistics",
    "expenses_dashboard",
    "delivery_panel",
    "warehouse",
    "crm",
    "integrations",
    "intercompany",
    "inventory_dashboard",
  ],
  supervisor: [
    "inventory",
    "erp_inventory",
    "suppliers",
    "sales",
    "purchases",
    "sync",
    "settings",
    "fordmac",
    "income",
    "expenses",
    "banks",
    "admin_dashboard",
    "cashea",
    "customers",
    "cxc",
    "cxp",
    "internal_transfers",
    "purchase_orders",
    "cashier_closing",
    "support",
    "commissions",
    "sales_dashboard",
    "delivery_dashboard",
    "seller_performance",
    "bank_history",
    "attendance_admin",
    "attendance_mark",
    "attendance_qr",
    "national_shipping",
    "delivery_panel",
    "warehouse",
    "crm",
    "intercompany",
  ],
  supervisor_ventas: [
    "inventory",
    "income",
    "cashier_closing",
    "delivery_dashboard",
    "national_shipping",
    "support",
    "seller_performance",
    "customers",
    "delivery_panel",
    "crm",
    "erp_inventory",
  ],
  supervisor_compras: [
    "inventory",
    "purchases",
    "purchase_orders",
    "suppliers",
    "fordmac",
    "support",
    "erp_inventory",
  ],
  administrador: [
    "admin_dashboard",
    "inventory",
    "erp_inventory",
    "income",
    "expenses",
    "banks",
    "cashea",
    "customers",
    "cxc",
    "cxp",
    "internal_transfers",
    "purchase_orders",
    "purchases",
    "cashier_closing",
    "support",
    "commissions",
    "delivery_dashboard",
    "seller_performance",
    "bank_history",
    "attendance_admin",
    "attendance_mark",
    "attendance_qr",
    "national_shipping",
    "expenses_dashboard",
    "delivery_panel",
    "warehouse",
    "crm",
    "integrations",
    "intercompany",
  ],
  cajero: [
    "inventory",
    "income",
    "cashier_closing",
    "support",
    "attendance_qr",
    "delivery_panel",
    "erp_inventory",
  ],
  vendedor: [
    "inventory",
    "income",
    "support",
    "delivery_panel",
    "crm",
    "erp_inventory",
  ],
  compras: [
    "inventory",
    "purchases",
    "fordmac",
    "suppliers",
    "purchase_orders",
    "support",
    "erp_inventory",
    "warehouse",
    "intercompany",
  ],
  soporte: ["inventory", "support", "delivery_panel"],
  delivery: ["delivery_panel"],
  supervisor_almacen: [
    "inventory",
    "erp_inventory",
    "warehouse",
    "purchases",
    "purchase_orders",
    "intercompany",
    "support",
    "attendance_mark",
    "erp_inventory",
  ],
  almacenista: [
    "inventory",
    "erp_inventory",
    "warehouse",
    "support",
    "attendance_mark",
  ],
  admin: [
    "dashboard_restaurant",
    "menu_management",
    "public_menu",
    "pos",
    "orders",
    "kitchen_panel",
    "ingredients",
    "recipes",
    "dashboard",
    "inventory",
    "erp_inventory",
    "suppliers",
    "sales",
    "purchases",
    "sync",
    "settings",
    "users",
    "fordmac",
    "income",
    "expenses",
    "banks",
    "admin_dashboard",
    "cashea",
    "customers",
    "cxc",
    "cxp",
    "internal_transfers",
    "purchase_orders",
    "cashier_closing",
    "support",
    "commissions",
    "sales_dashboard",
    "delivery_dashboard",
    "seller_performance",
    "bank_history",
    "attendance_admin",
    "attendance_mark",
    "attendance_qr",
    "national_shipping",
    "director_logistics",
    "expenses_dashboard",
    "delivery_panel",
    "warehouse",
    "crm",
    "integrations",
    "intercompany",
    "inventory_dashboard",
  ],
  cocina: [
    "kitchen_panel",
    "orders",
    "ingredients",
    "recipes",
    "dashboard_restaurant",
    "support",
  ],
};

const defaultViews: Record<Role, View> = {
  director: "dashboard",
  supervisor: "dashboard",
  supervisor_ventas: "income",
  supervisor_compras: "purchase_orders",
  administrador: "admin_dashboard",
  cajero: "income",
  vendedor: "inventory",
  compras: "fordmac",
  soporte: "support",
  delivery: "delivery_panel",
  supervisor_almacen: "warehouse",
  almacenista: "warehouse",
  admin: "dashboard_restaurant",
  cocina: "kitchen_panel",
};

interface NavItemProps {
  icon: React.ElementType;
  label: string;
  view: View;
  activeView: View;
  isOpen: boolean;
  onClick: (view: View) => void;
  allowedRoles: Role[];
  userRole: Role;
  perm?: string;
  userPermissions?: any;
}

const NavItem = (props: NavItemProps) => {
  if (!props.allowedRoles.includes(props.userRole)) return null;
  if (props.perm && props.userPermissions && props.userRole !== "admin") {
    const [mod, action] = props.perm.split(".");
    if (!props.userPermissions[mod]?.[action]) return null;
  }

  const Icon = props.icon;
  const isActive = props.activeView === props.view;

  return (
    <button
      onClick={() => props.onClick(props.view)}
      className={`flex items-center space-x-3 w-full px-4 py-3 rounded-lg transition-all ${
        isActive
          ? "bg-[#009FE3] text-white shadow-sm"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
      }`}
    >
      <Icon size={20} />
      {props.isOpen && (
        <span className="font-medium text-sm">{props.label}</span>
      )}
    </button>
  );
};

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [userRole, setUserRole] = useState<Role | null>(null);
  const [permissions, setPermissions] = useState<any>(null);
  const [activeView, setActiveView] = useState<View>("dashboard_restaurant");
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 768);
  const [isRateModalOpen, setIsRateModalOpen] = useState(false);
  const [rateInput, setRateInput] = useState<string>("");
  const [savingRate, setSavingRate] = useState(false);

  const fetchUserRole = async (userId: string | null, email: string, presetRole?: string) => {
    if (presetRole && ['director','supervisor','supervisor_ventas','supervisor_compras','administrador','cajero','vendedor','compras','soporte','delivery','supervisor_almacen','almacenista','admin','cocina'].includes(presetRole)) {
      setUserRole(presetRole as Role);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role, email")
        .eq("user_id", userId)
        .single();
      let role: Role = "cajero";

      if (data && data.role) {
        role = data.role as Role;
        if (!data.email && email) {
          await supabase
            .from("user_roles")
            .update({ email })
            .eq("user_id", userId);
        }
      } else if (error && error.code === "PGRST116") {
        // Not found, auto-insert default cajero role with email
        await supabase
          .from("user_roles")
          .insert([{ user_id: userId, role: "cajero", email }]);
        role = "cajero";
      }

      setUserRole(role);

      // Verify active view is allowed, else push to default
      setActiveView((prevView) => {
        const allowedViews = rolePermissions[role] || [];
        if (!allowedViews.includes(prevView)) {
          return defaultViews[role] || "delivery_panel";
        }
        return prevView;
      });
    } catch (err) {
      console.error("Error in Role sync:", err);
      // Fallback restrictive
      setUserRole("cajero");
      setActiveView("admin_dashboard");
    }
  };

  useEffect(() => {
    auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setPermissions(session?.user?.permissions || null);
      if (session?.user?.role) {
        fetchUserRole(null, "", session.user.role);
      } else if (session?.user?.id) {
        fetchUserRole(session.user.id, session.user.email || "");
      }
    });

    const {
      data: { subscription },
    } = auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setPermissions(session?.user?.permissions || null);
      if (session?.user?.role) {
        fetchUserRole(null, "", session.user.role);
      } else if (session?.user?.id) {
        fetchUserRole(session.user.id, session.user.email || "");
      } else {
        setUserRole(null);
      }
    });

    // Detectar si venimos de un QR de asistencia
    const params = new URLSearchParams(window.location.search);
    if (params.get("branch") && params.get("type")) {
      setActiveView("attendance_mark");
    }

    return () => subscription.unsubscribe();
  }, []);

  // Close sidebar on mobile when view changes
  useEffect(() => {
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  }, [activeView]);

  const handleLogout = async () => {
    await auth.signOut();
  };

  const handleToggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const handleSetView = (view: View) => {
    setActiveView(view);
  };

  const handleOpenRateModal = () => {
    setRateInput("");
    setIsRateModalOpen(true);
  };

  const handleSaveRate = async () => {
    const value = Number(rateInput);
    if (!rateInput || value <= 0) return;
    setSavingRate(true);
    try {
      await dbService.saveDailyRate(value);
      setIsRateModalOpen(false);
    } catch (e: any) {
      alert("Error al guardar la tasa: " + e.message);
    } finally {
      setSavingRate(false);
    }
  };

  if (!session) {
    return <Login />;
  }

  if (!userRole) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-gray-50 gap-4">
        <Loader2 className="animate-spin text-[#D40000]" size={48} />
        <p className="text-gray-500 font-bold tracking-widest uppercase text-sm">
          Validando Credenciales de Acceso...
        </p>
      </div>
    );
  }

  if (userRole === "delivery") {
    return (
      <div className="h-screen w-full bg-gray-50 overflow-y-auto p-4">
        <DeliveryPanel userEmail={session?.user?.email} userRole={userRole} />
      </div>
    );
  }

  const isViewAllowed = rolePermissions[userRole]
    ? rolePermissions[userRole].includes(activeView)
    : false;

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden font-sans relative">
      {/* Mobile Sidebar Backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden animate-in fade-in duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Responsive Logic */}
      <aside
        className={`
        fixed md:static inset-y-0 left-0 z-50
        bg-white text-gray-900 border-r border-gray-200 transition-all duration-300 ease-in-out
        ${isSidebarOpen ? "w-64 translate-x-0" : "w-0 -translate-x-full md:w-20 md:translate-x-0"} 
        flex flex-col shadow-2xl overflow-hidden
      `}
      >
        <div className="p-4 md:p-6 flex items-center justify-between border-b border-gray-200 min-w-[256px]">
          <div className="flex items-center gap-3">
            <img src="/ISOTIPOTDP.png" alt="Restaurantes TDP" className="h-10 w-auto" />
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tighter leading-tight">
                Restaurantes<span className="text-[#009FE3]">TDP</span>
              </span>
              <span className="text-[8px] text-gray-500 uppercase tracking-widest font-bold leading-tight">
                Sistema de Gestión
              </span>
            </div>
          </div>
          <button
            onClick={handleToggleSidebar}
            className="p-1 hover:bg-gray-100 rounded md:hidden"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto min-w-[256px]">
          {/* ======================= RESTAURANTE ======================= */}
          <div className="pb-2 mb-2">
            {(isSidebarOpen || window.innerWidth < 768) && (
              <div className="px-4 py-2 bg-[#009FE3]/10 border-l-2 border-[#009FE3] mb-2">
                <span className="text-[11px] text-[#009FE3] uppercase font-bold tracking-widest">
                  RESTAURANTES
                </span>
              </div>
            )}
          </div>

          <NavItem
            icon={LayoutDashboard}
            label="Dashboard"
            view="dashboard_restaurant"
            activeView={activeView}
            isOpen={isSidebarOpen || window.innerWidth < 768}
            onClick={handleSetView}
            allowedRoles={["admin", "supervisor", "cocina", "cajero", "compras"]}
            userRole={userRole}
            perm="dashboard.view"
            userPermissions={permissions}
          />
          <NavItem
            icon={UtensilsCrossed}
            label="Menú"
            view="menu_management"
            activeView={activeView}
            isOpen={isSidebarOpen || window.innerWidth < 768}
            onClick={handleSetView}
            allowedRoles={["admin", "supervisor"]}
            userRole={userRole}
            perm="menu.view"
            userPermissions={permissions}
          />
          <NavItem
            icon={ShoppingCart}
            label="POS / Pedidos"
            view="pos"
            activeView={activeView}
            isOpen={isSidebarOpen || window.innerWidth < 768}
            onClick={handleSetView}
            allowedRoles={["admin", "cajero", "supervisor"]}
            userRole={userRole}
            perm="pos.view"
            userPermissions={permissions}
          />
          <NavItem
            icon={ClipboardList}
            label="Lista Pedidos"
            view="orders"
            activeView={activeView}
            isOpen={isSidebarOpen || window.innerWidth < 768}
            onClick={handleSetView}
            allowedRoles={["admin", "cajero", "cocina", "supervisor"]}
            userRole={userRole}
            perm="orders.view"
            userPermissions={permissions}
          />
          <NavItem
            icon={CookingPot}
            label="Cocina"
            view="kitchen_panel"
            activeView={activeView}
            isOpen={isSidebarOpen || window.innerWidth < 768}
            onClick={handleSetView}
            allowedRoles={["admin", "cocina", "supervisor"]}
            userRole={userRole}
            perm="kitchen.view"
            userPermissions={permissions}
          />
          <NavItem
            icon={Package}
            label="Ingredientes"
            view="ingredients"
            activeView={activeView}
            isOpen={isSidebarOpen || window.innerWidth < 768}
            onClick={handleSetView}
            allowedRoles={["admin", "compras", "supervisor", "cocina"]}
            userRole={userRole}
            perm="inventory.view"
            userPermissions={permissions}
          />
          <NavItem
            icon={ScrollText}
            label="Recetas"
            view="recipes"
            activeView={activeView}
            isOpen={isSidebarOpen || window.innerWidth < 768}
            onClick={handleSetView}
            allowedRoles={["admin", "compras", "supervisor"]}
            userRole={userRole}
            perm="recipes.view"
            userPermissions={permissions}
          />
          <NavItem
            icon={Globe}
            label="Menú Público"
            view="public_menu"
            activeView={activeView}
            isOpen={isSidebarOpen || window.innerWidth < 768}
            onClick={handleSetView}
            allowedRoles={["admin", "supervisor"]}
            userRole={userRole}
            perm="menu.view"
            userPermissions={permissions}
          />

          {userRole === "admin" && (
            <>
            <div className="pb-2 mb-2">
              <div className="px-4 py-2 bg-[#009FE3]/10 border-l-2 border-[#009FE3] mb-2">
                <span className="text-[11px] text-[#009FE3] uppercase font-bold tracking-widest">
                  CONFIGURACIÓN
                </span>
              </div>
            </div>
            <NavItem
              icon={Users}
              label="Usuarios"
              view="users"
              activeView={activeView}
              isOpen={isSidebarOpen || window.innerWidth < 768}
              onClick={handleSetView}
              allowedRoles={["admin"]}
              userRole={userRole}
              perm="users.view"
              userPermissions={permissions}
            />
            <NavItem
              icon={SettingsIcon}
              label="Configuración"
              view="settings"
              activeView={activeView}
              isOpen={isSidebarOpen || window.innerWidth < 768}
              onClick={handleSetView}
              allowedRoles={["admin"]}
              userRole={userRole}
              perm="settings.view"
              userPermissions={permissions}
            />
            <NavItem
              icon={Key}
              label="Integraciones / API"
              view="integrations"
              activeView={activeView}
              isOpen={isSidebarOpen || window.innerWidth < 768}
              onClick={handleSetView}
              allowedRoles={["admin"]}
              userRole={userRole}
              perm="settings.view"
              userPermissions={permissions}
            />
            </>
          )}

          {userRole !== "admin" && userRole !== "cocina" && (
          <>
          {/* ======================= PROFIT PLUS ======================= */}
          <div className="pb-2 mb-2">
            {(isSidebarOpen || window.innerWidth < 768) && (
              <div className="px-4 py-2 bg-blue-500/10 border-l-2 border-blue-500 mb-2">
                <span className="text-[11px] text-blue-400 uppercase font-black tracking-widest">
                  PROFIT (Sist. Admin)
                </span>
              </div>
            )}
          </div>

          <NavItem
            icon={Package}
            label="Consulta de Stock"
            view="inventory"
            activeView={activeView}
            isOpen={isSidebarOpen || window.innerWidth < 768}
            onClick={handleSetView}
            allowedRoles={[
              "director",
              "supervisor",
              "supervisor_ventas",
              "supervisor_compras",
              "vendedor",
              "compras",
              "cajero",
              "supervisor_almacen",
              "almacenista",
            ]}
            userRole={userRole}
          />
          <NavItem
            icon={ShoppingCart}
            label="Ventas Sistema"
            view="sales"
            activeView={activeView}
            isOpen={isSidebarOpen || window.innerWidth < 768}
            onClick={handleSetView}
            allowedRoles={["director"]}
            userRole={userRole}
          />
          {/* ======================= ERP RG7 ======================= */}
          <div className="pt-6 pb-2 mt-4">
            {(isSidebarOpen || window.innerWidth < 768) && (
              <div className="px-4 py-2 bg-[#D40000]/10 border-l-2 border-[#D40000] mb-2">
                <span className="text-[11px] text-[#D40000] uppercase font-black tracking-widest">
                  ERP (Legado)
                </span>
              </div>
            )}
          </div>

          <div className="pb-2">
            {(isSidebarOpen || window.innerWidth < 768) && (
              <span className="px-4 text-[10px] text-gray-500 uppercase font-black tracking-widest">
                Dashboards Centrales
              </span>
            )}
          </div>
          <NavItem
            icon={LayoutDashboard}
            label="Dashboard"
            view="dashboard"
            activeView={activeView}
            isOpen={isSidebarOpen || window.innerWidth < 768}
            onClick={handleSetView}
            allowedRoles={["director", "supervisor"]}
            userRole={userRole}
          />
          <NavItem
            icon={Wallet}
            label="Dashboard Admin"
            view="admin_dashboard"
            activeView={activeView}
            isOpen={isSidebarOpen || window.innerWidth < 768}
            onClick={handleSetView}
            allowedRoles={["director", "supervisor", "administrador"]}
            userRole={userRole}
          />
          <NavItem
            icon={TrendingUp}
            label="Dashboard Ventas"
            view="sales_dashboard"
            activeView={activeView}
            isOpen={isSidebarOpen || window.innerWidth < 768}
            onClick={handleSetView}
            allowedRoles={["director"]}
            userRole={userRole}
          />

          <div className="pt-4 pb-2 mt-2">
            {(isSidebarOpen || window.innerWidth < 768) && (
              <span className="px-4 text-[10px] text-gray-500 uppercase font-black tracking-widest">
                Ventas y Cobranza
              </span>
            )}
          </div>
          <NavItem
            icon={TrendingUp}
            label="Ingresos"
            view="income"
            activeView={activeView}
            isOpen={isSidebarOpen || window.innerWidth < 768}
            onClick={handleSetView}
            allowedRoles={[
              "director",
              "supervisor",
              "supervisor_ventas",
              "administrador",
              "cajero",
              "vendedor",
            ]}
            userRole={userRole}
          />
          <NavItem
            icon={HistoryIcon}
            label="Cashea"
            view="cashea"
            activeView={activeView}
            isOpen={isSidebarOpen || window.innerWidth < 768}
            onClick={handleSetView}
            allowedRoles={["director", "supervisor", "administrador"]}
            userRole={userRole}
          />
          <NavItem
            icon={Wallet}
            label="CxC / Créditos"
            view="cxc"
            activeView={activeView}
            isOpen={isSidebarOpen || window.innerWidth < 768}
            onClick={handleSetView}
            allowedRoles={["director", "supervisor", "administrador"]}
            userRole={userRole}
          />
          <NavItem
            icon={User}
            label="Agenda / Clientes"
            view="customers"
            activeView={activeView}
            isOpen={isSidebarOpen || window.innerWidth < 768}
            onClick={handleSetView}
            allowedRoles={[
              "director",
              "supervisor",
              "supervisor_ventas",
              "administrador",
            ]}
            userRole={userRole}
          />
          <NavItem
            icon={MessageSquare}
            label="CRM WhatsApp"
            view="crm"
            activeView={activeView}
            isOpen={isSidebarOpen || window.innerWidth < 768}
            onClick={handleSetView}
            allowedRoles={[
              "director",
              "supervisor",
              "supervisor_ventas",
              "administrador",
              "vendedor",
            ]}
            userRole={userRole}
          />

          <div className="pt-4 pb-2 mt-2">
            {(isSidebarOpen || window.innerWidth < 768) && (
              <span className="px-4 text-[10px] text-gray-500 uppercase font-black tracking-widest">
                Tesorería y Egresos
              </span>
            )}
          </div>
          <NavItem
            icon={PieChart}
            label="Dashboard Egresos"
            view="expenses_dashboard"
            activeView={activeView}
            isOpen={isSidebarOpen || window.innerWidth < 768}
            onClick={handleSetView}
            allowedRoles={["director", "administrador"]}
            userRole={userRole}
          />
          <NavItem
            icon={TrendingDown}
            label="Control de Gastos"
            view="expenses"
            activeView={activeView}
            isOpen={isSidebarOpen || window.innerWidth < 768}
            onClick={handleSetView}
            allowedRoles={["director", "supervisor", "administrador"]}
            userRole={userRole}
          />
          <NavItem
            icon={TrendingDown}
            label="CxP (Deudas)"
            view="cxp"
            activeView={activeView}
            isOpen={isSidebarOpen || window.innerWidth < 768}
            onClick={handleSetView}
            allowedRoles={["director", "supervisor", "administrador"]}
            userRole={userRole}
          />
          <NavItem
            icon={Landmark}
            label="Bancos"
            view="banks"
            activeView={activeView}
            isOpen={isSidebarOpen || window.innerWidth < 768}
            onClick={handleSetView}
            allowedRoles={["director", "supervisor", "administrador"]}
            userRole={userRole}
          />
          <NavItem
            icon={HistoryIcon}
            label="Historial Bancos"
            view="bank_history"
            activeView={activeView}
            isOpen={isSidebarOpen || window.innerWidth < 768}
            onClick={handleSetView}
            allowedRoles={["director", "supervisor", "administrador"]}
            userRole={userRole}
          />
          <NavItem
            icon={ArrowLeftRight}
            label="Transf. Internas"
            view="internal_transfers"
            activeView={activeView}
            isOpen={isSidebarOpen || window.innerWidth < 768}
            onClick={handleSetView}
            allowedRoles={["director", "supervisor", "administrador"]}
            userRole={userRole}
          />
          <NavItem
            icon={HistoryIcon}
            label="Cuadre de Caja"
            view="cashier_closing"
            activeView={activeView}
            isOpen={isSidebarOpen || window.innerWidth < 768}
            onClick={handleSetView}
            allowedRoles={[
              "director",
              "supervisor",
              "supervisor_ventas",
              "administrador",
              "cajero",
            ]}
            userRole={userRole}
          />
          <NavItem
            icon={Wallet}
            label="Comisiones"
            view="commissions"
            activeView={activeView}
            isOpen={isSidebarOpen || window.innerWidth < 768}
            onClick={handleSetView}
            allowedRoles={["director", "supervisor", "administrador"]}
            userRole={userRole}
          />

          <div className="pt-4 pb-2 mt-2">
            {(isSidebarOpen || window.innerWidth < 768) && (
              <span className="px-4 text-[10px] text-gray-500 uppercase font-black tracking-widest">
                Logística y Compras
              </span>
            )}
          </div>
          <NavItem
            icon={ArrowLeftRight}
            label="Compras / Recepciones"
            view="purchases"
            activeView={activeView}
            isOpen={isSidebarOpen || window.innerWidth < 768}
            onClick={handleSetView}
            allowedRoles={[
              "director",
              "supervisor",
              "supervisor_compras",
              "compras",
              "administrador",
              "supervisor_almacen",
            ]}
            userRole={userRole}
          />
          <NavItem
            icon={HistoryIcon}
            label="Ordenes de Compra"
            view="purchase_orders"
            activeView={activeView}
            isOpen={isSidebarOpen || window.innerWidth < 768}
            onClick={handleSetView}
            allowedRoles={[
              "director",
              "supervisor",
              "supervisor_compras",
              "compras",
              "administrador",
              "supervisor_almacen",
            ]}
            userRole={userRole}
          />
          <NavItem
            icon={Truck}
            label="Proveedores"
            view="suppliers"
            activeView={activeView}
            isOpen={isSidebarOpen || window.innerWidth < 768}
            onClick={handleSetView}
            allowedRoles={[
              "director",
              "supervisor",
              "supervisor_compras",
              "compras",
            ]}
            userRole={userRole}
          />
          <NavItem
            icon={BarChart3}
            label="Inteligencia FORDMAC"
            view="fordmac"
            activeView={activeView}
            isOpen={isSidebarOpen || window.innerWidth < 768}
            onClick={handleSetView}
            allowedRoles={["director", "supervisor_compras", "compras"]}
            userRole={userRole}
          />
          <NavItem
            icon={Globe}
            label="Logística Global"
            view="director_logistics"
            activeView={activeView}
            isOpen={isSidebarOpen || window.innerWidth < 768}
            onClick={handleSetView}
            allowedRoles={["director"]}
            userRole={userRole}
          />
          <NavItem
            icon={Truck}
            label="Seguimiento Delivery"
            view="delivery_dashboard"
            activeView={activeView}
            isOpen={isSidebarOpen || window.innerWidth < 768}
            onClick={handleSetView}
            allowedRoles={[
              "director",
              "supervisor",
              "supervisor_ventas",
              "administrador",
            ]}
            userRole={userRole}
          />
          <NavItem
            icon={Truck}
            label="Panel Motorizados"
            view="delivery_panel"
            activeView={activeView}
            isOpen={isSidebarOpen || window.innerWidth < 768}
            onClick={handleSetView}
            allowedRoles={[
              "director",
              "supervisor",
              "supervisor_ventas",
              "administrador",
              "cajero",
              "vendedor",
              "soporte",
            ]}
            userRole={userRole}
          />
          <NavItem
            icon={Package}
            label="Envíos Nacionales"
            view="national_shipping"
            activeView={activeView}
            isOpen={isSidebarOpen || window.innerWidth < 768}
            onClick={handleSetView}
            allowedRoles={[
              "director",
              "supervisor",
              "supervisor_ventas",
              "administrador",
            ]}
            userRole={userRole}
          />
          <NavItem
            icon={Award}
            label="Rendimiento Canales"
            view="seller_performance"
            activeView={activeView}
            isOpen={isSidebarOpen || window.innerWidth < 768}
            onClick={handleSetView}
            allowedRoles={[
              "director",
              "supervisor",
              "supervisor_ventas",
              "administrador",
            ]}
            userRole={userRole}
          />

          <div className="pt-4 pb-2 mt-2">
            {(isSidebarOpen || window.innerWidth < 768) && (
              <span className="px-4 text-[10px] text-gray-500 uppercase font-black tracking-widest">
                Almacén e Inventario
              </span>
            )}
          </div>
          <NavItem
            icon={Package}
            label="Consulta de Stock (ERP)"
            view="erp_inventory"
            activeView={activeView}
            isOpen={isSidebarOpen || window.innerWidth < 768}
            onClick={handleSetView}
            allowedRoles={[
              "director",
              "supervisor",
              "administrador",
              "supervisor_almacen",
              "almacenista",
              "vendedor",
              "compras",
            ]}
            userRole={userRole}
          />
          <NavItem
            icon={BarChart3}
            label="Dashboard Inventario"
            view="inventory_dashboard"
            activeView={activeView}
            isOpen={isSidebarOpen || window.innerWidth < 768}
            onClick={handleSetView}
            allowedRoles={["director"]}
            userRole={userRole}
          />
          <NavItem
            icon={Database}
            label="Gestión de Almacén"
            view="warehouse"
            activeView={activeView}
            isOpen={isSidebarOpen || window.innerWidth < 768}
            onClick={handleSetView}
            allowedRoles={[
              "director",
              "supervisor",
              "administrador",
              "supervisor_almacen",
              "almacenista",
            ]}
            userRole={userRole}
          />
          <NavItem
            icon={ArrowLeftRight}
            label="Inter-empresas"
            view="intercompany"
            activeView={activeView}
            isOpen={isSidebarOpen || window.innerWidth < 768}
            onClick={handleSetView}
            allowedRoles={["director", "supervisor", "compras", "supervisor_almacen"]}
            userRole={userRole}
          />
 
          <div className="pt-4 pb-2 mt-2">
            {(isSidebarOpen || window.innerWidth < 768) && (
              <span className="px-4 text-[10px] text-gray-500 uppercase font-black tracking-widest">
                Operaciones y Soporte
              </span>
            )}
          </div>
          <NavItem
            icon={MessageSquare}
            label="Soporte Técnico"
            view="support"
            activeView={activeView}
            isOpen={isSidebarOpen || window.innerWidth < 768}
            onClick={handleSetView}
            allowedRoles={[
              "director",
              "supervisor",
              "cajero",
              "vendedor",
              "compras",
            ]}
            userRole={userRole}
          />
          <NavItem
            icon={Users}
            label="Control Asistencia"
            view="attendance_admin"
            activeView={activeView}
            isOpen={isSidebarOpen || window.innerWidth < 768}
            onClick={handleSetView}
            allowedRoles={["director", "administrador"]}
            userRole={userRole}
          />
          <NavItem
            icon={QrCode}
            label="Mostrar QR"
            view="attendance_qr"
            activeView={activeView}
            isOpen={isSidebarOpen || window.innerWidth < 768}
            onClick={handleSetView}
            allowedRoles={["director", "administrador", "cajero"]}
            userRole={userRole}
          />

          {(userRole === "director" || userRole === "supervisor") && (
            <>
              <div className="pt-4 pb-2 mt-2">
                {(isSidebarOpen || window.innerWidth < 768) && (
                  <span className="px-4 text-[10px] text-gray-500 uppercase font-black tracking-widest">
                    Configuración
                  </span>
                )}
              </div>
              <NavItem
                icon={HistoryIcon}
                label="Cola de Eventos"
                view="sync"
                activeView={activeView}
                isOpen={isSidebarOpen || window.innerWidth < 768}
                onClick={handleSetView}
                allowedRoles={["director", "supervisor"]}
                userRole={userRole}
              />
              <NavItem
                icon={SettingsIcon}
                label="Usuarios / Roles"
                view="settings"
                activeView={activeView}
                isOpen={isSidebarOpen || window.innerWidth < 768}
                onClick={handleSetView}
                allowedRoles={["director", "supervisor"]}
                userRole={userRole}
              />
            </>
          )}
          <NavItem
            icon={Key}
            label="Integraciones / API"
            view="integrations"
            activeView={activeView}
            isOpen={isSidebarOpen || window.innerWidth < 768}
            onClick={handleSetView}
            allowedRoles={["director", "administrador"]}
            userRole={userRole}
          />
          </>
          )}
        </nav>

        <div className="p-4 border-t border-gray-800 bg-[#121212] min-w-[256px]">
          <div className="flex items-center justify-between group">
            <div className="flex items-center space-x-3">
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm shadow-inner uppercase tracking-wider
                ${userRole === "director" ? "bg-[#D40000] text-white" : userRole === "supervisor" ? "bg-blue-600 text-white" : userRole === "administrador" ? "bg-purple-600 text-white" : userRole === "vendedor" ? "bg-indigo-600 text-white" : userRole === "supervisor_almacen" ? "bg-amber-600 text-white" : userRole === "almacenista" ? "bg-teal-600 text-white" : "bg-emerald-600 text-white"}`}
              >
                {userRole.substring(0, 2)}
              </div>
              {(isSidebarOpen || window.innerWidth < 768) && (
                <div className="flex flex-col">
                  <span className="text-xs font-bold truncate w-24 text-gray-200">
                    {session.user?.email}
                  </span>
                  <span className="text-[9px] text-gray-500 font-mono uppercase tracking-widest">
                    {userRole}
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center">
              {(isSidebarOpen || window.innerWidth < 768) &&
                userRole === "director" && (
                  <button
                    onClick={handleOpenRateModal}
                    className="p-2 text-gray-500 hover:text-green-400 hover:bg-green-900/20 rounded-lg transition-all mr-1"
                    title="Establecer Tasa del Día"
                  >
                    <DollarSign size={16} />
                  </button>
                )}
              {(isSidebarOpen || window.innerWidth < 768) && (
                <button
                  onClick={handleLogout}
                  className="p-2 text-gray-500 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                  title="Cerrar Sesión"
                >
                  <LogOut size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto flex flex-col min-w-0">
        <header className="bg-white border-b px-4 md:px-8 py-4 flex items-center justify-between shadow-sm sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleSidebar}
              className="p-2 -ml-2 hover:bg-gray-50 rounded-xl md:hidden text-gray-600"
            >
              <Menu size={24} />
            </button>
            <div className="flex items-center space-x-2 md:space-x-4">
              <h1 className="text-sm md:text-lg font-black text-gray-800 uppercase tracking-tight truncate max-w-[120px] md:max-w-none">
                {activeView === "sales"
                  ? "Ventas"
                  : activeView === "purchases"
                    ? "Compras"
                    : activeView === "sync"
                      ? "Eventos"
                      : activeView === "income"
                        ? "Ingresos"
                        : activeView === "expenses"
                          ? "Egresos"
                          : activeView === "banks"
                            ? "Bancos"
                            : activeView === "cashea"
                              ? "Cuentas por Cobrar Cashea"
                              : activeView === "cxc"
                                ? "Gestión CxC (Créditos)"
                                : activeView === "cxp"
                                  ? "Gestión CxP (Deudas/Préstamos)"
                                  : activeView === "customers"
                                    ? "Agenda de Clientes"
                                    : activeView === "admin_dashboard"
                                      ? "Panel Administrativo"
                                      : activeView === "sales_dashboard"
                                        ? "Dashboard Ventas"
                                        : activeView === "dashboard"
                                          ? "Dashboard Central"
                                          : activeView === "settings"
                                            ? "Configuración"
                                            : activeView ===
                                                "internal_transfers"
                                              ? "Transferencias Internas"
                                              : activeView === "purchase_orders"
                                                ? "Ordenes de Compra"
                                                : activeView ===
                                                    "cashier_closing"
                                                  ? "Cuadre de Caja"
                                                  : activeView ===
                                                      "delivery_dashboard"
                                                    ? "Seguimiento de Entregas / Motorizados"
                                                    : activeView ===
                                                        "delivery_panel"
                                                      ? "App de Despacho (Motorizados)"
                                                      : activeView ===
                                                          "bank_history"
                                                        ? "Historial de Movimientos Bancarios"
                                                        : activeView ===
                                                            "seller_performance"
                                                          ? "Rendimiento de Asesores por Canal"
                                                          : activeView ===
                                                              "director_logistics"
                                                            ? "Logística Global de Despachos"
                                                            : activeView ===
                                                                "warehouse"
                                                              ? "Gestión de Almacén y Ajustes"
                                                              : activeView ===
                                                                  "erp_inventory"
                                                                ? "Stock de Inventario ERP Local"
                                                                : activeView ===
                                                                    "crm"
                                                                  ? "CRM WhatsApp"
                                                                  : activeView ===
                                                                     "support"
                                                                   ? "Soporte y Requerimientos"
                                                                   : activeView ===
                                                                       "intercompany"
                                                                      ? "Inter-empresas"
                                                                      : activeView ===
                                                                        "inventory_dashboard"
                                                                       ? "Dashboard de Inventario"
                                                                       : activeView === "dashboard_restaurant"
                                                                       ? "Dashboard"
                                                                       : activeView === "menu_management"
                                                                       ? "Gestión de Menú"
                                                                       : activeView === "public_menu"
                                                                       ? "Menú Público"
                                                                       : activeView === "pos"
                                                                       ? "Punto de Venta"
                                                                       : activeView === "orders"
                                                                       ? "Pedidos"
                                                                       : activeView === "kitchen_panel"
                                                                       ? "Panel de Cocina"
                                                                       : activeView === "ingredients"
                                                                       ? "Ingredientes"
                                                                       : activeView === "recipes"
                                                                       ? "Recetas"
                                                                       : activeView === "users"
                                                                       ? "Usuarios"
                                                                       : activeView}
              </h1>
              <div className="h-4 w-px bg-gray-200 hidden sm:block"></div>
              <span className="text-[10px] md:text-xs text-gray-400 font-medium hidden sm:block">
                Restaurantes TDP
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2 md:space-x-4">
            <div className="flex items-center space-x-2 bg-green-50 px-2 md:px-3 py-1 md:py-1.5 rounded-full border border-green-100">
              <div className="w-1.5 md:w-2 md:h-2 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-[8px] md:text-[10px] font-bold text-green-700 uppercase tracking-tighter">
                Conectado
              </span>
            </div>
            <button className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-600 uppercase tracking-wider hidden sm:flex pointer-events-none">
              <Database size={14} className="text-gray-400" />
              {userRole}
            </button>
          </div>
        </header>

        <div className="p-4 md:p-8 max-w-[1600px] mx-auto w-full">
          {!isViewAllowed ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <ShieldAlert className="text-red-500/50 mb-4" size={64} />
              <h2 className="text-2xl font-black text-gray-800 mb-2">
                Acceso Restringido
              </h2>
              <p className="text-gray-500 font-medium max-w-sm">
                Tu perfil de acceso actual ({userRole}) no tiene los permisos
                requeridos para visualizar esta sección.
              </p>
            </div>
          ) : (
            <>
              {activeView === "dashboard" && <Dashboard userRole={userRole} />}
              {activeView === "inventory" && <Inventory />}
              {activeView === "suppliers" && <Suppliers />}
              {activeView === "sales" && <SalesNE />}
              {activeView === "purchases" && <Purchases />}
              {activeView === "sync" && <SyncLogs />}
              {activeView === "fordmac" && <Fordmac />}
              {activeView === "admin_dashboard" && <AdminDashboard />}
              {activeView === "sales_dashboard" && <SalesDashboard />}
              {activeView === "income" && <Income />}
              {activeView === "expenses" && <Expenses />}
              {activeView === "banks" && <Banks />}
              {activeView === "cashea" && <CasheaManagement />}
              {activeView === "cxc" && <CxcManagement />}
              {activeView === "cxp" && <CxpManagement userRole={userRole} />}
              {activeView === "customers" && (
                <Customers onNavigate={setActiveView} />
              )}
              {activeView === "internal_transfers" && <InternalTransfers />}
              {activeView === "purchase_orders" && <PurchaseOrders />}
              {activeView === "cashier_closing" && <CashierClosing />}
              {activeView === "crm" && <WAChat />}
              {activeView === "support" && <Support />}
              {activeView === "commissions" && <Commissions />}
              {activeView === "delivery_dashboard" && <DeliveryDashboard />}
              {activeView === "delivery_panel" && (
                <DeliveryPanel
                  userEmail={session?.user?.email}
                  userRole={userRole}
                />
              )}
              {activeView === "bank_history" && <BankHistory />}
              {activeView === "attendance_mark" && <AttendanceMark />}
              {activeView === "attendance_admin" && <AttendanceAdmin />}
              {activeView === "attendance_qr" && <AttendanceQR />}
              {activeView === "national_shipping" && (
                <NationalShippingDashboard />
              )}
              {activeView === "seller_performance" && <SellerPerformance />}
              {activeView === "director_logistics" && (
                <DirectorLogisticsDashboard />
              )}
              {activeView === "warehouse" && (
                <WarehouseManagement
                  userRole={userRole}
                  userEmail={session?.user?.email}
                />
              )}
              {activeView === "erp_inventory" && <ErpInventory userRole={userRole} />}
              {activeView === "integrations" && <Integrations />}
              {activeView === "intercompany" && <IntercompanyModule userRole={userRole} />}
              {activeView === "inventory_dashboard" && <InventoryDashboard />}
              {activeView === "settings" && <SettingsComponent />}
              {activeView === "expenses_dashboard" && <ExpensesDashboard />}
              {activeView === "dashboard_restaurant" && <DashboardRestaurant />}
              {activeView === "menu_management" && <MenuManagement />}
              {activeView === "public_menu" && <PublicMenu />}
              {activeView === "pos" && <POS />}
              {activeView === "orders" && <Orders />}
              {activeView === "kitchen_panel" && <KitchenPanel />}
              {activeView === "ingredients" && <Ingredients />}
              {activeView === "recipes" && <Recipes />}
              {activeView === "users" && <UsersPage />}
            </>
          )}
        </div>
      </main>
      <SupportBubble />

      {isRateModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 bg-green-50 border-b border-green-100 text-center">
              <div className="mx-auto w-16 h-16 bg-white rounded-full flex items-center justify-center mb-3 shadow-sm">
                <DollarSign className="text-green-600" size={32} />
              </div>
              <h3 className="font-black text-green-700 text-lg uppercase tracking-widest">
                Tasa del Día
              </h3>
              <p className="text-xs text-green-600 font-bold mt-1">
                Establece la tasa de cambio manualmente (solo director).
              </p>
            </div>
            <div className="p-8 space-y-6 flex flex-col items-center">
              <div className="w-full relative">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest text-center mb-2">
                  Tasa de Cambio (VES por 1 USD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  autoFocus
                  value={rateInput}
                  onChange={(e) => setRateInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveRate();
                  }}
                  placeholder="Ej: 36.50"
                  className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent focus:border-green-500 rounded-2xl font-black text-center text-3xl transition-all outline-none text-gray-800"
                />
              </div>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setIsRateModalOpen(false)}
                  className="flex-1 py-4 bg-gray-100 text-gray-500 rounded-xl font-black hover:bg-gray-200 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveRate}
                  disabled={!rateInput || savingRate || Number(rateInput) <= 0}
                  className="flex-1 py-4 bg-green-600 text-white rounded-xl font-black shadow-xl shadow-green-200 hover:shadow-2xl hover:-translate-y-1 transition-all disabled:opacity-50 disabled:translate-y-0"
                >
                  {savingRate ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
