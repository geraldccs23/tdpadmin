import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Search, 
  MessageSquare, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Filter,
  User,
  Building2,
  Calendar,
  Send,
  MoreVertical,
  X,
  MessageCircle,
  Paperclip,
  ImageIcon
} from 'lucide-react';
import { supportApi } from '../services/supportApi';
import { auth } from '../services/auth';
import { SupportTicket } from '../types';

interface SupportMessage {
    id: number;
    ticket_id: string;
    sender_id: string;
    sender_email: string;
    message: string;
    image_url?: string;
    created_at: string;
}

const parseMessage = (msg: { message: string, image_url?: string | null }) => {
    let text = msg.message;
    let imageUrl = msg.image_url;

    if (msg.message && msg.message.startsWith('{') && msg.message.endsWith('}')) {
        try {
            const parsed = JSON.parse(msg.message);
            if (parsed && typeof parsed === 'object') {
                text = parsed.text || '';
                imageUrl = parsed.image_url || imageUrl;
            }
        } catch (e) {
            // Not JSON
        }
    }
    return { text, imageUrl };
};

export function Support() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Chat States
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [chatImage, setChatImage] = useState<File | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);

  // New Ticket State
  const [newTicket, setNewTicket] = useState({
    title: '',
    description: '',
    priority: 'medium' as SupportTicket['priority'],
    category: 'support' as SupportTicket['category'],
    branch: 'Boleita'
  });
  const [ticketImage, setTicketImage] = useState<File | null>(null);
  const ticketFileInputRef = useRef<HTMLInputElement>(null);

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const fetchUserRole = async () => {
    const { data: { session } } = await auth.getSession();
    if (session?.user) {
        setCurrentUserId(session.user.id);
        setUserRole(session.user.role || null);
    }
  };

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const data = await supportApi.getTickets();
      setTickets(data || []);
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (ticketId: string) => {
      try {
        const data = await supportApi.getMessages(ticketId);
        setMessages(data || []);
      } catch (e) {
        console.error('Error fetching messages:', e);
      }
  };

  useEffect(() => {
    fetchUserRole();
    fetchTickets();
  }, []);

  // Polling for messages (replaces Supabase Realtime)
  useEffect(() => {
      if (!selectedTicket) return;
      const interval = setInterval(() => {
        fetchMessages(selectedTicket.id);
      }, 10000);
      return () => clearInterval(interval);
  }, [selectedTicket]);

  useEffect(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleUpdateStatus = async (id: string, status: SupportTicket['status']) => {
    try {
      await supportApi.updateTicket(id, { status });
      if (selectedTicket?.id === id) {
        setSelectedTicket({ ...selectedTicket, status });
      }
      fetchTickets();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Error al actualizar el estado');
    }
  };

  const handleOpenDetail = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    fetchMessages(ticket.id);
    setIsDetailModalOpen(true);
  };

  const uploadImage = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = (reader.result as string).split(',')[1];
          const url = await supportApi.uploadImage(base64, file.name);
          resolve(url);
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
      e.preventDefault();
      if ((!newMessage.trim() && !chatImage) || !selectedTicket || !currentUserId) return;

      setSendingMessage(true);
      try {
          const { data: { session } } = await auth.getSession();
          if (!session) {
              alert('Tu sesión ha expirado. Por favor, vuelve a iniciar sesión.');
              return;
          }

          let imageUrl = '';
          if (chatImage) {
              imageUrl = await uploadImage(chatImage);
          }

          await supportApi.sendMessage(selectedTicket.id, {
              message: JSON.stringify({
                  text: newMessage.trim(),
                  image_url: imageUrl || null
              }),
          });
          setNewMessage('');
          setChatImage(null);
          fetchMessages(selectedTicket.id);
      } catch (error: any) {
          console.error('Error sending message:', error);
          alert(`No se pudo enviar el mensaje: ${error.message || 'Error desconocido'}`);
      } finally {
          setSendingMessage(false);
      }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicket.title || !newTicket.description) return;

    try {
      setIsSaving(true);
      
      let imageUrl = '';
      if (ticketImage) {
        imageUrl = await uploadImage(ticketImage);
      }

      await supportApi.createTicket({
        ...newTicket,
        image_url: imageUrl || undefined
      });
      setIsModalOpen(false);
      setNewTicket({
        title: '',
        description: '',
        priority: 'medium',
        category: 'support',
        branch: 'Boleita'
      });
      setTicketImage(null);
      fetchTickets();
    } catch (error) {
      console.error('Error creating ticket:', error);
      alert('Error al crear el ticket');
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'in_progress': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'resolved': return 'bg-green-100 text-green-700 border-green-200';
      case 'closed': return 'bg-gray-100 text-gray-700 border-gray-200';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low': return 'text-gray-500';
      case 'medium': return 'text-blue-500';
      case 'high': return 'text-orange-500';
      case 'urgent': return 'text-red-600 font-bold';
      default: return 'text-gray-500';
    }
  };

  const filteredTickets = tickets.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase()) || 
                         t.description.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'all' || t.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const canManage = userRole === 'admin' || userRole === 'manager' || userRole === 'soporte';

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            <MessageSquare className="text-[#009FE3]" size={28} />
            Centro de Soporte & Chat
          </h2>
          <p className="text-gray-500 text-sm font-medium mt-1">
            Gestiona tus requerimientos técnicos y reportes de errores en tiempo real. 
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 bg-[#009FE3] hover:bg-[#0088c4] text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-[#009FE3]/20 active:scale-95"
        >
          <Plus size={20} />
          Nuevo requerimiento
        </button>
      </div>

      {/* Stats Quick View */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Abiertos', count: tickets.filter(t => t.status === 'open').length, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'En Progreso', count: tickets.filter(t => t.status === 'in_progress').length, icon: Loader2, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Resueltos', count: tickets.filter(t => t.status === 'resolved').length, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Total', count: tickets.length, icon: MessageCircle, color: 'text-gray-600', bg: 'bg-gray-50' },
        ].map((stat, i) => (
          <div key={i} className={`${stat.bg} p-4 rounded-2xl border border-white/50 shadow-sm flex items-center gap-4`}>
            <div className={`p-3 rounded-xl bg-white shadow-sm ${stat.color}`}>
              <stat.icon size={20} className={stat.label === 'En Progreso' ? 'animate-spin-slow' : ''} />
            </div>
            <div>
              <p className="text-[10px] uppercase font-black tracking-widest text-gray-500">{stat.label}</p>
              <p className="text-xl font-black text-gray-800">{stat.count}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#009FE3] transition-colors" size={20} />
          <input
            type="text"
            placeholder="Buscar por título o descripción..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#009FE3]/20 focus:border-[#009FE3] outline-none transition-all font-medium"
          />
        </div>
        <div className="flex gap-2 bg-white p-1 rounded-xl border border-gray-200 shadow-sm">
          {['all', 'open', 'in_progress', 'resolved', 'closed'].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all
                ${filterStatus === status 
                  ? 'bg-gray-900 text-white shadow-md' 
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`}
            >
              {status === 'all' ? 'Todos' : status === 'in_progress' ? 'En Progreso' : status}
            </button>
          ))}
        </div>
      </div>

      {/* Tickets Table/List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="animate-spin text-[#009FE3]" size={40} />
            <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Cargando requerimientos...</p>
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center">
              <AlertCircle size={40} className="text-gray-300" />
            </div>
            <div>
              <p className="text-gray-800 font-bold text-lg">No se encontraron tickets</p>
              <p className="text-gray-400 text-sm">Prueba ajustando los filtros o crea uno nuevo</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Referencia / Título</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Estado</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Prioridad</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Sucursal / Creador</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Fecha</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredTickets.map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-gray-50/50 transition-colors group cursor-pointer" onClick={() => handleOpenDetail(ticket)}>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-mono text-gray-400 uppercase">#{ticket.id.substring(0, 8)}</span>
                        <span className="font-bold text-gray-800 text-sm group-hover:text-[#009FE3] transition-colors">{ticket.title}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter border ${getStatusColor(ticket.status)}`}>
                        {ticket.status === 'in_progress' ? 'En Progreso' : ticket.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${getPriorityColor(ticket.priority)}`}>
                        <div className={`w-2 h-2 rounded-full ${ticket.priority === 'urgent' ? 'bg-red-600 animate-pulse' : ticket.priority === 'high' ? 'bg-orange-500' : ticket.priority === 'medium' ? 'bg-blue-500' : 'bg-gray-400'}`} />
                        {ticket.priority}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1 text-[10px] font-bold text-gray-600 uppercase">
                          <Building2 size={12} className="text-gray-400" />
                          {ticket.branch || 'N/A'}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-gray-400">
                          <User size={12} />
                          {ticket.creator_email?.split('@')[0]}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">
                      {new Date(ticket.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {canManage ? (
                          <>
                            {ticket.status === 'open' && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleUpdateStatus(ticket.id, 'in_progress'); }}
                                className="px-2 py-1 bg-amber-50 text-amber-600 border border-amber-100 rounded text-[10px] font-black hover:bg-amber-500 hover:text-white transition-all shadow-sm"
                              >
                                ATENDER
                              </button>
                            )}
                            {(ticket.status === 'open' || ticket.status === 'in_progress') && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleUpdateStatus(ticket.id, 'resolved'); }}
                                className="px-2 py-1 bg-green-50 text-green-600 border border-green-100 rounded text-[10px] font-black hover:bg-green-500 hover:text-white transition-all shadow-sm"
                              >
                                RESOLVER
                              </button>
                            )}
                          </>
                        ) : (
                          <div className="text-[10px] text-gray-300 font-bold italic uppercase tracking-widest mr-2">Solo lectura</div>
                        )}
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleOpenDetail(ticket); }}
                          className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-[10px] font-black hover:bg-gray-200 transition-all uppercase"
                        >
                          Ver Chat
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

      {/* New Ticket Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h3 className="text-xl font-black text-gray-800 flex items-center gap-2">
                <Send className="text-[#009FE3]" size={24} />
                Nuevo Requerimiento
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-all"
              >
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleCreateTicket} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Título del requerimiento</label>
                <input
                  required
                  type="text"
                  value={newTicket.title}
                  onChange={e => setNewTicket({...newTicket, title: e.target.value})}
                  placeholder="Ej: Error al procesar pago en Bancamiga"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#009FE3]/20 focus:border-[#009FE3] outline-none transition-all font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Prioridad</label>
                  <select
                    value={newTicket.priority}
                    onChange={e => setNewTicket({...newTicket, priority: e.target.value as any})}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#009FE3]/20 focus:border-[#009FE3] outline-none transition-all font-medium appearance-none bg-white"
                  >
                    <option value="low">Baja</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Sucursal</label>
                  <select
                    value={newTicket.branch}
                    onChange={e => setNewTicket({...newTicket, branch: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#009FE3]/20 focus:border-[#009FE3] outline-none transition-all font-medium appearance-none bg-white"
                  >
                    <option value="Boleita">Boleita</option>
                    <option value="Sabana Grande">Sabana Grande</option>
                    <option value="Otro">Otro / Global</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Categoría</label>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                  {['support', 'bug', 'feature_request', 'other'].map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setNewTicket({...newTicket, category: cat as any})}
                      className={`px-3 py-2 rounded-lg border text-[10px] font-black uppercase tracking-tighter transition-all
                        ${newTicket.category === cat 
                          ? 'bg-gray-900 text-white border-gray-900 shadow-md' 
                          : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}
                    >
                      {cat === 'feature_request' ? 'Funcionalidad' : cat === 'support' ? 'Soporte' : cat === 'bug' ? 'Error' : 'Otro'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Detalles iniciales</label>
                <textarea
                  required
                  rows={4}
                  value={newTicket.description}
                  onChange={e => setNewTicket({...newTicket, description: e.target.value})}
                  placeholder="Describe detalladamente el problema o solicitud..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#009FE3]/20 focus:border-[#009FE3] outline-none transition-all font-medium resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Adjuntar Captura (Opcional)</label>
                <div 
                  onClick={() => ticketFileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-200 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <input 
                    type="file" 
                    ref={ticketFileInputRef} 
                    className="hidden" 
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setTicketImage(e.target.files[0]);
                      }
                    }}
                  />
                  {ticketImage ? (
                    <div className="text-center">
                      <ImageIcon size={24} className="mx-auto text-blue-500 mb-1" />
                      <p className="text-xs font-bold text-gray-700">{ticketImage.name}</p>
                      <p className="text-[10px] text-gray-400 uppercase font-bold mt-1">Clic para cambiar</p>
                    </div>
                  ) : (
                    <div className="text-center text-gray-400">
                      <Paperclip size={24} className="mx-auto mb-1" />
                      <p className="text-xs font-bold">Subir imagen</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-6 py-3 border border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-[2] bg-[#009FE3] hover:bg-[#0088c4] text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-[#009FE3]/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                  Enviar Requerimiento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Chat Detail Modal (Integrated Chat) */}
      {isDetailModalOpen && selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-4xl h-[85vh] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50 shrink-0">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg ${selectedTicket.priority === 'urgent' ? 'bg-red-600' : 'bg-blue-600'}`}>
                    <MessageCircle size={24} />
                </div>
                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">#{selectedTicket.id.substring(0, 8)}</span>
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${getStatusColor(selectedTicket.status)}`}>{selectedTicket.status}</span>
                    </div>
                    <h3 className="text-lg font-black text-gray-800 leading-tight">{selectedTicket.title}</h3>
                </div>
              </div>
              <button 
                onClick={() => setIsDetailModalOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-all"
              >
                <X size={24} />
              </button>
            </div>
            
            {/* Chat Body */}
            <div className="flex-1 flex overflow-hidden">
                {/* Info Sidebar */}
                <div className="w-64 bg-gray-50 border-r border-gray-100 p-6 space-y-6 overflow-y-auto hidden md:block">
                    <div>
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">Descripción</label>
                        <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm space-y-3">
                            <p className="text-xs font-medium text-gray-600 leading-relaxed">
                                {selectedTicket.description}
                            </p>
                            {selectedTicket.image_url && (
                                <a href={selectedTicket.image_url} target="_blank" rel="noopener noreferrer">
                                    <img src={selectedTicket.image_url} alt="Captura adjunta" className="w-full rounded-lg border border-gray-200 hover:opacity-90 transition-opacity cursor-pointer" />
                                </a>
                            )}
                        </div>
                    </div>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Sucursal</label>
                            <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
                                <Building2 size={14} className="text-[#009FE3]" /> {selectedTicket.branch}
                            </div>
                        </div>
                        <div>
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Creado por</label>
                            <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
                                <User size={14} className="text-[#009FE3]" /> {selectedTicket.creator_email?.split('@')[0]}
                            </div>
                        </div>
                    </div>

                    {canManage && (
                        <div className="pt-4 space-y-2">
                             <button 
                                onClick={() => handleUpdateStatus(selectedTicket.id, 'in_progress')}
                                className="w-full py-2 bg-amber-500 text-white rounded-lg font-bold text-[10px] uppercase transition-all shadow-sm hover:bg-amber-600"
                                disabled={selectedTicket.status === 'in_progress'}
                            >
                                Marcar en Progreso
                            </button>
                            <button 
                                onClick={() => handleUpdateStatus(selectedTicket.id, 'resolved')}
                                className="w-full py-2 bg-green-600 text-white rounded-lg font-bold text-[10px] uppercase transition-all shadow-sm hover:bg-green-700"
                            >
                                Resolver Ticket
                            </button>
                        </div>
                    )}
                </div>

                {/* Messages Area */}
                <div className="flex-1 flex flex-col bg-white">
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        {messages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-center opacity-40">
                                <MessageSquare size={48} className="mb-2" />
                                <p className="text-xs font-black uppercase tracking-widest">Inicia la conversación...</p>
                            </div>
                        ) : (
                            messages.map((msg, idx) => {
                                const { text, imageUrl } = parseMessage(msg);
                                return (
                                    <div key={msg.id} className={`flex flex-col ${msg.sender_id === currentUserId ? 'items-end' : 'items-start'}`}>
                                        <div className={`max-w-[80%] p-4 rounded-2xl shadow-sm border ${
                                            msg.sender_id === currentUserId 
                                                ? 'bg-gray-900 text-white border-gray-800 rounded-tr-none' 
                                                : 'bg-gray-50 text-gray-800 border-gray-100 rounded-tl-none'
                                        }`}>
                                            {imageUrl && (
                                                <a href={imageUrl} target="_blank" rel="noopener noreferrer">
                                                    <img src={imageUrl} alt="Adjunto" className="max-w-full rounded-lg mb-2 border border-gray-200 hover:opacity-90 cursor-pointer object-cover" style={{ maxHeight: '200px' }} />
                                                </a>
                                            )}
                                            {text && <p className="text-sm font-medium leading-relaxed">{text}</p>}
                                            <div className={`mt-2 flex items-center gap-2 text-[8px] font-black uppercase tracking-widest ${
                                                msg.sender_id === currentUserId ? 'text-gray-400' : 'text-gray-400'
                                            }`}>
                                                <span>{msg.sender_email?.split('@')[0]}</span>
                                                <span>•</span>
                                                <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Input Area */}
                    <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-100 bg-gray-50 flex items-center gap-2">
                        {chatImage && (
                            <div className="absolute bottom-20 left-4 bg-white p-2 rounded-xl border border-gray-200 shadow-lg flex items-center gap-2 animate-in slide-in-from-bottom-2">
                                <ImageIcon size={20} className="text-blue-500" />
                                <span className="text-xs font-bold text-gray-700 max-w-[150px] truncate">{chatImage.name}</span>
                                <button type="button" onClick={() => setChatImage(null)} className="p-1 hover:bg-gray-100 rounded-md text-red-500">
                                    <X size={14} />
                                </button>
                            </div>
                        )}
                        <input 
                            type="file" 
                            ref={chatFileInputRef} 
                            className="hidden" 
                            accept="image/*"
                            onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                    setChatImage(e.target.files[0]);
                                }
                            }}
                        />
                        <button 
                            type="button" 
                            onClick={() => chatFileInputRef.current?.click()}
                            className="p-3 bg-white border border-gray-200 text-gray-400 rounded-xl hover:text-gray-600 hover:bg-gray-50 transition-all shadow-sm"
                        >
                            <Paperclip size={20} />
                        </button>
                        <input 
                            type="text"
                            value={newMessage}
                            onChange={e => setNewMessage(e.target.value)}
                            placeholder="Escribe un mensaje..."
                            className="flex-1 px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#009FE3]/20 focus:border-[#009FE3] outline-none transition-all font-medium text-sm"
                        />
                        <button 
                            type="submit"
                            disabled={sendingMessage || (!newMessage.trim() && !chatImage)}
                            className="p-3 bg-[#009FE3] text-white rounded-xl shadow-lg shadow-[#009FE3]/20 hover:bg-[#0088c4] transition-all disabled:opacity-50"
                        >
                            {sendingMessage ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                        </button>
                    </form>
                </div>
            </div>
          </div>
        </div>
      )}

      {/* Simple Custom Animation CSS */}
      <style>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }
      `}</style>
    </div>
  );
}
