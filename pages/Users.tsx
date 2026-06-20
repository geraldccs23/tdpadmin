import React, { useState, useEffect } from 'react';
import { UserPlus, Users as UsersIcon, Shield, ToggleLeft, ToggleRight, Mail, X } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || window.location.origin;
const ROLES = ['admin', 'manager', 'cashier', 'kitchen', 'waiter'];

function getToken() {
  return localStorage.getItem('restaurantdp_auth_token');
}

async function api(path: string, opts?: RequestInit) {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...opts?.headers },
  });
  return res.json();
}

export function Users() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ email: '', name: '', role: 'waiter', password: '' });
  const [error, setError] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    const json = await api('/api/users');
    if (json.ok) setUsers(json.users);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const json = await api('/api/users', {
      method: 'POST',
      body: JSON.stringify(form),
    });
    if (json.ok) {
      setUsers(prev => [...prev, json.user]);
      setShowCreate(false);
      setForm({ email: '', name: '', role: 'waiter', password: '' });
    } else {
      setError(json.error || 'Error creating user');
    }
  };

  const handleToggleActive = async (user: any) => {
    const json = await api(`/api/users/${user.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: !user.is_active }),
    });
    if (json.ok) {
      setUsers(prev => prev.map(u => u.id === user.id ? json.user : u));
    }
  };

  const handleRoleChange = async (user: any, role: string) => {
    const json = await api(`/api/users/${user.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
    if (json.ok) {
      setUsers(prev => prev.map(u => u.id === user.id ? json.user : u));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Usuarios</h2>
          <p className="text-sm text-gray-500 mt-1">Gestión de usuarios y roles del sistema</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-[#009FE3] text-white px-4 py-2.5 rounded-xl hover:bg-[#0088c4] transition-all text-sm font-semibold"
        >
          <UserPlus size={18} />
          Nuevo usuario
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 p-3.5 rounded-xl flex items-center gap-3 text-sm">
          <span>{error}</span>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-800">Nuevo usuario</h3>
              <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X size={20} className="text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">Email</label>
                <input
                  type="email" required value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3] focus:ring-2 focus:ring-[#009FE3]/20"
                  placeholder="usuario@restaurantdp.local"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">Nombre</label>
                <input
                  type="text" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3] focus:ring-2 focus:ring-[#009FE3]/20"
                  placeholder="Nombre del usuario"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">Rol</label>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3] focus:ring-2 focus:ring-[#009FE3]/20"
                >
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">Contraseña</label>
                <input
                  type="password" required value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3] focus:ring-2 focus:ring-[#009FE3]/20"
                  placeholder="••••••••"
                />
              </div>
              <button type="submit" className="w-full bg-[#009FE3] text-white font-semibold py-2.5 rounded-xl hover:bg-[#0088c4] transition-all text-sm">
                Crear usuario
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Cargando...</div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center">
            <UsersIcon className="mx-auto text-gray-300 mb-3" size={48} />
            <p className="text-gray-500 font-medium">No hay usuarios registrados</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Usuario</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Rol</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Estado</th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#009FE3]/10 flex items-center justify-center">
                        <Mail size={16} className="text-[#009FE3]" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{user.name || user.email}</p>
                        <p className="text-xs text-gray-400">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={user.role}
                      onChange={e => handleRoleChange(user, e.target.value)}
                      className="border border-gray-200 rounded-lg py-1.5 px-2.5 text-sm focus:outline-none focus:border-[#009FE3]"
                    >
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
                      user.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${user.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                      {user.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleToggleActive(user)}
                      className={`p-2 rounded-lg transition-all ${
                        user.is_active ? 'hover:bg-red-50 text-red-400' : 'hover:bg-green-50 text-green-500'
                      }`}
                      title={user.is_active ? 'Desactivar' : 'Activar'}
                    >
                      {user.is_active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
