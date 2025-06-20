import React from 'react';
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
  Activity
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { hasPermission, canManageUsers } from '../../lib/permissions';

export const Sidebar: React.FC = () => {
  const { user, signOut } = useAuth();

  const navigation = [
    { 
      name: 'Dashboard', 
      href: '/', 
      icon: LayoutDashboard,
      permission: 'dashboard:view'
    },
    { 
      name: 'Operaciones Diarias', 
      href: '/daily-operations', 
      icon: Activity,
      permission: 'daily_operations:view'
    },
    { 
      name: 'Cierres Diarios', 
      href: '/closures', 
      icon: FileText,
      permission: 'closures:view'
    },
    { 
      name: 'Tiendas', 
      href: '/stores', 
      icon: Store,
      permission: 'stores:view'
    },
    { 
      name: 'Usuarios', 
      href: '/users', 
      icon: Users,
      permission: 'users:view',
      requiresUserManagement: true
    },
    { 
      name: 'Reportes', 
      href: '/reports', 
      icon: BarChart3,
      permission: 'reports:view'
    },
    { 
      name: 'Configuración', 
      href: '/settings', 
      icon: Settings,
      permission: 'settings:view'
    },
  ];

  const handleSignOut = async () => {
    await signOut();
  };

  // Filtrar navegación según permisos del usuario
  const filteredNavigation = navigation.filter(item => {
    if (!user) return false;
    
    // Verificar si requiere gestión de usuarios
    if (item.requiresUserManagement && !canManageUsers(user)) {
      return false;
    }
    
    // Verificar permiso específico
    return hasPermission(user, item.permission as any);
  });

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      <div className="flex items-center justify-center h-16 bg-gray-800">
        <Calculator className="w-8 h-8 text-blue-400" />
        <span className="ml-2 text-xl font-bold">FinanceHub</span>
      </div>
      
      <nav className="flex-1 px-4 py-6 space-y-2">
        {filteredNavigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className={({ isActive }) =>
              `flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`
            }
          >
            <item.icon className="w-5 h-5 mr-3" />
            {item.name}
          </NavLink>
        ))}
      </nav>
      
      <div className="p-4 border-t border-gray-700">
        {user && (
          <div className="mb-4 px-4 py-2 bg-gray-800 rounded-lg">
            <div className="text-sm font-medium text-white">{user.full_name}</div>
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