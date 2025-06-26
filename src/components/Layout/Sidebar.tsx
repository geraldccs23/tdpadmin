export const hasPermission = (user: User | null | undefined, permission: string): boolean => {
  if (!user || !user.permissions) return false;
  return user.permissions.includes(permission);
};import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Store, 
  FileText, 
  BarChart3, 
  Settings, 
  Users,
  Calculator,
  LogOut,
  Activity,
  Home,
  Calendar,
  Building2
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { hasPermission as checkPermission } from '../../lib/permissions';

export const Sidebar: React.FC = () => {
  const { user, signOut } = useAuth();
  const isSuperUser = user?.role === 'director' || user?.role === 'administrador';

  const menuItems = [
    {
      label: 'Dashboard',
      icon: Home,
      path: '/dashboard',
      permission: 'dashboard:view'
    },
    {
      label: 'Operaciones Diarias',
      icon: Calendar,
      path: '/daily-operations',
      permission: 'daily_operations:view'
    },
    {
      label: 'Cierres',
      icon: FileText,
      path: '/closures',
      permission: 'closures:view'
    },
    {
      label: 'Tiendas',
      icon: Building2,
      path: '/stores',
      permission: 'stores:view'
    },
    {
      label: 'Usuarios',
      icon: Users,
      path: '/users',
      permission: 'users:view'
    },
    {
      label: 'Reportes',
      icon: BarChart3,
      path: '/reports',
      permission: 'reports:view'
    },
    {
      label: 'Configuración',
      icon: Settings,
      path: '/settings',
      permission: 'settings:view'
    }
  ];

  const handleSignOut = async () => {
    await signOut();
  };


  console.log("🧠 Usuario actual:", user);
  console.log("🔐 Rol:", user?.role);


  // Filtrar navegación según permisos del usuario
  const filteredNavigation = isSuperUser
  ? menuItems
  : menuItems.filter(item => user && checkPermission(user, item.permission));

  return (
    <div className="flex flex-col h-full w-64 bg-gray-900 text-white">
      <div className="flex items-center justify-center h-16 bg-gray-800">
        <Calculator className="w-8 h-8 text-blue-400" />
        <span className="ml-2 text-xl font-bold">FinanceHub</span>
      </div>
      
      <nav className="flex-1 px-4 py-6 space-y-2">
        {filteredNavigation.map((item) => (
          <NavLink
            key={item.label}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`
            }
          >
            <item.icon className="w-5 h-5 mr-3" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      
      <div className="p-4 border-t border-gray-700">
        {user && (
          <div className="mb-4 px-4 py-2 bg-gray-800 rounded-lg">
            <div className="text-sm font-medium text-white">{user.fullName}</div>
            <div className="text-xs text-gray-400">{user.email}</div>
            <div className="text-xs text-blue-400 mt-1">{user.role}</div>
          </div>
        )}
        <button
          onClick={handleSignOut}
          className="flex items-center w-full px-4 py-3 text-sm font-medium text-gray-300 rounded-lg hover:bg-gray-700 hover:text-white transition-colors"
        >
          <LogOut className="w-5 h-5 mr-3" />
          Cerrar Sesión
        </button>
      </div>
    </div>
  );
};