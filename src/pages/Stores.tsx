import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, MapPin, Building, Phone, Mail, Eye, CheckCircle, XCircle, User } from 'lucide-react';
import { Store, User as UserType } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

export const Stores: React.FC = () => {
  const { user } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    address: '',
    phone: '',
    email: '',
    manager_id: '',
    is_active: true,
    description: '',
    opening_hours: '',
    tax_id: '',
  });

  useEffect(() => {
    loadStores();
    loadUsers();
  }, []);

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
    } finally {
      setLoading(false);
    }
  };

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
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const newStore: Partial<Store> = {
        name: formData.name,
        location: formData.location,
        address: formData.address,
        phone: formData.phone,
        email: formData.email,
        manager_id: formData.manager_id,
        is_active: formData.is_active,
        description: formData.description,
        opening_hours: formData.opening_hours,
        tax_id: formData.tax_id,
        created_at: new Date().toISOString(),
      };

      const storedData = localStorage.getItem('financial-dashboard-data');
      const data = storedData ? JSON.parse(storedData) : { stores: [], users: [] };
      
      if (editingStore) {
        // Update existing store
        const updatedStores = data.stores.map((store: Store) => 
          store.id === editingStore.id 
            ? { ...store, ...newStore, updated_at: new Date().toISOString() }
            : store
        );
        data.stores = updatedStores;
        setStores(updatedStores);
      } else {
        // Create new store
        const newStoreWithId = {
          ...newStore,
          id: Date.now().toString(),
          created_at: new Date().toISOString(),
        };
        data.stores.push(newStoreWithId);
        setStores([...stores, newStoreWithId]);
      }

      localStorage.setItem('financial-dashboard-data', JSON.stringify(data));
      
      // Reset form
      setFormData({
        name: '',
        location: '',
        address: '',
        phone: '',
        email: '',
        manager_id: '',
        is_active: true,
        description: '',
        opening_hours: '',
        tax_id: '',
      });
      setShowForm(false);
      setEditingStore(null);
      
      alert(editingStore ? 'Tienda actualizada exitosamente' : 'Tienda creada exitosamente');
    } catch (error) {
      console.error('Error saving store:', error);
      alert('Error al guardar la tienda');
    }
  };

  const handleEdit = (store: Store) => {
    setEditingStore(store);
    setFormData({
      name: store.name,
      location: store.location,
      address: store.address || '',
      phone: store.phone || '',
      email: store.email || '',
      manager_id: store.manager_id,
      is_active: store.is_active,
      description: store.description || '',
      opening_hours: store.opening_hours || '',
      tax_id: store.tax_id || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (storeId: string) => {
    if (!confirm('¿Estás seguro de eliminar esta tienda? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      const storedData = localStorage.getItem('financial-dashboard-data');
      const data = storedData ? JSON.parse(storedData) : { stores: [], users: [] };
      
      data.stores = data.stores.filter((store: Store) => store.id !== storeId);
      localStorage.setItem('financial-dashboard-data', JSON.stringify(data));
      
      setStores(stores.filter(store => store.id !== storeId));
      alert('Tienda eliminada exitosamente');
    } catch (error) {
      console.error('Error deleting store:', error);
      alert('Error al eliminar la tienda');
    }
  };

  const toggleStoreStatus = async (store: Store) => {
    try {
      const storedData = localStorage.getItem('financial-dashboard-data');
      const data = storedData ? JSON.parse(storedData) : { stores: [], users: [] };
      
      const updatedStores = data.stores.map((s: Store) => 
        s.id === store.id 
          ? { ...s, is_active: !s.is_active, updated_at: new Date().toISOString() }
          : s
      );
      data.stores = updatedStores;
      localStorage.setItem('financial-dashboard-data', JSON.stringify(data));
      
      setStores(updatedStores);
      alert(`Tienda ${store.is_active ? 'desactivada' : 'activada'} exitosamente`);
    } catch (error) {
      console.error('Error toggling store status:', error);
      alert('Error al cambiar el estado de la tienda');
    }
  };

  const filteredStores = stores.filter(store => 
    store.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    store.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
    store.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    store.phone?.includes(searchTerm) ||
    store.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getManagerName = (managerId: string) => {
    const manager = users.find(user => user.id === managerId);
    return manager?.full_name || manager?.email || 'Sin asignar';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Tiendas</h1>
          <p className="text-gray-600">Administra las sucursales de tu empresa</p>
        </div>
        <button
          onClick={() => {
            setEditingStore(null);
            setFormData({
              name: '',
              location: '',
              address: '',
              phone: '',
              email: '',
              manager_id: '',
              is_active: true,
              description: '',
              opening_hours: '',
              tax_id: '',
            });
            setShowForm(true);
          }}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Nueva Tienda</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Buscar tiendas por nombre, ubicación, teléfono o email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Tiendas</p>
              <p className="text-2xl font-bold text-blue-600">{stores.length}</p>
            </div>
            <Building className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Tiendas Activas</p>
              <p className="text-2xl font-bold text-green-600">
                {stores.filter(store => store.is_active).length}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Tiendas Inactivas</p>
              <p className="text-2xl font-bold text-red-600">
                {stores.filter(store => !store.is_active).length}
              </p>
            </div>
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Sin Gerente</p>
              <p className="text-2xl font-bold text-yellow-600">
                {stores.filter(store => !store.manager_id).length}
              </p>
            </div>
            <User className="w-8 h-8 text-yellow-600" />
          </div>
        </div>
      </div>

      {/* Stores Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {filteredStores.length === 0 ? (
          <div className="text-center py-12">
            <Building className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">
              {searchTerm ? 'No se encontraron tiendas' : 'No hay tiendas registradas'}
            </p>
            <p className="text-gray-400 mt-2">
              {searchTerm ? 'Intenta con otros términos de búsqueda' : 'Crea tu primera tienda'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tienda
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ubicación
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contacto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Gerente
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
                {filteredStores.map((store) => (
                  <tr key={store.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{store.name}</div>
                        {store.description && (
                          <div className="text-sm text-gray-500 truncate max-w-48">
                            {store.description}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <MapPin className="w-4 h-4 text-gray-400 mr-2" />
                        <div>
                          <div className="text-sm text-gray-900">{store.location}</div>
                          {store.address && (
                            <div className="text-sm text-gray-500 truncate max-w-48">
                              {store.address}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="space-y-1">
                        {store.phone && (
                          <div className="flex items-center text-sm text-gray-900">
                            <Phone className="w-4 h-4 text-gray-400 mr-2" />
                            {store.phone}
                          </div>
                        )}
                        {store.email && (
                          <div className="flex items-center text-sm text-gray-900">
                            <Mail className="w-4 h-4 text-gray-400 mr-2" />
                            {store.email}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {getManagerName(store.manager_id)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        store.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {store.is_active ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleEdit(store)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Editar tienda"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => toggleStoreStatus(store)}
                          className={`${
                            store.is_active 
                              ? 'text-red-600 hover:text-red-900' 
                              : 'text-green-600 hover:text-green-900'
                          }`}
                          title={store.is_active ? 'Desactivar tienda' : 'Activar tienda'}
                        >
                          {store.is_active ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleDelete(store.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Eliminar tienda"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Store Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              {editingStore ? 'Editar Tienda' : 'Nueva Tienda'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre de la Tienda *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: Tienda Centro"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ubicación *
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: Centro Comercial"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Dirección Completa
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Dirección completa de la tienda"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="tienda@empresa.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Gerente Responsable
                  </label>
                  <select
                    value={formData.manager_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, manager_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Seleccionar gerente...</option>
                    {users.map(user => (
                      <option key={user.id} value={user.id}>
                        {user.full_name || user.email}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    RIF/Cédula
                  </label>
                  <input
                    type="text"
                    value={formData.tax_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, tax_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="J-12345678-9"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Horario de Atención
                </label>
                <input
                  type="text"
                  value={formData.opening_hours}
                  onChange={(e) => setFormData(prev => ({ ...prev, opening_hours: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Lun-Vie: 8:00 AM - 6:00 PM, Sáb: 9:00 AM - 2:00 PM"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descripción
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Descripción adicional de la tienda..."
                  rows={3}
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
                  Tienda activa
                </label>
              </div>
              
              <div className="flex space-x-3">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingStore ? 'Actualizar Tienda' : 'Crear Tienda'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingStore(null);
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