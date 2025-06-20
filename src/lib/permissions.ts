import { User } from '../types';

export type Permission = 
  | 'dashboard:view'
  | 'daily_operations:view'
  | 'daily_operations:create'
  | 'daily_operations:edit'
  | 'daily_operations:delete'
  | 'closures:view'
  | 'closures:create'
  | 'closures:edit'
  | 'closures:delete'
  | 'stores:view'
  | 'stores:create'
  | 'stores:edit'
  | 'stores:delete'
  | 'users:view'
  | 'users:create'
  | 'users:edit'
  | 'users:delete'
  | 'reports:view'
  | 'reports:export'
  | 'settings:view'
  | 'settings:edit'
  | 'all_stores:access'
  | 'assigned_store:access';

export interface RolePermissions {
  role: User['role'];
  name: string;
  description: string;
  permissions: Permission[];
  canAccessAllStores: boolean;
  canManageUsers: boolean;
  canManageSystem: boolean;
}

export const ROLE_PERMISSIONS: Record<User['role'], RolePermissions> = {
  director: {
    role: 'director',
    name: 'Director',
    description: 'Acceso total al sistema. Puede gestionar todo.',
    permissions: [
      'dashboard:view',
      'daily_operations:view',
      'daily_operations:create',
      'daily_operations:edit',
      'daily_operations:delete',
      'closures:view',
      'closures:create',
      'closures:edit',
      'closures:delete',
      'stores:view',
      'stores:create',
      'stores:edit',
      'stores:delete',
      'users:view',
      'users:create',
      'users:edit',
      'users:delete',
      'reports:view',
      'reports:export',
      'settings:view',
      'settings:edit',
      'all_stores:access'
    ],
    canAccessAllStores: true,
    canManageUsers: true,
    canManageSystem: true
  },
  
  admin_contable: {
    role: 'admin_contable',
    name: 'Administrador y Contable',
    description: 'Gestión administrativa y contable. Acceso a todas las tiendas.',
    permissions: [
      'dashboard:view',
      'daily_operations:view',
      'daily_operations:create',
      'daily_operations:edit',
      'daily_operations:delete',
      'closures:view',
      'closures:create',
      'closures:edit',
      'closures:delete',
      'stores:view',
      'stores:create',
      'stores:edit',
      'stores:delete',
      'users:view',
      'users:create',
      'users:edit',
      'users:delete',
      'reports:view',
      'reports:export',
      'settings:view',
      'all_stores:access'
    ],
    canAccessAllStores: true,
    canManageUsers: true,
    canManageSystem: false
  },
  
  gerente_tienda: {
    role: 'gerente_tienda',
    name: 'Gerente de Tienda',
    description: 'Gestión completa de su tienda asignada.',
    permissions: [
      'dashboard:view',
      'daily_operations:view',
      'daily_operations:create',
      'daily_operations:edit',
      'daily_operations:delete',
      'closures:view',
      'closures:create',
      'closures:edit',
      'closures:delete',
      'stores:view',
      'reports:view',
      'assigned_store:access'
    ],
    canAccessAllStores: false,
    canManageUsers: false,
    canManageSystem: false
  },
  
  cajero: {
    role: 'cajero',
    name: 'Cajero',
    description: 'Operaciones básicas de caja en su tienda asignada.',
    permissions: [
      'dashboard:view',
      'daily_operations:view',
      'daily_operations:create',
      'daily_operations:edit',
      'closures:view',
      'assigned_store:access'
    ],
    canAccessAllStores: false,
    canManageUsers: false,
    canManageSystem: false
  },
  
  asistente_admin: {
    role: 'asistente_admin',
    name: 'Asistente Administrativo',
    description: 'Soporte administrativo. Solo consultas.',
    permissions: [
      'dashboard:view',
      'daily_operations:view',
      'closures:view',
      'reports:view',
      'all_stores:access'
    ],
    canAccessAllStores: true,
    canManageUsers: false,
    canManageSystem: false
  }
};

export const hasPermission = (user: User, permission: Permission): boolean => {
  const rolePermissions = ROLE_PERMISSIONS[user.role];
  return rolePermissions.permissions.includes(permission);
};

export const canAccessStore = (user: User, storeId: string): boolean => {
  // Directores y admin_contable pueden acceder a todas las tiendas
  if (user.role === 'director' || user.role === 'admin_contable' || user.role === 'asistente_admin') {
    return true;
  }
  
  // Gerentes y cajeros solo pueden acceder a su tienda asignada
  return user.assigned_store_id === storeId;
};

export const canManageUsers = (user: User): boolean => {
  return user.role === 'director' || user.role === 'admin_contable';
};

export const canManageSystem = (user: User): boolean => {
  return user.role === 'director';
};

export const getRoleName = (role: User['role']): string => {
  return ROLE_PERMISSIONS[role].name;
};

export const getRoleDescription = (role: User['role']): string => {
  return ROLE_PERMISSIONS[role].description;
};

export const getAllRoles = (): Array<{ value: User['role']; label: string; description: string }> => {
  return Object.values(ROLE_PERMISSIONS).map(role => ({
    value: role.role,
    label: role.name,
    description: role.description
  }));
}; 