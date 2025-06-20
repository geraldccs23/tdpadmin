import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, User, Mail, Phone, Building, Shield, CheckCircle, XCircle, Eye } from 'lucide-react';
import { User as UserType, Store } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { 
  hasPermission, 
  canManageUsers, 
  getRoleName, 
  getRoleDescription, 
  getAllRoles,
  ROLE_PERMISSIONS 
} from '../lib/permissions';

export const Users: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserType[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    role: 'cajero' as UserType['role'],
    assigned_store_id: '',
    phone: '',
    is_active: true,
    password: '',
    confirm_password: '',
  });

  useEffect(() => {
    loadUsers();
    loadStores();
  }, []);

  const loadUsers = async () => {
    try {
      const storedData = localStorage.getItem('financial-dashboard-data');
      if (storedData) {
        const data = JSON.parse(storedData);
        const usersData = data.users || [];
        setUsers(usersData);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStores = async () => {
    try {
      const storedData = localStorage.getItem('financial-dashboard-data');
      if (storedData) {
        const data = JSON.parse(storedData);
        const storesData = data.stores || [];
        setStores(storesData);
      }
    } catch (error) {
      console.error('Error loading stores:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !canManageUsers(currentUser)) return;

    // Validar contraseñas
    if (!editingUser && formData.password !== formData.confirm_password) {
      alert('Las contraseñas no coinciden');
      return;
    }

    if (!editingUser && formData.password.length < 6) {
      alert('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    try {
      const newUser: Partial<UserType> = {
        email: formData.email,
        full_name: formData.full_name,
        role: formData.role,
        assigned_store_id: formData.assigned_store_id || undefined,
        phone: formData.phone,
        is_active: formData.is_active,
        created_at: new Date().toISOString(),
      };

      const storedData = localStorage.getItem('financial-dashboard-data');
      const data = storedData ? JSON.parse(storedData) : { users: [], stores: [] };
      
      if (editingUser) {
        // Update existing user
        const updatedUsers = data.users.map((user: UserType) => 
          user.id === editingUser.id 
            ? { ...user, ...newUser, updated_at: new Date().toISOString() }
            : user
        );
        data.users = updatedUsers;
        setUsers(updatedUsers);
      } else {
        // Create new user
        const newUserWithId = {
          ...newUser,
          id: Date.now().toString(),
          created_at: new Date().toISOString(),
        };
        data.users.push(newUserWithId);
        setUsers([...users, newUserWithId]);
      }

      localStorage.setItem('financial-dashboard-data', JSON.stringify(data));
      
      // Reset form
      setFormData({
        email: '',
        full_name: '',
        role: 'cajero',
        assigned_store_id: '',
        phone: '',
        is_active: true,
        password: '',
        confirm_password: '',
      });
      setShowForm(false);
      setEditingUser(null);
      
      alert(editingUser ? 'Usuario actualizado exitosamente' : 'Usuario creado exitosamente');
    } catch (error) {
      console.error('Error saving user:', error);
      alert('Error al guardar el usuario');
    }
  };

  const handleEdit = (user: UserType) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      assigned_store_id: user.assigned_store_id || '',
      phone: user.phone || '',
      is_active: user.is_active,
      password: '',
      confirm_password: '',
    });
    setShowForm(true);
  };

  const handleDelete = async (userId: string) => {
    if (!currentUser || !canManageUsers(currentUser)) return;
    
    if (userId === currentUser.id) {
      alert('No puedes eliminar tu propio usuario');
      return;
    }

    if (!confirm('¿Estás seguro de eliminar este usuario? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      const storedData = localStorage.getItem('financial-dashboard-data');
      const data = storedData ? JSON.parse(storedData) : { users: [], stores: [] };
      
      data.users = data.users.filter((user: UserType) => user.id !== userId);
      localStorage.setItem('financial-dashboard-data', JSON.stringify(data));
      
      setUsers(users.filter(user => user.id !== userId));
      alert('Usuario eliminado exitosamente');
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Error al eliminar el usuario');
    }
  };

  const toggleUserStatus = async (user: UserType) => {
    if (!currentUser || !canManageUsers(currentUser)) return;
    
    if (user.id === currentUser.id) {
      alert('No puedes desactivar tu propio usuario');
      return;
    }

    try {
      const storedData = localStorage.getItem('financial-dashboard-data');
      const data = storedData ? JSON.parse(storedData) : { users: [], stores: [] };
      
      const updatedUsers = data.users.map((u: UserType) => 
        u.id === user.id 
          ? { ...u, is_active: !u.is_active, updated_at: new Date().toISOString() }
          : u
      );
      data.users = updatedUsers;
      localStorage.setItem('financial-dashboard-data', JSON.stringify(data));
      
      setUsers(updatedUsers);
      alert(`Usuario ${user.is_active ? 'desactivado' : 'activado'} exitosamente`);
    } catch (error) {
      console.error('Error toggling user status:', error);
      alert('Error al cambiar el estado del usuario');
    }
  };

  const filteredUsers = users.filter(user => 
    user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    getRoleName(user.role).toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.phone?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStoreName = (storeId: string) => {
    const store = stores.find(s => s.id === storeId);
    return store?.name || 'Sin asignar';
  };

  const getRoleColor = (role: UserType['role']) => {
    const colors = {
      director: 'bg-purple-100 text-purple-800',
      admin_contable: 'bg-blue-100 text-blue-800',
      gerente_tienda: 'bg-green-100 text-green-800',
      cajero: 'bg-yellow-100 text-yellow-800',
      asistente_admin: 'bg-gray-100 text-gray-800'
    };
    return colors[role];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!currentUser || !canManageUsers(currentUser)) {
    return (
      <div className="text-center py-12">
        <Shield className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Acceso Denegado</h2>
        <p className="text-gray-600">No tienes permisos para gestionar usuarios.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Usuarios</h1>
          <p className="text-gray-600">Administra usuarios, roles y permisos del sistema</p>
        </div>
        <button
          onClick={() => {
            setEditingUser(null);
            setFormData({
              email: '',
              full_name: '',
              role: 'cajero',
              assigned_store_id: '',
              phone: '',
              is_active: true,
              password: '',
              confirm_password: '',
            });
            setShowForm(true);
          }}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Usuario</span>
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Buscar usuarios por nombre, email, rol o teléfono..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Usuarios</p>
              <p className="text-2xl font-bold text-blue-600">{users.length}</p>
            </div>
            <User className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Activos</p>
              <p className="text-2xl font-bold text-green-600">
                {users.filter(user => user.is_active).length}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Inactivos</p>
              <p className="text-2xl font-bold text-red-600">
                {users.filter(user => !user.is_active).length}
              </p>
            </div>
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Gerentes</p>
              <p className="text-2xl font-bold text-purple-600">
                {users.filter(user => user.role === 'gerente_tienda').length}
              </p>
            </div>
            <Building className="w-8 h-8 text-purple-600" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Cajeros</p>
              <p className="text-2xl font-bold text-yellow-600">
                {users.filter(user => user.role === 'cajero').length}
              </p>
            </div>
            <User className="w-8 h-8 text-yellow-600" />
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {filteredUsers.length === 0 ? (
          <div className="text-center py-12">
            <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">
              {searchTerm ? 'No se encontraron usuarios' : 'No hay usuarios registrados'}
            </p>
            <p className="text-gray-400 mt-2">
              {searchTerm ? 'Intenta con otros términos de búsqueda' : 'Crea tu primer usuario'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Usuario
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rol
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tienda Asignada
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contacto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{user.full_name}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                          {getRoleName(user.role)}
                        </span>
                        <div className="text-xs text-gray-500 mt-1">
                          {getRoleDescription(user.role)}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.assigned_store_id ? getStoreName(user.assigned_store_id) : 'Sin asignar'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900">
                        {user.phone && (
                          <>
                            <Phone className="w-4 h-4 text-gray-400 mr-2" />
                            {user.phone}
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {user.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleEdit(user)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Editar usuario"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => toggleUserStatus(user)}
                          className={`${
                            user.is_active 
                              ? 'text-red-600 hover:text-red-900' 
                              : 'text-green-600 hover:text-green-900'
                          }`}
                          title={user.is_active ? 'Desactivar usuario' : 'Activar usuario'}
                        >
                          {user.is_active ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                        </button>
                        {user.id !== currentUser.id && (
                          <button
                            onClick={() => handleDelete(user.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Eliminar usuario"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* User Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre Completo *
                  </label>
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nombre y apellido"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="usuario@empresa.com"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rol *
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as UserType['role'] }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    {getAllRoles().map(role => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {getRoleDescription(formData.role)}
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="+58 412-123-4567"
                  />
                </div>
              </div>

              {(formData.role === 'gerente_tienda' || formData.role === 'cajero') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tienda Asignada *
                  </label>
                  <select
                    value={formData.assigned_store_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, assigned_store_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Seleccionar tienda...</option>
                    {stores.filter(store => store.is_active).map(store => (
                      <option key={store.id} value={store.id}>
                        {store.name} - {store.location}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {!editingUser && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Contraseña *
                    </label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Mínimo 6 caracteres"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Confirmar Contraseña *
                    </label>
                    <input
                      type="password"
                      value={formData.confirm_password}
                      onChange={(e) => setFormData(prev => ({ ...prev, confirm_password: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Repite la contraseña"
                      required
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
                  Usuario activo
                </label>
              </div>
              
              <div className="flex space-x-3">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingUser ? 'Actualizar Usuario' : 'Crear Usuario'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingUser(null);
                  }}
                  className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}; 